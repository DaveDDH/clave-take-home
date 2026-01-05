import { generateTextResponse } from "#ai/models/xai/index.js";
import { LinkedSchema, formatLinkedSchema } from "./schema-linking.js";
import { CALIBRATION_SYSTEM_PROMPT } from "./prompt.js";

export async function generateSQL(
  userQuestion: string,
  linkedSchema: LinkedSchema,
  temperature: number = 0.0,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<string> {
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

  const userPrompt = `${schemaSection}
#
${conversationContext}### Complete PostgreSQL query only and with no explanation,
### and do not select extra columns that are not explicitly requested in the query.
### Current user question: ${userQuestion}

You MUST reply with ONLY a PLAIN TEXT SQL string
Consider the conversation history to understand what the user is asking for.

Current date and time: ${dateAndTime}
`;

  const response = await generateTextResponse(
    CALIBRATION_SYSTEM_PROMPT,
    userPrompt,
    { temperature }
  );

  return cleanSQL(response);
}

function cleanSQL(raw: string): string {
  let sql = raw.trim();

  // Remove markdown code blocks if present
  sql = sql.replace(/```sql\n?/gi, "").replace(/```\n?/g, "");

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
