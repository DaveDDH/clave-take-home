import { executeQuery, isReadOnlyQuery } from "#db/index.js";
import { generateSQL } from "./sql-generation.js";
import { LinkedSchema } from "./schema-linking.js";

export interface ConsistencyResult {
  sql: string;
  data: Record<string, unknown>[];
  confidence: number;
  candidateCount: number;
  successfulExecutions: number;
}

const TEMPERATURES = [0.0, 0.2, 0.3, 0.4, 0.5];

export async function selfConsistencyVote(
  userQuestion: string,
  linkedSchema: LinkedSchema,
  candidateCount: number = 5
): Promise<ConsistencyResult> {
  const candidates: string[] = [];

  // Generate multiple SQL candidates with varying temperatures
  for (let i = 0; i < Math.min(candidateCount, TEMPERATURES.length); i++) {
    try {
      const sql = await generateSQL(
        userQuestion,
        linkedSchema,
        TEMPERATURES[i]
      );
      if (isReadOnlyQuery(sql)) candidates.push(sql);
    } catch (error) {
      console.error(`Failed to generate SQL candidate ${i}:`, error);
    }
  }

  if (candidates.length === 0)
    throw new Error("Failed to generate any valid SQL candidates");

  // Execute each candidate and collect results
  const resultGroups = new Map<
    string,
    { sql: string; result: Record<string, unknown>[] }[]
  >();

  let successfulExecutions = 0;

  for (const sql of candidates) {
    try {
      const result = await executeQuery<Record<string, unknown>>(sql);
      successfulExecutions++;

      // Use stringified result as the grouping key
      const resultKey = JSON.stringify(result);

      if (!resultGroups.has(resultKey)) resultGroups.set(resultKey, []);
      resultGroups.get(resultKey)!.push({ sql, result });
    } catch (error) {
      console.warn(`SQL execution failed: ${sql}`, error);
    }
  }

  if (resultGroups.size === 0)
    throw new Error("All SQL candidates failed execution");

  // Find the largest group (most common result)
  let bestGroup: { sql: string; result: Record<string, unknown>[] }[] = [];
  let maxCount = 0;

  for (const [, group] of resultGroups) {
    if (group.length > maxCount) {
      maxCount = group.length;
      bestGroup = group;
    }
  }

  // Select the first SQL from the best group (typically the one with lowest temperature)
  const selected = bestGroup[0];
  const confidence = maxCount / successfulExecutions;

  return {
    sql: selected.sql,
    data: selected.result,
    confidence,
    candidateCount: candidates.length,
    successfulExecutions,
  };
}

// Simplified version for faster response (single query)
export async function singleQuery(
  userQuestion: string,
  linkedSchema: LinkedSchema
): Promise<{ sql: string; data: Record<string, unknown>[] }> {
  const sql = await generateSQL(userQuestion, linkedSchema, 0.0);

  if (!isReadOnlyQuery(sql)) {
    throw new Error("Generated SQL is not a read-only query");
  }

  const data = await executeQuery<Record<string, unknown>>(sql);
  return { sql, data };
}
