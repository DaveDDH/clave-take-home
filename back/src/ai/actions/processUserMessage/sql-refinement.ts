import { generateTextResponse } from "#ai/models/index.js";
import type { ModelId } from "#ai/models/index.js";
import { LinkedSchema, formatLinkedSchema } from "./schema-linking.js";
import { log, logError } from "#utils/logger.js";

const REFINEMENT_SYSTEM_PROMPT = `You are an expert PostgreSQL query debugger.
Your task is to fix SQL queries that failed execution.

IMPORTANT RULES:
1. Return ONLY the corrected SQL query, no explanation
2. Do not use markdown code blocks
3. Preserve the original query intent
4. Use exact column and table names from the provided schema
5. Ensure the query is read-only (SELECT/WITH only)`;

/**
 * Attempts to refine a failed SQL query using error feedback.
 * This implements iterative refinement - a technique where execution errors
 * are fed back to the LLM to generate corrected queries.
 */
export async function refineSQLWithError(
  originalSQL: string,
  errorMessage: string,
  userQuestion: string,
  linkedSchema: LinkedSchema,
  model: ModelId,
  processId?: string
): Promise<string> {
  const schemaSection = formatLinkedSchema(linkedSchema);

  const refinementPrompt = `The following PostgreSQL query failed with an error.

### Failed SQL:
${originalSQL}

### PostgreSQL Error:
${errorMessage}

### Original User Question:
"${userQuestion}"

### Available Database Schema:
${schemaSection}

### Common Error Fixes:
- "column X does not exist" → Check schema for correct column name (case-sensitive)
- "relation X does not exist" → Use correct table/view name from schema
- "syntax error" → Fix SQL syntax (missing comma, parenthesis, keyword)
- "division by zero" → Use NULLIF(divisor, 0) or CASE WHEN
- "ambiguous column" → Qualify with table alias (e.g., t.column_name)

Fix the SQL query to resolve this error. Return ONLY the corrected SQL:`;

  log(`   🔄 Attempting SQL refinement...`, undefined, processId);
  log(`      Error: ${errorMessage.slice(0, 100)}${errorMessage.length > 100 ? '...' : ''}`, undefined, processId);

  const response = await generateTextResponse(
    model,
    REFINEMENT_SYSTEM_PROMPT,
    refinementPrompt,
    { temperature: 0.0, label: "SQL Refinement", processId }
  );

  const refinedSQL = cleanRefinedSQL(response);

  log(`   ✓ Refinement generated`, undefined, processId);

  return refinedSQL;
}

/**
 * Cleans the refined SQL response, removing markdown artifacts and ensuring proper format.
 */
function cleanRefinedSQL(raw: string): string {
  let sql = raw.trim();

  // Remove markdown code blocks if present
  sql = sql.replace(/```sql\n?/gi, "").replace(/```\n?/g, "");

  // If response doesn't start with SELECT or WITH (CTE), prepend SELECT
  const normalized = sql.toUpperCase();
  if (!normalized.startsWith("SELECT") && !normalized.startsWith("WITH")) {
    sql = "SELECT " + sql;
  }

  // Remove any explanation text after the query
  const lines = sql.split("\n");
  const sqlLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.toLowerCase().startsWith("note:") ||
      trimmed.toLowerCase().startsWith("explanation:") ||
      trimmed.toLowerCase().startsWith("this query")
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
