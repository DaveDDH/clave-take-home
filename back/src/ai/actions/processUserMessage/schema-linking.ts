import { z } from "zod";
import { generateObjectResponse } from "#ai/models/xai/index.js";
import { FULL_SCHEMA } from "#db/schema.js";
import { SCHEMA_LINKING_SYSTEM_PROMPT } from "./prompt.js";

const LinkedTableSchema = z.object({
  name: z.string(),
  columns: z.array(z.string()),
});

const LinkedSchemaSchema = z.object({
  tables: z.array(LinkedTableSchema),
  foreignKeys: z.array(z.string()),
});

export type LinkedTable = z.infer<typeof LinkedTableSchema>;
export type LinkedSchema = z.infer<typeof LinkedSchemaSchema>;

export async function linkSchema(userQuestion: string): Promise<LinkedSchema> {
  const prompt = `Given this database schema for a restaurant analytics system:

${FULL_SCHEMA}

And this user question:
"${userQuestion}"

Identify the relevant tables and columns needed to write a SQL query.
Think about:
- What data is being asked for?
- What filters might be needed?
- What tables need to be joined?

Output the tables and their relevant columns, plus any foreign keys needed for JOINs.`;

  return generateObjectResponse(
    SCHEMA_LINKING_SYSTEM_PROMPT,
    prompt,
    LinkedSchemaSchema,
    { temperature: 0.0 }
  );
}

export function formatLinkedSchema(linked: LinkedSchema): string {
  let result = "### PostgreSQL tables, with their properties:\n#\n";

  for (const table of linked.tables) {
    result += `# ${table.name} (${table.columns.join(", ")})\n`;
  }

  if (linked.foreignKeys.length > 0) {
    result += "#\n### Foreign keys:\n";
    for (const fk of linked.foreignKeys) {
      result += `# ${fk}\n`;
    }
  }

  return result;
}
