import { generateTextResponse } from "#ai/models/xai/index.js";
import { linkSchema } from "./schema-linking.js";
import { selfConsistencyVote, singleQuery } from "./self-consistency.js";
import {
  formatDataForChart,
  determineChartAxes,
  ChartConfig,
  ChartType,
} from "./chart-inference.js";
import { RESPONSE_GENERATION_SYSTEM_PROMPT } from "./prompt.js";
import { log, logError } from "#utils/logger.js";

export interface ChartData {
  type: ChartType;
  data: Record<string, unknown>[];
  config?: { xKey?: string; yKey?: string; columns?: string[] };
}

export interface ProcessedMessage {
  content: string;
  charts?: ChartData[];
  sql?: string;
  debug?: {
    linkedSchema: unknown;
    confidence?: number;
    candidateCount?: number;
    successfulExecutions?: number;
  };
}

export interface ProcessOptions {
  useConsistency?: boolean;
  debug?: boolean;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function processUserMessage(
  userQuestion: string,
  conversationHistory: ConversationMessage[] = [],
  options: ProcessOptions = {},
  processId?: string
): Promise<ProcessedMessage> {
  const { useConsistency = true, debug = false } = options;

  const requestStartTime = Date.now();

  log("\n========================================", undefined, processId);
  log("🚀 C3 Text-to-SQL Processing Started", undefined, processId);
  log("========================================", undefined, processId);
  log("📝 User Question:", userQuestion, processId);
  log("💬 Conversation History Length:", conversationHistory.length, processId);
  log("⚙️  Options:", { useConsistency, debug }, processId);
  if (processId) {
    log("🆔 Process ID:", processId, processId);
  }

  try {
    // Step 0: Run classification and schema linking IN PARALLEL
    log("\n🔍 Step 0: Parallel Classification & Schema Linking", undefined, processId);
    const parallelStart = Date.now();

    const { getDataContext } = await import("./data-context.js");
    const { classifyMessage } = await import("./message-classifier.js");

    // Get data context first (needed for both classification and schema linking)
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

    // Run classification and schema linking in parallel
    const [classification, linkedSchema] = await Promise.all([
      classifyMessage(userQuestion, conversationHistory, dataContext, processId),
      linkSchema(userQuestion, conversationHistory, processId),
    ]);

    const parallelTime = Date.now() - parallelStart;
    log(`✅ Parallel tasks complete (${parallelTime}ms)`, undefined, processId);
    log(`   Is Data Query: ${classification.isDataQuery}`, undefined, processId);
    log(`   Chart Type: ${classification.chartType}`, undefined, processId);
    log(`   Reasoning: ${classification.reasoning}`, undefined, processId);
    log(
      `   Conversational Response: ${classification.conversationalResponse}`,
      undefined,
      processId
    );
    log(
      `   Linked Schema: ${linkedSchema.tables.map((t) => t.name).join(", ")}`,
      undefined,
      processId
    );

    // If it's not a data query, return the conversational response immediately
    if (!classification.isDataQuery) {
      const totalTime = Date.now() - requestStartTime;

      log("\n✨ Conversational Response Complete (skipped C3 pipeline)!", undefined, processId);
      log(
        `⏱️  Total Request Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`,
        undefined,
        processId
      );
      log("========================================\n", undefined, processId);

      return {
        content: classification.conversationalResponse,
      };
    }

    log("\n🔄 Proceeding with C3 pipeline for data query", undefined, processId);
    log("   (Schema linking already completed in parallel above)", undefined, processId);

    // Step 2 & 3: SQL Generation + Consistency (CP + CH + CO)
    log("\n🔧 Step 2-3: SQL Generation + Self-Consistency", undefined, processId);
    let sql: string;
    let data: Record<string, unknown>[];
    let confidence: number | undefined;
    let candidateCount: number | undefined;
    let successfulExecutions: number | undefined;

    const startSQLGeneration = Date.now();
    if (useConsistency) {
      log("🔄 Using self-consistency voting (3 candidates)", undefined, processId);
      const result = await selfConsistencyVote(userQuestion, linkedSchema, 3, conversationHistory, dataContext, processId);
      sql = result.sql;
      data = result.data;
      confidence = result.confidence;
      candidateCount = result.candidateCount;
      successfulExecutions = result.successfulExecutions;

      const sqlGenerationTime = Date.now() - startSQLGeneration;
      log(`✅ Self-Consistency Vote Complete (${sqlGenerationTime}ms)`, undefined, processId);
      log(`   Confidence: ${(confidence * 100).toFixed(1)}%`, undefined, processId);
      log(`   Candidates: ${candidateCount}, Successful: ${successfulExecutions}`, undefined, processId);
    } else {
      log("⚡ Using single query (fast mode)", undefined, processId);
      const result = await singleQuery(userQuestion, linkedSchema, conversationHistory, dataContext, processId);
      sql = result.sql;
      data = result.data;

      const sqlGenerationTime = Date.now() - startSQLGeneration;
      log(`✅ Single Query Complete (${sqlGenerationTime}ms)`, undefined, processId);
    }

    log("📜 Generated SQL:", undefined, processId);
    log("   " + sql.split("\n").join("\n   "), undefined, processId);
    log("📦 Query Results:", `${data.length} rows`, processId);
    if (data.length > 0 && data.length <= 3) {
      log("   Sample data:", JSON.stringify(data, null, 2), processId);
    }

    // Step 4: Determine chart axes from data
    log("\n📈 Step 4: Determining Chart Configuration", undefined, processId);
    const chartConfig = determineChartAxes(data, classification.chartType);
    log("✅ Chart Type (from classifier):", chartConfig.type, processId);
    if (chartConfig.xKey && chartConfig.yKey) {
      log(`   X-axis: ${chartConfig.xKey}, Y-axis: ${chartConfig.yKey}`, undefined, processId);
    }

    // Step 5: Generate Natural Language Response
    log("\n💬 Step 5: Generating Natural Language Response", undefined, processId);
    const startResponse = Date.now();
    const content = await generateNaturalResponse(
      userQuestion,
      data,
      chartConfig,
      conversationHistory,
      processId
    );
    const responseTime = Date.now() - startResponse;
    log(`✅ Response Generated (${responseTime}ms)`, undefined, processId);
    log("   Response:", content, processId);

    // Step 6: Format data for chart
    log("\n🎨 Step 6: Formatting Data for Chart", undefined, processId);
    const formattedData = formatDataForChart(data, chartConfig);
    log(`✅ Data Formatted: ${formattedData.length} rows`, undefined, processId);
    if (formattedData.length > 0 && formattedData.length <= 3) {
      log("   Formatted sample:", JSON.stringify(formattedData, null, 2), processId);
    }

    // Build response
    log("\n📦 Building Response", undefined, processId);
    log(
      `   Chart config: xKey="${chartConfig.xKey}", yKey="${chartConfig.yKey}"`,
      undefined,
      processId
    );
    const cleanXKey = chartConfig.xKey?.replace("_cents", "");
    const cleanYKey = chartConfig.yKey?.replace("_cents", "");
    log(`   Clean config: xKey="${cleanXKey}", yKey="${cleanYKey}"`, undefined, processId);

    const response: ProcessedMessage = {
      content,
      charts:
        data.length > 0 && chartConfig.type !== "none"
          ? [
              {
                type: chartConfig.type,
                data: formattedData,
                config:
                  chartConfig.type === "table"
                    ? { columns: chartConfig.columns }
                    : chartConfig.xKey && chartConfig.yKey
                      ? {
                          xKey: cleanXKey!,
                          yKey: cleanYKey!,
                        }
                      : undefined,
              },
            ]
          : undefined,
    };

    if (debug) {
      response.sql = sql;
      response.debug = {
        linkedSchema,
        confidence,
        candidateCount,
        successfulExecutions,
      };
    }

    const totalTime = Date.now() - requestStartTime;

    log("\n✨ C3 Processing Complete!", undefined, processId);
    log(`⏱️  Total Request Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`, undefined, processId);
    log("========================================\n", undefined, processId);

    return response;
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;

    logError("\n❌ Error processing user message:", error, processId);
    log(`⏱️  Request failed after ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`, undefined, processId);
    log("========================================\n", undefined, processId);
    return {
      content: generateErrorMessage(error),
    };
  }
}

async function generateNaturalResponse(
  question: string,
  data: Record<string, unknown>[],
  chartConfig: ChartConfig,
  conversationHistory: ConversationMessage[],
  processId?: string
): Promise<string> {
  if (data.length === 0) {
    return "I couldn't find any data matching your query. Please try rephrasing your question or check if the data exists for the criteria you specified.";
  }

  const summary = summarizeData(data, chartConfig);

  // Include conversation context if there's history
  let conversationContext = "";
  if (conversationHistory.length > 1) {
    // Exclude the current question (last message)
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

Provide an analysis with specific data, share any insights about what this reveals, and end with a follow-up question to explore further.
Use markdown formatting where it helps (bold, lists, subtitles). Convert cents to dollars.`;

  return generateTextResponse(RESPONSE_GENERATION_SYSTEM_PROMPT, prompt, {
    temperature: 0.3,
    label: "Natural Language Response",
    processId,
  });
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
