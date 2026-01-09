import { generateTextResponse } from "#ai/models/index.js";
import type { ModelId } from "#ai/models/index.js";
import { LinkedSchema, formatLinkedSchema } from "./schema-linking.js";
import { getCalibrationSystemPrompt } from "./prompt.js";
import type { DataContext } from "./data-context.js";
import type { TokenUsage } from "#utils/cost.js";

export interface SQLGenerationResult {
  sql: string;
  usage: TokenUsage;
  model: ModelId;
}

export async function generateSQL(
  userQuestion: string,
  linkedSchema: LinkedSchema,
  temperature: number = 0.0,
  conversationHistory: Array<{ role: string; content: string }> = [],
  dataContext: DataContext | undefined,
  model: ModelId,
  processId?: string
): Promise<SQLGenerationResult> {
  const schemaSection = formatLinkedSchema(linkedSchema);

  const dateAndTime = new Date().toISOString().replace(
    "Z",
    ((_m) => {
      const o = -new Date().getTimezoneOffset();
      return (
        (o >= 0 ? "+" : "-") +
        String(Math.floor(Math.abs(o) / 60)).padStart(2, "0") +
        ":" +
        String(Math.abs(o) % 60).padStart(2, "0")
      );
    })()
  );

  // Include conversation context if there's history
  let conversationContext = "";
  if (conversationHistory.length > 1) {
    const previousMessages = conversationHistory.slice(0, -1);
    conversationContext = `Previous conversation:\n${previousMessages
      .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n")}\n\n`;
  }

  // Include data availability context
  let dataAvailability = "";
  if (dataContext?.orderDateRange) {
    const earliest = new Date(dataContext.orderDateRange.earliest).toISOString().split("T")[0];
    const latest = new Date(dataContext.orderDateRange.latest).toISOString().split("T")[0];
    const earliestDate = new Date(dataContext.orderDateRange.earliest);
    const monthName = earliestDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    dataAvailability = `\nIMPORTANT - Available data range: ${earliest} to ${latest}
When interpreting time references:
- "the 3rd", "yesterday", "last week" → interpret within this data range (${earliest} to ${latest}), NOT the current date
- "first week ever", "first month ever" → means the earliest week/month in the data (starting ${earliest})
- "first month" → means ${monthName}
- The data spans from ${earliest} to ${latest}, so use dates within this range
`;
  }

  const userPrompt = `${schemaSection}
#
${conversationContext}### Complete PostgreSQL query only and with no explanation.
### Current user question: ${userQuestion}

IMPORTANT - For ranking/comparison queries (top, highest, best, etc.):
- ALWAYS include BOTH the identifier (name, category) AND the metric (sales, count, etc.) in SELECT
- Example: "highest sales by location" → SELECT l.name, SUM(o.total_cents) / 100.0 AS sales
- Do NOT just SELECT the identifier and ORDER BY the metric - include both!
- For visualization: return ALL relevant rows (not just LIMIT 1), ordered by the metric
- Example: Instead of "LIMIT 1", return all locations ordered by sales DESC for comparison

You MUST reply with ONLY a PLAIN TEXT SQL string
Consider the conversation history to understand what the user is asking for.
${dataAvailability}
Current date and time: ${dateAndTime}
`;

  const response = await generateTextResponse(
    model,
    await getCalibrationSystemPrompt(),
    userPrompt,
    { temperature, label: "SQL Generation", processId }
  );

  return {
    sql: cleanSQL(response.result),
    usage: response.usage,
    model: response.model,
  };
}

function cleanSQL(raw: string): string {
  let sql = raw.trim();

  // Remove markdown code blocks if present
  sql = sql.replaceAll(/```sql\n?/gi, "").replaceAll(/```\n?/g, "");

  // If response doesn't start with SELECT or WITH (CTE), prepend SELECT
  const normalized = sql.toUpperCase();
  if (!normalized.startsWith("SELECT") && !normalized.startsWith("WITH")) {
    sql = "SELECT " + sql;
  }

  // Find the end of the SQL query (semicolon or end of SELECT statement)
  // Remove any explanation text after the query
  const lines = sql.split("\n");
  const sqlLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Stop if we hit an explanation or comment that's not part of SQL
    if (trimmed.startsWith("--") && !trimmed.toLowerCase().includes("select")) {
      // Check if this looks like an explanation rather than a SQL comment
      if (trimmed.includes("explanation") || trimmed.includes("note:")) break;
    }
    if (
      trimmed.toLowerCase().startsWith("note:") ||
      trimmed.toLowerCase().startsWith("explanation:")
    ) {
      break;
    }
    sqlLines.push(line);
  }

  sql = sqlLines.join("\n").trim();

  // Remove trailing semicolons for consistency
  sql = sql.replace(/;\s*$/, "");

  return sql;
}
