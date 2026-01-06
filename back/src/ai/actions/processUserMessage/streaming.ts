import { streamTextResponse } from "#ai/models/xai/index.js";
import { linkSchema } from "./schema-linking.js";
import { selfConsistencyVote, singleQuery } from "./self-consistency.js";
import {
  formatDataForChart,
  determineChartAxes,
  ChartConfig,
} from "./chart-inference.js";
import { RESPONSE_GENERATION_SYSTEM_PROMPT } from "./prompt.js";
import { log, logError } from "#utils/logger.js";
import { SSEWriter } from "#utils/sse.js";
import type { ConversationMessage, ProcessOptions } from "./index.js";

export async function processUserMessageStream(
  userQuestion: string,
  conversationHistory: ConversationMessage[] = [],
  options: ProcessOptions = {},
  sseWriter: SSEWriter
): Promise<void> {
  const { useConsistency = true, debug = false } = options;

  const requestStartTime = Date.now();

  log("\n========================================");
  log("🚀 C3 Text-to-SQL Streaming Started");
  log("========================================");
  log("📝 User Question:", userQuestion);
  log("💬 Conversation History Length:", conversationHistory.length);
  log("⚙️  Options:", { useConsistency, debug });

  try {
    // Send start event
    sseWriter.sendStart();
    sseWriter.sendProgress("Starting analysis...", "init");

    // Step 0: Run classification and schema linking IN PARALLEL
    log("\n🔍 Step 0: Parallel Classification & Schema Linking");
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
      log(`   📅 Data available from ${earliest} to ${latest}`);
    }

    // Run classification and schema linking in parallel
    const [classification, linkedSchema] = await Promise.all([
      classifyMessage(userQuestion, conversationHistory, dataContext),
      linkSchema(userQuestion, conversationHistory),
    ]);

    const parallelTime = Date.now() - parallelStart;
    log(`✅ Parallel tasks complete (${parallelTime}ms)`);
    log(`   Is Data Query: ${classification.isDataQuery}`);
    log(`   Chart Type: ${classification.chartType}`);
    log(`   Reasoning: ${classification.reasoning}`);
    log(`   Conversational Response: ${classification.conversationalResponse}`);
    log(`   Linked Schema: ${linkedSchema.tables.map((t) => t.name).join(", ")}`);

    // Send classification response immediately
    sseWriter.sendClassification({
      isDataQuery: classification.isDataQuery,
      chartType: classification.chartType,
      conversationalResponse: classification.conversationalResponse,
    });

    // If it's not a data query, return the conversational response immediately
    if (!classification.isDataQuery) {
      const totalTime = Date.now() - requestStartTime;

      log("\n✨ Conversational Response Complete (skipped C3 pipeline)!");
      log(`⏱️  Total Request Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
      log("========================================\n");

      sseWriter.sendComplete();
      sseWriter.close();
      return;
    }

    log("\n🔄 Proceeding with C3 pipeline for data query");
    sseWriter.sendProgress("Identified relevant tables...", "schema");

    // Step 2 & 3: SQL Generation + Consistency
    log("\n🔧 Step 2-3: SQL Generation + Self-Consistency");
    sseWriter.sendProgress("Generating SQL query...", "sql");

    let sql: string;
    let data: Record<string, unknown>[];
    let confidence: number | undefined;

    const startSQLGeneration = Date.now();
    if (useConsistency) {
      log("🔄 Using self-consistency voting (3 candidates)");
      const result = await selfConsistencyVote(
        userQuestion,
        linkedSchema,
        3,
        conversationHistory,
        dataContext
      );
      sql = result.sql;
      data = result.data;
      confidence = result.confidence;

      const sqlGenerationTime = Date.now() - startSQLGeneration;
      log(`✅ Self-Consistency Vote Complete (${sqlGenerationTime}ms)`);
      log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);
    } else {
      log("⚡ Using single query (fast mode)");
      const result = await singleQuery(
        userQuestion,
        linkedSchema,
        conversationHistory,
        dataContext
      );
      sql = result.sql;
      data = result.data;

      const sqlGenerationTime = Date.now() - startSQLGeneration;
      log(`✅ Single Query Complete (${sqlGenerationTime}ms)`);
    }

    log("📜 Generated SQL:");
    log("   " + sql.split("\n").join("\n   "));
    log("📦 Query Results:", `${data.length} rows`);

    // Send SQL (for debug mode)
    if (debug) {
      sseWriter.sendSQL(sql);
    }

    // Step 4: Determine chart axes from data
    log("\n📈 Step 4: Determining Chart Configuration");
    sseWriter.sendProgress("Querying database...", "query");

    const chartConfig = determineChartAxes(data, classification.chartType);
    log("✅ Chart Type (from classifier):", chartConfig.type);
    if (chartConfig.xKey && chartConfig.yKey) {
      log(`   X-axis: ${chartConfig.xKey}, Y-axis: ${chartConfig.yKey}`);
    }

    // Step 5: Format data for chart and send immediately
    log("\n🎨 Step 5: Formatting Data for Chart");
    const formattedData = formatDataForChart(data, chartConfig);
    log(`✅ Data Formatted: ${formattedData.length} rows`);

    const cleanXKey = chartConfig.xKey?.replace("_cents", "");
    const cleanYKey = chartConfig.yKey?.replace("_cents", "");

    if (data.length > 0 && chartConfig.type !== "none") {
      sseWriter.sendChart([
        {
          type: chartConfig.type,
          data: formattedData,
          config:
            chartConfig.xKey && chartConfig.yKey
              ? {
                  xKey: cleanXKey!,
                  yKey: cleanYKey!,
                }
              : undefined,
        },
      ]);
    }

    // Step 6: Generate Natural Language Response with streaming
    log("\n💬 Step 6: Streaming Natural Language Response");
    sseWriter.sendProgress("Generating response...", "response");

    const startResponse = Date.now();
    await generateNaturalResponseStream(
      userQuestion,
      data,
      chartConfig,
      conversationHistory,
      sseWriter
    );
    const responseTime = Date.now() - startResponse;
    log(`✅ Response Streamed (${responseTime}ms)`);

    const totalTime = Date.now() - requestStartTime;

    log("\n✨ C3 Streaming Complete!");
    log(`⏱️  Total Request Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    log("========================================\n");

    sseWriter.sendComplete();
    sseWriter.close();
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;

    logError("\n❌ Error processing user message:", error);
    log(`⏱️  Request failed after ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    log("========================================\n");

    const errorMessage = generateErrorMessage(error);
    sseWriter.sendError(errorMessage);
    sseWriter.close();
  }
}

async function generateNaturalResponseStream(
  question: string,
  data: Record<string, unknown>[],
  chartConfig: ChartConfig,
  conversationHistory: ConversationMessage[],
  sseWriter: SSEWriter
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

Data summary for this question:
${summary}

Write a brief, natural language response (1-2 sentences) that directly answers the current question.
Be specific with numbers and names. Convert any cents values to dollars (divide by 100).
If relevant, reference previous conversation context.
Use markdown formatting for readability (bold for key numbers/names, italic for emphasis, lists when appropriate).`;

  await streamTextResponse(
    RESPONSE_GENERATION_SYSTEM_PROMPT,
    prompt,
    { temperature: 0.3 },
    (token) => {
      sseWriter.sendContentDelta(token);
    }
  );
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

function generateErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("not a read-only query")) {
      return "I can only answer questions that read data. I cannot modify the database.";
    }
    if (error.message.includes("Failed to generate")) {
      return "I had trouble understanding your question. Could you please rephrase it?";
    }
    if (error.message.includes("All SQL candidates failed")) {
      return "I couldn't find a way to answer that question with the available data. Please try a different question.";
    }
  }
  return "Sorry, something went wrong while processing your request. Please try again.";
}
