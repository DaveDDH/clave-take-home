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
import { REASONING_TO_CANDIDATES, ReasoningLevel } from "./types.js";
import {
  getNextEscalation,
  ESCALATION_EXHAUSTED_MESSAGE,
  type EscalationState,
} from "./escalation.js";
import { CostAccumulator } from "#utils/cost.js";

// Helper: Log request startup information
function logRequestStart(
  userQuestion: string,
  historyLength: number,
  useConsistency: boolean,
  debug: boolean,
  processId?: string
): void {
  log("\n========================================", undefined, processId);
  log("🚀 C3 Text-to-SQL Streaming Started", undefined, processId);
  log("========================================", undefined, processId);
  log("📝 User Question:", userQuestion, processId);
  log("💬 Conversation History Length:", historyLength, processId);
  log("⚙️  Options:", { useConsistency, debug }, processId);
  if (processId) {
    log("🆔 Process ID:", processId, processId);
  }
}

// Helper: Handle conversational (non-data) response
function handleConversationalResponse(
  requestStartTime: number,
  costAccumulator: CostAccumulator,
  sseWriter: SSEWriter,
  processId?: string
): void {
  const totalTime = Date.now() - requestStartTime;
  log("\n✨ Conversational Response Complete (skipped C3 pipeline)!", undefined, processId);
  log(`⏱️  Total Request Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`, undefined, processId);
  costAccumulator.logSummary();
  log("========================================\n", undefined, processId);
  sseWriter.sendCost(costAccumulator.getTotalCost());
  sseWriter.sendComplete();
  sseWriter.close();
}

// Helper: Generate SQL with or without consistency
interface SQLGenerationResult {
  sql: string;
  data: Record<string, unknown>[];
  confidence?: number;
}

interface SQLGenerationOptions {
  useConsistency: boolean;
  candidateCount: number;
  currentReasoning: ReasoningLevel;
  userQuestion: string;
  linkedSchema: Awaited<ReturnType<typeof linkSchema>>["result"];
  history: ConversationMessage[];
  dataContext: Awaited<ReturnType<typeof import("./data-context.js").getDataContext>>;
  currentModel: ModelId;
  costAccumulator: CostAccumulator;
  processId?: string;
}

async function generateSQL(opts: SQLGenerationOptions): Promise<SQLGenerationResult> {
  const { useConsistency, candidateCount, currentReasoning, userQuestion, linkedSchema, history, dataContext, currentModel, costAccumulator, processId } = opts;
  const startSQLGeneration = Date.now();

  if (useConsistency) {
    log(`🔄 Using self-consistency voting (${candidateCount} candidates, reasoning: ${currentReasoning})`, undefined, processId);
    const result = await selfConsistencyVote({
      userQuestion,
      linkedSchema,
      candidateCount,
      conversationHistory: history,
      dataContext,
      model: currentModel,
      costAccumulator,
      processId,
    });
    const sqlGenerationTime = Date.now() - startSQLGeneration;
    log(`✅ Self-Consistency Vote Complete (${sqlGenerationTime}ms)`, undefined, processId);
    log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`, undefined, processId);
    return result;
  }

  log("⚡ Using single query (fast mode)", undefined, processId);
  const result = await singleQuery({
    userQuestion,
    linkedSchema,
    conversationHistory: history,
    dataContext,
    model: currentModel,
    costAccumulator,
    processId,
  });
  const sqlGenerationTime = Date.now() - startSQLGeneration;
  log(`✅ Single Query Complete (${sqlGenerationTime}ms)`, undefined, processId);
  return result;
}

// Helper: Handle escalation exhausted
function handleEscalationExhausted(
  requestStartTime: number,
  costAccumulator: CostAccumulator,
  sseWriter: SSEWriter,
  processId?: string
): void {
  const totalTime = Date.now() - requestStartTime;
  logError("\n❌ Max escalation reached, all retry options exhausted", undefined, processId);
  log(`⏱️  Request failed after ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`, undefined, processId);
  costAccumulator.logSummary();
  log("========================================\n", undefined, processId);
  sseWriter.sendCost(costAccumulator.getTotalCost());
  sseWriter.sendError(ESCALATION_EXHAUSTED_MESSAGE);
  sseWriter.close();
}

// Helper: Log successful completion
function logCompletion(
  requestStartTime: number,
  costAccumulator: CostAccumulator,
  sseWriter: SSEWriter,
  processId?: string
): void {
  const totalTime = Date.now() - requestStartTime;
  log("\n✨ C3 Streaming Complete!", undefined, processId);
  log(`⏱️  Total Request Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`, undefined, processId);
  costAccumulator.logSummary();
  log("========================================\n", undefined, processId);
  sseWriter.sendCost(costAccumulator.getTotalCost());
  sseWriter.sendComplete();
  sseWriter.close();
}

// Helper: Build chart config based on type
function buildChartConfig(chartConfig: ChartConfig): { columns?: string[]; xKey?: string; yKey?: string } | undefined {
  if (chartConfig.type === "table") {
    return { columns: chartConfig.columns };
  }
  if (chartConfig.xKey && chartConfig.yKey) {
    const cleanXKey = chartConfig.xKey.replace("_cents", "");
    const cleanYKey = chartConfig.yKey.replace("_cents", "");
    return { xKey: cleanXKey, yKey: cleanYKey };
  }
  return undefined;
}

interface NaturalResponseStreamOptions {
  question: string;
  data: Record<string, unknown>[];
  chartConfig: ChartConfig;
  conversationHistory: ConversationMessage[];
  model: ModelId;
  costAccumulator: CostAccumulator;
  sseWriter: SSEWriter;
  processId?: string;
}

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
  logRequestStart(userQuestion, history.length, useConsistency, debug, processId);

  let escalationState: EscalationState = { model, reasoningLevel, attempt: 1 };
  const costAccumulator = new CostAccumulator(processId);

  while (true) {
    const { model: currentModel, reasoningLevel: currentReasoning, attempt } = escalationState;
    const candidateCount = REASONING_TO_CANDIDATES[currentReasoning];

    if (attempt > 1) {
      log(`\n🔄 Retry attempt ${attempt} with ${currentModel}/${currentReasoning}`, undefined, processId);
    }

    try {
      const result = await executeC3Pipeline({
        userQuestion,
        history,
        currentModel,
        currentReasoning,
        candidateCount,
        useConsistency,
        debug,
        requestStartTime,
        costAccumulator,
        sseWriter,
        processId,
      });

      if (result.completed) return;
    } catch (error) {
      const handled = handlePipelineError(error, escalationState, requestStartTime, costAccumulator, sseWriter, processId);
      if (handled.shouldReturn) return;
      escalationState = handled.nextState;
    }
  }
}

// Pipeline execution context
interface PipelineContext {
  userQuestion: string;
  history: ConversationMessage[];
  currentModel: ModelId;
  currentReasoning: ReasoningLevel;
  candidateCount: number;
  useConsistency: boolean;
  debug: boolean;
  requestStartTime: number;
  costAccumulator: CostAccumulator;
  sseWriter: SSEWriter;
  processId?: string;
}

async function executeC3Pipeline(ctx: PipelineContext): Promise<{ completed: boolean }> {
  const { userQuestion, history, currentModel, currentReasoning, candidateCount, useConsistency, debug, requestStartTime, costAccumulator, sseWriter, processId } = ctx;

  sseWriter.sendStart();
  sseWriter.sendProgress("Starting analysis...", "init");

  // Step 0: Run classification and schema linking in parallel
  const { classification, linkedSchema } = await runParallelClassificationAndSchema(
    userQuestion, history, currentModel, costAccumulator, sseWriter, processId
  );

  // If not a data query, return conversational response
  if (!classification.isDataQuery) {
    handleConversationalResponse(requestStartTime, costAccumulator, sseWriter, processId);
    return { completed: true };
  }

  log(`✅ Schema linking complete`, undefined, processId);
  log(`   Linked Schema: ${linkedSchema.tables.map((t) => t.name).join(", ")}`, undefined, processId);
  sseWriter.sendProgress("Identified relevant tables...", "schema");

  // Step 2-3: SQL Generation
  log("\n🔧 Step 2-3: SQL Generation + Self-Consistency", undefined, processId);
  sseWriter.sendProgress("Generating SQL query...", "sql");

  const { getDataContext } = await import("./data-context.js");
  const dataContext = await getDataContext();

  const { sql, data } = await generateSQL({
    useConsistency, candidateCount, currentReasoning, userQuestion,
    linkedSchema, history, dataContext, currentModel, costAccumulator, processId,
  });

  log("📜 Generated SQL:", undefined, processId);
  log("   " + sql.split("\n").join("\n   "), undefined, processId);
  console.log("\n📜 CHOSEN SQL QUERY:\n" + sql + "\n");
  log("📦 Query Results:", `${data.length} rows`, processId);

  if (debug) sseWriter.sendSQL(sql);

  // Step 4-5: Chart configuration and formatting
  const chartConfig = determineChartAxes(data, classification.chartType);
  log("\n📈 Step 4: Determining Chart Configuration", undefined, processId);
  log("✅ Chart Type (from classifier):", chartConfig.type, processId);

  sseWriter.sendProgress("Querying database...", "query");

  if (data.length > 0 && chartConfig.type !== "none") {
    const formattedData = formatDataForChart(data, chartConfig);
    log(`\n🎨 Step 5: Data Formatted: ${formattedData.length} rows`, undefined, processId);
    sseWriter.sendChart([{ type: chartConfig.type, data: formattedData, config: buildChartConfig(chartConfig) }]);
  }

  // Step 6: Generate natural language response
  log("\n💬 Step 6: Streaming Natural Language Response", undefined, processId);
  sseWriter.sendProgress("Generating response...", "response");

  const startResponse = Date.now();
  await generateNaturalResponseStream({
    question: userQuestion, data, chartConfig, conversationHistory: history,
    model: currentModel, costAccumulator, sseWriter, processId,
  });
  log(`✅ Response Streamed (${Date.now() - startResponse}ms)`, undefined, processId);

  logCompletion(requestStartTime, costAccumulator, sseWriter, processId);
  return { completed: true };
}

async function runParallelClassificationAndSchema(
  userQuestion: string,
  history: ConversationMessage[],
  currentModel: ModelId,
  costAccumulator: CostAccumulator,
  sseWriter: SSEWriter,
  processId?: string
) {
  log("\n🔍 Step 0: Parallel Classification & Schema Linking", undefined, processId);
  const parallelStart = Date.now();

  const { getDataContext } = await import("./data-context.js");
  const { classifyMessage } = await import("./message-classifier.js");

  const dataContext = await getDataContext();
  if (dataContext.orderDateRange) {
    const earliest = new Date(dataContext.orderDateRange.earliest).toISOString().split("T")[0];
    const latest = new Date(dataContext.orderDateRange.latest).toISOString().split("T")[0];
    log(`   📅 Data available from ${earliest} to ${latest}`, undefined, processId);
  }

  const classificationPromise = classifyMessage(userQuestion, history, dataContext, currentModel, processId);
  const schemaLinkingPromise = linkSchema(userQuestion, history, currentModel, processId);

  const classificationResult = await classificationPromise;
  costAccumulator.addUsage(classificationResult.model, classificationResult.usage, "Message Classification");
  const classification = classificationResult.result;
  const classificationTime = Date.now() - parallelStart;

  log(`✅ Classification complete (${classificationTime}ms)`, undefined, processId);
  log(`   Is Data Query: ${classification.isDataQuery}`, undefined, processId);
  log(`   Chart Type: ${classification.chartType}`, undefined, processId);

  sseWriter.sendClassification({
    isDataQuery: classification.isDataQuery,
    chartType: classification.chartType,
    conversationalResponse: classification.conversationalResponse,
  });

  const schemaLinkingResult = await schemaLinkingPromise;
  costAccumulator.addUsage(schemaLinkingResult.model, schemaLinkingResult.usage, "Schema Linking");

  return { classification, linkedSchema: schemaLinkingResult.result, classificationTime };
}

function handlePipelineError(
  error: unknown,
  escalationState: EscalationState,
  requestStartTime: number,
  costAccumulator: CostAccumulator,
  sseWriter: SSEWriter,
  processId?: string
): { shouldReturn: boolean; nextState: EscalationState } {
  const errorMsg = error instanceof Error ? error.message : String(error);
  logWarn(`\n⚠️ Attempt ${escalationState.attempt} failed: ${errorMsg}`, undefined, processId);

  const escalation = getNextEscalation(escalationState);

  if (!escalation.canEscalate) {
    handleEscalationExhausted(requestStartTime, costAccumulator, sseWriter, processId);
    return { shouldReturn: true, nextState: escalationState };
  }

  log(`\n⬆️ Escalating: ${escalationState.model}/${escalationState.reasoningLevel} → ${escalation.nextState!.model}/${escalation.nextState!.reasoningLevel}`, undefined, processId);
  return { shouldReturn: false, nextState: escalation.nextState! };
}

async function generateNaturalResponseStream(
  options: NaturalResponseStreamOptions
): Promise<void> {
  const { question, data, chartConfig, conversationHistory, model, costAccumulator, sseWriter, processId } = options;

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
