import { generateTextResponse } from "#ai/models/xai/index.js";
import { linkSchema } from "./schema-linking.js";
import { selfConsistencyVote, singleQuery } from "./self-consistency.js";
import {
  inferChartType,
  formatDataForChart,
  ChartConfig,
  ChartType,
} from "./chart-inference.js";
import { RESPONSE_GENERATION_SYSTEM_PROMPT } from "./prompt.js";

export interface ProcessedMessage {
  content: string;
  charts?: Array<{
    type: ChartType;
    data: Record<string, unknown>[];
    config?: { xKey: string; yKey: string };
  }>;
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
  options: ProcessOptions = {}
): Promise<ProcessedMessage> {
  const { useConsistency = true, debug = false } = options;

  const requestStartTime = Date.now();

  console.log("\n========================================");
  console.log("🚀 C3 Text-to-SQL Processing Started");
  console.log("========================================");
  console.log("📝 User Question:", userQuestion);
  console.log("💬 Conversation History Length:", conversationHistory.length);
  console.log("⚙️  Options:", { useConsistency, debug });

  try {
    // Step 1: Schema Linking (CP - Clear Context)
    console.log("\n📊 Step 1: Schema Linking (Clear Context)");
    const startSchemaLinking = Date.now();
    const linkedSchema = await linkSchema(userQuestion);
    const schemaLinkingTime = Date.now() - startSchemaLinking;

    console.log(`✅ Schema Linking Complete (${schemaLinkingTime}ms)`);
    console.log("   Tables:", linkedSchema.tables.map(t => t.name).join(", "));
    console.log("   Columns by table:");
    linkedSchema.tables.forEach(t => {
      console.log(`     - ${t.name}: ${t.columns.join(", ")}`);
    });
    console.log("   Foreign Keys:", linkedSchema.foreignKeys.join(", ") || "none");

    // Step 2 & 3: SQL Generation + Consistency (CP + CH + CO)
    console.log("\n🔧 Step 2-3: SQL Generation + Self-Consistency");
    let sql: string;
    let data: Record<string, unknown>[];
    let confidence: number | undefined;
    let candidateCount: number | undefined;
    let successfulExecutions: number | undefined;

    const startSQLGeneration = Date.now();
    if (useConsistency) {
      console.log("🔄 Using self-consistency voting (3 candidates)");
      const result = await selfConsistencyVote(userQuestion, linkedSchema, 3);
      sql = result.sql;
      data = result.data;
      confidence = result.confidence;
      candidateCount = result.candidateCount;
      successfulExecutions = result.successfulExecutions;

      const sqlGenerationTime = Date.now() - startSQLGeneration;
      console.log(`✅ Self-Consistency Vote Complete (${sqlGenerationTime}ms)`);
      console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);
      console.log(`   Candidates: ${candidateCount}, Successful: ${successfulExecutions}`);
    } else {
      console.log("⚡ Using single query (fast mode)");
      const result = await singleQuery(userQuestion, linkedSchema);
      sql = result.sql;
      data = result.data;

      const sqlGenerationTime = Date.now() - startSQLGeneration;
      console.log(`✅ Single Query Complete (${sqlGenerationTime}ms)`);
    }

    console.log("📜 Generated SQL:");
    console.log("   " + sql.split("\n").join("\n   "));
    console.log("📦 Query Results:", `${data.length} rows`);
    if (data.length > 0 && data.length <= 3) {
      console.log("   Sample data:", JSON.stringify(data, null, 2));
    }

    // Step 4: Chart Type Inference
    console.log("\n📈 Step 4: Chart Type Inference");
    const chartConfig = inferChartType(data, userQuestion);
    console.log("✅ Chart Type Selected:", chartConfig.type);
    if (chartConfig.xKey && chartConfig.yKey) {
      console.log(`   X-axis: ${chartConfig.xKey}, Y-axis: ${chartConfig.yKey}`);
    }

    // Step 5: Generate Natural Language Response
    console.log("\n💬 Step 5: Generating Natural Language Response");
    const startResponse = Date.now();
    const content = await generateNaturalResponse(
      userQuestion,
      data,
      chartConfig,
      conversationHistory
    );
    const responseTime = Date.now() - startResponse;
    console.log(`✅ Response Generated (${responseTime}ms)`);
    console.log("   Response:", content);

    // Step 6: Format data for chart
    console.log("\n🎨 Step 6: Formatting Data for Chart");
    const formattedData = formatDataForChart(data, chartConfig);
    console.log(`✅ Data Formatted: ${formattedData.length} rows`);

    // Build response
    const response: ProcessedMessage = {
      content,
      charts:
        data.length > 0
          ? [
              {
                type: chartConfig.type,
                data: formattedData,
                config:
                  chartConfig.xKey && chartConfig.yKey
                    ? {
                        xKey: chartConfig.xKey.replace("_cents", ""),
                        yKey: chartConfig.yKey.replace("_cents", ""),
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

    console.log("\n✨ C3 Processing Complete!");
    console.log(`⏱️  Total Request Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log("========================================\n");

    return response;
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;

    console.error("\n❌ Error processing user message:");
    console.error(error);
    console.log(`⏱️  Request failed after ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log("========================================\n");
    return {
      content: generateErrorMessage(error),
    };
  }
}

async function generateNaturalResponse(
  question: string,
  data: Record<string, unknown>[],
  chartConfig: ChartConfig,
  conversationHistory: ConversationMessage[]
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

Write a brief, natural language response (1-2 sentences) that directly answers the current question.
Be specific with numbers and names. Convert any cents values to dollars (divide by 100).
If relevant, reference previous conversation context.`;

  return generateTextResponse(RESPONSE_GENERATION_SYSTEM_PROMPT, prompt, {
    temperature: 0.3,
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
