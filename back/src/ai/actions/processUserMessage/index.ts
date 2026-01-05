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

export async function processUserMessage(
  userQuestion: string,
  options: ProcessOptions = {}
): Promise<ProcessedMessage> {
  const { useConsistency = true, debug = false } = options;

  try {
    // Step 1: Schema Linking (CP - Clear Context)
    const linkedSchema = await linkSchema(userQuestion);

    // Step 2 & 3: SQL Generation + Consistency (CP + CH + CO)
    let sql: string;
    let data: Record<string, unknown>[];
    let confidence: number | undefined;
    let candidateCount: number | undefined;
    let successfulExecutions: number | undefined;

    if (useConsistency) {
      const result = await selfConsistencyVote(userQuestion, linkedSchema, 5);
      sql = result.sql;
      data = result.data;
      confidence = result.confidence;
      candidateCount = result.candidateCount;
      successfulExecutions = result.successfulExecutions;
    } else {
      const result = await singleQuery(userQuestion, linkedSchema);
      sql = result.sql;
      data = result.data;
    }

    // Step 4: Chart Type Inference
    const chartConfig = inferChartType(data, userQuestion);

    // Step 5: Generate Natural Language Response
    const content = await generateNaturalResponse(
      userQuestion,
      data,
      chartConfig
    );

    // Step 6: Format data for chart
    const formattedData = formatDataForChart(data, chartConfig);

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

    return response;
  } catch (error) {
    console.error("Error processing user message:", error);
    return {
      content: generateErrorMessage(error),
    };
  }
}

async function generateNaturalResponse(
  question: string,
  data: Record<string, unknown>[],
  chartConfig: ChartConfig
): Promise<string> {
  if (data.length === 0) {
    return "I couldn't find any data matching your query. Please try rephrasing your question or check if the data exists for the criteria you specified.";
  }

  const summary = summarizeData(data, chartConfig);

  const prompt = `Given this user question about restaurant analytics:
"${question}"

And this data summary:
${summary}

Write a brief, natural language response (1-2 sentences) that directly answers the question.
Be specific with numbers and names. Convert any cents values to dollars (divide by 100).`;

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
