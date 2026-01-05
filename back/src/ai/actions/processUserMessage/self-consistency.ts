import { executeQuery, isReadOnlyQuery } from "#db/index.js";
import { generateSQL } from "./sql-generation.js";
import { LinkedSchema } from "./schema-linking.js";
import type { DataContext } from "./data-context.js";
import { log, logError, logWarn } from "#utils/logger.js";

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
  candidateCount: number = 3,
  conversationHistory: Array<{ role: string; content: string }> = [],
  dataContext?: DataContext,
  processId?: string
): Promise<ConsistencyResult> {
  const votingStartTime = Date.now();
  const candidates: string[] = [];

  const numCandidates = Math.min(candidateCount, TEMPERATURES.length);
  log(`   🔄 Generating ${numCandidates} SQL candidates in parallel...`, undefined, processId);
  const generationStartTime = Date.now();

  // Generate multiple SQL candidates with varying temperatures in parallel
  const candidatePromises = TEMPERATURES.slice(0, numCandidates).map(
    async (temperature, i) => {
      try {
        log(`      Candidate ${i + 1}: temperature=${temperature}`, undefined, processId);
        const sql = await generateSQL(userQuestion, linkedSchema, temperature, conversationHistory, dataContext);
        if (isReadOnlyQuery(sql)) {
          log(`      ✓ Candidate ${i + 1} valid`, undefined, processId);
          return sql;
        } else {
          log(`      ✗ Candidate ${i + 1} rejected (not read-only)`, undefined, processId);
          log(`         SQL: ${sql}`, undefined, processId);
          return null;
        }
      } catch (error) {
        logError(
          `      ✗ Candidate ${i + 1} failed:`,
          error instanceof Error ? error.message : error,
          processId
        );
        return null;
      }
    }
  );

  const results = await Promise.all(candidatePromises);
  candidates.push(...results.filter((sql): sql is string => sql !== null));

  const generationTime = Date.now() - generationStartTime;
  log(`   📝 Generated ${candidates.length} valid SQL candidates (${generationTime}ms)`, undefined, processId);

  if (candidates.length === 0)
    throw new Error("Failed to generate any valid SQL candidates");

  // Execute each candidate and collect results
  const executionStartTime = Date.now();
  log(`   ⚡ Executing ${candidates.length} SQL queries...`, undefined, processId);

  const resultGroups = new Map<
    string,
    { sql: string; result: Record<string, unknown>[] }[]
  >();

  let successfulExecutions = 0;

  for (let i = 0; i < candidates.length; i++) {
    const sql = candidates[i];
    try {
      log(`      Executing query ${i + 1}/${candidates.length}...`, undefined, processId);
      const result = await executeQuery<Record<string, unknown>>(sql);
      successfulExecutions++;

      // Use stringified result as the grouping key
      const resultKey = JSON.stringify(result);

      if (!resultGroups.has(resultKey)) {
        resultGroups.set(resultKey, []);
        log(`      ✓ New result group (${result.length} rows)`, undefined, processId);
      } else {
        log(`      ✓ Matched existing group (${result.length} rows)`, undefined, processId);
      }
      resultGroups.get(resultKey)!.push({ sql, result });
    } catch (error) {
      logWarn(`      ✗ SQL execution failed:`, error, processId);
    }
  }

  const executionTime = Date.now() - executionStartTime;
  log(`   📊 Execution complete: ${successfulExecutions}/${candidates.length} successful, ${resultGroups.size} unique result(s) (${executionTime}ms)`, undefined, processId);

  if (resultGroups.size === 0)
    throw new Error("All SQL candidates failed execution");

  // Find the largest group (most common result)
  log(`   🗳️  Voting on results...`, undefined, processId);

  let bestGroup: { sql: string; result: Record<string, unknown>[] }[] = [];
  let maxCount = 0;
  let groupIndex = 1;

  for (const [, group] of resultGroups) {
    log(`      Group ${groupIndex}: ${group.length} vote(s)`, undefined, processId);
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
  log(`   🏆 Winner selected: ${maxCount}/${successfulExecutions} votes (${(confidence * 100).toFixed(1)}% confidence)`, undefined, processId);
  log(`   ⏱️  Self-consistency voting total time: ${totalVotingTime}ms (${(totalVotingTime / 1000).toFixed(2)}s)`, undefined, processId);

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
  linkedSchema: LinkedSchema,
  conversationHistory: Array<{ role: string; content: string }> = [],
  dataContext?: DataContext,
  processId?: string
): Promise<{ sql: string; data: Record<string, unknown>[] }> {
  const sql = await generateSQL(userQuestion, linkedSchema, 0.0, conversationHistory, dataContext);

  if (!isReadOnlyQuery(sql)) {
    logError("❌ Generated SQL is not a read-only query:", undefined, processId);
    logError(`   SQL: ${sql}`, undefined, processId);
    throw new Error("Generated SQL is not a read-only query");
  }

  const data = await executeQuery<Record<string, unknown>>(sql);
  return { sql, data };
}
