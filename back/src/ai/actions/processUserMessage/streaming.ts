import { streamTextResponse, DEFAULT_MODEL } from "#ai/models/index.js";
import type { ModelId } from "#ai/models/index.js";
import { linkSchema } from "./schema-linking.js";
import { selfConsistencyVote, singleQuery } from "./self-consistency.js";
import {
  formatDataForChart,
  determineChartAxes,
  ChartConfig,
} from "./chart-inference.js";
import { RESPONSE_GENERATION_SYSTEM_PROMPT } from "./prompt.js";
import { log, logError, logWarn } from "#utils/logger.js";
import { SSEWriter } from "#utils/sse.js";
import type { ConversationMessage, ProcessOptions } from "./types.js";
import { REASONING_TO_CANDIDATES } from "./types.js";
import {
  getNextEscalation,
  ESCALATION_EXHAUSTED_MESSAGE,
  type EscalationState,
} from "./escalation.js";
import { CostAccumulator } from "#utils/cost.js";

export async function processUserMessageStream(
  userQuestion: string,
  conversationHistory: ConversationMessage[] | undefined,
  options: ProcessOptions | undefined,
  sseWriter: SSEWriter,
  processId?: string
): Promise<void> {
  const history = conversationHistory ?? [];
  const opts = options ?? {};
  const { useConsistency = true, debug = false, model = DEFAULT_MODEL, reasoningLevel = 'medium' } = opts;

  const requestStartTime = Date.now();

  log("\n========================================", undefined, processId);
  log("🚀 C3 Text-to-SQL Streaming Started", undefined, processId);
  log("========================================", undefined, processId);
  log("📝 User Question:", userQuestion, processId);
  log("💬 Conversation History Length:", history.length, processId);
  log("⚙️  Options:", { useConsistency, debug }, processId);
  if (processId) {
    log("🆔 Process ID:", processId, processId);
  }

  // Initialize escalation state
  let escalationState: EscalationState = {
    model,
    reasoningLevel,
    attempt: 1,
  };

  // Create cost accumulator to track costs across all LLM calls (including retries)
  const costAccumulator = new CostAccumulator(processId);

  // Retry loop with escalation
  while (true) {
    const currentModel = escalationState.model;
    const currentReasoning = escalationState.reasoningLevel;
    const candidateCount = REASONING_TO_CANDIDATES[currentReasoning];

    if (escalationState.attempt > 1) {
      log(`\n🔄 Retry attempt ${escalationState.attempt} with ${currentModel}/${currentReasoning}`, undefined, processId);
    }

    try {
    // Send start event
    sseWriter.sendStart();
    sseWriter.sendProgress("Starting analysis...", "init");

    // Step 0: Run classification and schema linking IN PARALLEL
    log("\n🔍 Step 0: Parallel Classification & Schema Linking", undefined, processId);
    const parallelStart = Date.now();

    const { getDataContext } = await import("./data-context.js");
    const { classifyMessage } = await import("./message-classifier.js");

    // Get data context first
    const dataContext = await getDataContext();
    if (dataContext.orderDateRange) {
      const earliest = new Date(dataContext.orderDateRange.earliest)
        .toISOString()
        .split("T")[0];
      const latest = new Date(dataContext.orderDateRange.latest)
        .toISOString()
        .split("T")[0];
      log(`   📅 Data available from ${earliest} to ${latest}`, undefined, processId);
    }

    // Start both tasks in parallel (don't wait for both)
    const classificationPromise = classifyMessage(userQuestion, history, dataContext, currentModel, processId);
    const schemaLinkingPromise = linkSchema(userQuestion, history, currentModel, processId);

    // Wait for classification first - it determines if we need schema linking
    const classificationResult = await classificationPromise;
    costAccumulator.addUsage(classificationResult.model, classificationResult.usage, "Message Classification");
    const classification = classificationResult.result;
    const classificationTime = Date.now() - parallelStart;

    log(`✅ Classification complete (${classificationTime}ms)`, undefined, processId);
    log(`   Is Data Query: ${classification.isDataQuery}`, undefined, processId);
    log(`   Chart Type: ${classification.chartType}`, undefined, processId);
    log(`   Reasoning: ${classification.reasoning}`, undefined, processId);
    log(`   Conversational Response: ${classification.conversationalResponse}`, undefined, processId);

    // Send classification response immediately - don't wait for schema linking!
    sseWriter.sendClassification({
      isDataQuery: classification.isDataQuery,
      chartType: classification.chartType,
      conversationalResponse: classification.conversationalResponse,
    });

    // If it's not a data query, return the conversational response immediately
    if (!classification.isDataQuery) {
      const totalTime = Date.now() - requestStartTime;

      log("\n✨ Conversational Response Complete (skipped C3 pipeline)!", undefined, processId);
      log(`⏱️  Total Request Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`, undefined, processId);

      costAccumulator.logSummary();
      log("========================================\n", undefined, processId);

      sseWriter.sendCost(costAccumulator.getTotalCost());
      sseWriter.sendComplete();
      sseWriter.close();
      return;
    }

    // Now wait for schema linking to complete (it's been running in parallel)
    log("\n🔄 Proceeding with C3 pipeline for data query", undefined, processId);
    log("   ⏳ Waiting for schema linking to complete...", undefined, processId);

    const schemaLinkingResult = await schemaLinkingPromise;
    costAccumulator.addUsage(schemaLinkingResult.model, schemaLinkingResult.usage, "Schema Linking");
    const linkedSchema = schemaLinkingResult.result;
    const schemaLinkingTime = Date.now() - parallelStart;

    log(`✅ Schema linking complete (${schemaLinkingTime}ms total, started ${classificationTime}ms ago)`, undefined, processId);
    log(`   Linked Schema: ${linkedSchema.tables.map((t) => t.name).join(", ")}`, undefined, processId);

    sseWriter.sendProgress("Identified relevant tables...", "schema");

    // Step 2 & 3: SQL Generation + Consistency
    log("\n🔧 Step 2-3: SQL Generation + Self-Consistency", undefined, processId);
    sseWriter.sendProgress("Generating SQL query...", "sql");

    let sql: string;
    let data: Record<string, unknown>[];
    let confidence: number | undefined;

    const startSQLGeneration = Date.now();
    if (useConsistency) {
      log(`🔄 Using self-consistency voting (${candidateCount} candidates, reasoning: ${currentReasoning})`, undefined, processId);
      const result = await selfConsistencyVote(
        userQuestion,
        linkedSchema,
        candidateCount,
        history,
        dataContext,
        currentModel,
        costAccumulator,
        processId
      );
      sql = result.sql;
      data = result.data;
      confidence = result.confidence;

      const sqlGenerationTime = Date.now() - startSQLGeneration;
      log(`✅ Self-Consistency Vote Complete (${sqlGenerationTime}ms)`, undefined, processId);
      log(`   Confidence: ${(confidence * 100).toFixed(1)}%`, undefined, processId);
    } else {
      log("⚡ Using single query (fast mode)", undefined, processId);
      const result = await singleQuery(
        userQuestion,
        linkedSchema,
        history,
        dataContext,
        currentModel,
        costAccumulator,
        processId
      );
      sql = result.sql;
      data = result.data;

      const sqlGenerationTime = Date.now() - startSQLGeneration;
      log(`✅ Single Query Complete (${sqlGenerationTime}ms)`, undefined, processId);
    }

    log("📜 Generated SQL:", undefined, processId);
    log("   " + sql.split("\n").join("\n   "), undefined, processId);
    console.log("\n📜 CHOSEN SQL QUERY:\n" + sql + "\n");
    log("📦 Query Results:", `${data.length} rows`, processId);

    // Send SQL (for debug mode)
    if (debug) {
      sseWriter.sendSQL(sql);
    }

    // Step 4: Determine chart axes from data
    log("\n📈 Step 4: Determining Chart Configuration", undefined, processId);
    sseWriter.sendProgress("Querying database...", "query");

    const chartConfig = determineChartAxes(data, classification.chartType);
    log("✅ Chart Type (from classifier):", chartConfig.type, processId);
    if (chartConfig.xKey && chartConfig.yKey) {
      log(`   X-axis: ${chartConfig.xKey}, Y-axis: ${chartConfig.yKey}`, undefined, processId);
    }

    // Step 5: Format data for chart and send immediately
    log("\n🎨 Step 5: Formatting Data for Chart", undefined, processId);
    const formattedData = formatDataForChart(data, chartConfig);
    log(`✅ Data Formatted: ${formattedData.length} rows`, undefined, processId);

    const cleanXKey = chartConfig.xKey?.replace("_cents", "");
    const cleanYKey = chartConfig.yKey?.replace("_cents", "");

    // Build chart config based on type
    const getChartConfig = () => {
      if (chartConfig.type === "table") {
        return { columns: chartConfig.columns };
      }
      if (chartConfig.xKey && chartConfig.yKey) {
        return { xKey: cleanXKey!, yKey: cleanYKey! };
      }
      return undefined;
    };

    if (data.length > 0 && chartConfig.type !== "none") {
      sseWriter.sendChart([
        {
          type: chartConfig.type,
          data: formattedData,
          config: getChartConfig(),
        },
      ]);
    }

    // Step 6: Generate Natural Language Response with streaming
    log("\n💬 Step 6: Streaming Natural Language Response", undefined, processId);
    sseWriter.sendProgress("Generating response...", "response");

    const startResponse = Date.now();
    await generateNaturalResponseStream(
      userQuestion,
      data,
      chartConfig,
      history,
      currentModel,
      costAccumulator,
      sseWriter,
      processId
    );
    const responseTime = Date.now() - startResponse;
    log(`✅ Response Streamed (${responseTime}ms)`, undefined, processId);

    const totalTime = Date.now() - requestStartTime;

    log("\n✨ C3 Streaming Complete!", undefined, processId);
    log(`⏱️  Total Request Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`, undefined, processId);

    costAccumulator.logSummary();
    log("========================================\n", undefined, processId);

    sseWriter.sendCost(costAccumulator.getTotalCost());
    sseWriter.sendComplete();
    sseWriter.close();
    return; // Success - exit the retry loop
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWarn(`\n⚠️ Attempt ${escalationState.attempt} failed: ${errorMsg}`, undefined, processId);

      // Check if we can escalate
      const escalation = getNextEscalation(escalationState);

      if (!escalation.canEscalate) {
        // Max escalation reached - send friendly error and exit
        const totalTime = Date.now() - requestStartTime;
        logError("\n❌ Max escalation reached, all retry options exhausted", undefined, processId);
        log(`⏱️  Request failed after ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`, undefined, processId);

        costAccumulator.logSummary();
        log("========================================\n", undefined, processId);

        sseWriter.sendCost(costAccumulator.getTotalCost());
        sseWriter.sendError(ESCALATION_EXHAUSTED_MESSAGE);
        sseWriter.close();
        return;
      }

      // Escalate and retry
      log(`\n⬆️ Escalating: ${escalationState.model}/${escalationState.reasoningLevel} → ${escalation.nextState!.model}/${escalation.nextState!.reasoningLevel}`, undefined, processId);
      escalationState = escalation.nextState!;
      // Continue to next iteration of while loop
    }
  }
}

async function generateNaturalResponseStream(
  question: string,
  data: Record<string, unknown>[],
  chartConfig: ChartConfig,
  conversationHistory: ConversationMessage[],
  model: ModelId,
  costAccumulator: CostAccumulator,
  sseWriter: SSEWriter,
  processId?: string
): Promise<void> {
  if (data.length === 0) {
    const fallbackMessage =
      "I couldn't find any data matching your query. Please try rephrasing your question or check if the data exists for the criteria you specified.";
    sseWriter.sendContent(fallbackMessage);
    return;
  }

  const summary = summarizeData(data, chartConfig);

  // Include conversation context if there's history
  let conversationContext = "";
  if (conversationHistory.length > 1) {
    const previousMessages = conversationHistory.slice(0, -1);
    conversationContext = `\nPrevious conversation:\n${previousMessages
      .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n")}\n`;
  }

  const prompt = `${conversationContext}
Current user question about restaurant analytics:
"${question}"

Data retrieved (user will see this in a chart/table):
${summary}

The user can see all the data points in the visualization. DO NOT repeat or list the data.
Instead, provide a concise high-level analysis with insights about what this data means, any patterns or observations, and end with a follow-up question.
Use markdown for emphasis. Convert cents to dollars.`;

  const result = await streamTextResponse(
    model,
    RESPONSE_GENERATION_SYSTEM_PROMPT,
    prompt,
    { temperature: 0.3, label: "Streaming Natural Language Response", processId },
    (token) => {
      sseWriter.sendContentDelta(token);
    }
  );
  costAccumulator.addUsage(result.model, result.usage, "Natural Language Response");
}

function summarizeData(
  data: Record<string, unknown>[],
  _chartConfig: ChartConfig
): string {
  const rowCount = data.length;
  const columns = Object.keys(data[0] || {});

  let summary = `${rowCount} rows with columns: ${columns.join(", ")}\n`;
  summary += `Data:\n${JSON.stringify(data.slice(0, 10), null, 2)}`;

  return summary;
}
