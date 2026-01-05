import { generateTextResponse } from "#ai/models/xai/index.js";
import { LinkedSchema, formatLinkedSchema } from "./schema-linking.js";
import { CALIBRATION_SYSTEM_PROMPT } from "./prompt.js";

export async function generateSQL(
  userQuestion: string,
  linkedSchema: LinkedSchema,
  temperature: number = 0.0
): Promise<string> {
  const schemaSection = formatLinkedSchema(linkedSchema);

  const userPrompt = `${schemaSection}
#
### Complete PostgreSQL query only and with no explanation,
### and do not select extra columns that are not explicitly requested in the query.
### ${userQuestion}
SELECT`;

  const response = await generateTextResponse(
    CALIBRATION_SYSTEM_PROMPT,
    userPrompt,
    { temperature }
  );

  return cleanSQL(response);
}

function cleanSQL(raw: string): string {
  let sql = raw.trim();

  // If response doesn't start with SELECT, prepend it
  if (!sql.toUpperCase().startsWith("SELECT")) {
    sql = "SELECT " + sql;
  }

  // Remove markdown code blocks if present
  sql = sql.replace(/```sql\n?/gi, "").replace(/```\n?/g, "");

  // Find the end of the SQL query (semicolon or end of SELECT statement)
  // Remove any explanation text after the query
  const lines = sql.split("\n");
  const sqlLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Stop if we hit an explanation or comment that's not part of SQL
    if (
      trimmed.startsWith("--") &&
      !trimmed.toLowerCase().includes("select")
    ) {
      // Check if this looks like an explanation rather than a SQL comment
      if (trimmed.includes("explanation") || trimmed.includes("note:")) {
        break;
      }
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
