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

const TEMPERATURES = [0.0, 0.3, 0.5]; // 3 candidates: deterministic, medium, creative

export async function selfConsistencyVote(
  userQuestion: string,
  linkedSchema: LinkedSchema,
  candidateCount: number = 3
): Promise<ConsistencyResult> {
  const votingStartTime = Date.now();
  const candidates: string[] = [];

  const numCandidates = Math.min(candidateCount, TEMPERATURES.length);
  console.log(`   🔄 Generating ${numCandidates} SQL candidates in parallel...`);
  const generationStartTime = Date.now();

  // Generate multiple SQL candidates with varying temperatures in parallel
  const candidatePromises = TEMPERATURES.slice(0, numCandidates).map(
    async (temperature, i) => {
      try {
        console.log(`      Candidate ${i + 1}: temperature=${temperature}`);
        const sql = await generateSQL(userQuestion, linkedSchema, temperature);
        if (isReadOnlyQuery(sql)) {
          console.log(`      ✓ Candidate ${i + 1} valid`);
          return sql;
        } else {
          console.log(`      ✗ Candidate ${i + 1} rejected (not read-only)`);
          console.log(`         SQL: ${sql}`);
          return null;
        }
      } catch (error) {
        console.error(
          `      ✗ Candidate ${i + 1} failed:`,
          error instanceof Error ? error.message : error
        );
        return null;
      }
    }
  );

  const results = await Promise.all(candidatePromises);
  candidates.push(...results.filter((sql): sql is string => sql !== null));

  const generationTime = Date.now() - generationStartTime;
  console.log(`   📝 Generated ${candidates.length} valid SQL candidates (${generationTime}ms)`);

  if (candidates.length === 0)
    throw new Error("Failed to generate any valid SQL candidates");

  // Execute each candidate and collect results
  const executionStartTime = Date.now();
  console.log(`   ⚡ Executing ${candidates.length} SQL queries...`);

  const resultGroups = new Map<
    string,
    { sql: string; result: Record<string, unknown>[] }[]
  >();

  let successfulExecutions = 0;

  for (let i = 0; i < candidates.length; i++) {
    const sql = candidates[i];
    try {
      console.log(`      Executing query ${i + 1}/${candidates.length}...`);
      const result = await executeQuery<Record<string, unknown>>(sql);
      successfulExecutions++;

      // Use stringified result as the grouping key
      const resultKey = JSON.stringify(result);

      if (!resultGroups.has(resultKey)) {
        resultGroups.set(resultKey, []);
        console.log(`      ✓ New result group (${result.length} rows)`);
      } else {
        console.log(`      ✓ Matched existing group (${result.length} rows)`);
      }
      resultGroups.get(resultKey)!.push({ sql, result });
    } catch (error) {
      console.warn(`      ✗ SQL execution failed:`, error);
    }
  }

  const executionTime = Date.now() - executionStartTime;
  console.log(`   📊 Execution complete: ${successfulExecutions}/${candidates.length} successful, ${resultGroups.size} unique result(s) (${executionTime}ms)`);

  if (resultGroups.size === 0)
    throw new Error("All SQL candidates failed execution");

  // Find the largest group (most common result)
  console.log(`   🗳️  Voting on results...`);

  let bestGroup: { sql: string; result: Record<string, unknown>[] }[] = [];
  let maxCount = 0;
  let groupIndex = 1;

  for (const [, group] of resultGroups) {
    console.log(`      Group ${groupIndex}: ${group.length} vote(s)`);
    if (group.length > maxCount) {
      maxCount = group.length;
      bestGroup = group;
    }
    groupIndex++;
  }

  // Select the first SQL from the best group (typically the one with lowest temperature)
  const selected = bestGroup[0];
  const confidence = maxCount / successfulExecutions;

  const totalVotingTime = Date.now() - votingStartTime;
  console.log(`   🏆 Winner selected: ${maxCount}/${successfulExecutions} votes (${(confidence * 100).toFixed(1)}% confidence)`);
  console.log(`   ⏱️  Self-consistency voting total time: ${totalVotingTime}ms (${(totalVotingTime / 1000).toFixed(2)}s)`);

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
    console.error("❌ Generated SQL is not a read-only query:");
    console.error(`   SQL: ${sql}`);
    throw new Error("Generated SQL is not a read-only query");
  }

  const data = await executeQuery<Record<string, unknown>>(sql);
  return { sql, data };
}
