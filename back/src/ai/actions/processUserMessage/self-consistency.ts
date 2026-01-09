import { executeQuery, isReadOnlyQuery } from "#db/index.js";
import { generateSQL } from "./sql-generation.js";
import { refineSQLWithError } from "./sql-refinement.js";
import { LinkedSchema } from "./schema-linking.js";
import type { DataContext } from "./data-context.js";
import { log, logError, logWarn } from "#utils/logger.js";
import type { ModelId } from "#ai/models/index.js";
import { CostAccumulator } from "#utils/cost.js";

export interface ConsistencyResult {
  sql: string;
  data: Record<string, unknown>[];
  confidence: number;
  candidateCount: number;
  successfulExecutions: number;
}

export interface SelfConsistencyOptions {
  userQuestion: string;
  linkedSchema: LinkedSchema;
  candidateCount?: number;
  conversationHistory?: Array<{ role: string; content: string }>;
  dataContext?: DataContext;
  model: ModelId;
  costAccumulator: CostAccumulator;
  processId?: string;
}

const TEMPERATURES = [0, 0.3, 0.5]; // 3 candidates: deterministic, medium, creative

type ResultGroup = { sql: string; result: Record<string, unknown>[] }[];

async function generateCandidate(
  options: SelfConsistencyOptions,
  temperature: number,
  index: number,
  history: Array<{ role: string; content: string }>
): Promise<string | null> {
  const { userQuestion, linkedSchema, dataContext, model, costAccumulator, processId } = options;

  try {
    log(`      Candidate ${index + 1}: temperature=${temperature}`, undefined, processId);
    const result = await generateSQL(userQuestion, linkedSchema, temperature, history, dataContext, model, processId);
    costAccumulator.addUsage(result.model, result.usage, `SQL Generation (Candidate ${index + 1}, temp=${temperature})`);

    if (isReadOnlyQuery(result.sql)) {
      log(`      ✓ Candidate ${index + 1} valid`, undefined, processId);
      return result.sql;
    }

    log(`      ✗ Candidate ${index + 1} rejected (not read-only)`, undefined, processId);
    log(`         SQL: ${result.sql}`, undefined, processId);
    return null;
  } catch (error) {
    logError(
      `      ✗ Candidate ${index + 1} failed:`,
      error instanceof Error ? error.message : error,
      processId
    );
    return null;
  }
}

async function tryRefineSQL(
  sql: string,
  errorMsg: string,
  options: SelfConsistencyOptions,
  queryIndex: number,
  resultGroups: Map<string, ResultGroup>
): Promise<{ success: boolean }> {
  const { userQuestion, linkedSchema, model, costAccumulator, processId } = options;

  try {
    const refinementResult = await refineSQLWithError(sql, errorMsg, userQuestion, linkedSchema, model, processId);
    costAccumulator.addUsage(refinementResult.model, refinementResult.usage, `SQL Refinement (Query ${queryIndex + 1})`);

    if (!isReadOnlyQuery(refinementResult.sql)) {
      logWarn(`      ✗ Refined SQL rejected (not read-only)`, undefined, processId);
      return { success: false };
    }

    const refinedResult = await executeQuery<Record<string, unknown>>(refinementResult.sql);
    const resultKey = JSON.stringify(refinedResult);

    if (resultGroups.has(resultKey)) {
      log(`      ✓ Refinement succeeded: matched existing group (${refinedResult.length} rows)`, undefined, processId);
    } else {
      resultGroups.set(resultKey, []);
      log(`      ✓ Refinement succeeded: new result group (${refinedResult.length} rows)`, undefined, processId);
    }
    resultGroups.get(resultKey)!.push({ sql: refinementResult.sql, result: refinedResult });
    return { success: true };
  } catch (refinementError) {
    const refineErrorMsg = refinementError instanceof Error ? refinementError.message : String(refinementError);
    logWarn(`      ✗ Refinement also failed:`, refineErrorMsg, processId);
    return { success: false };
  }
}

async function executeCandidate(
  sql: string,
  index: number,
  candidatesLength: number,
  options: SelfConsistencyOptions,
  resultGroups: Map<string, ResultGroup>
): Promise<boolean> {
  const { processId } = options;

  try {
    log(`      Executing query ${index + 1}/${candidatesLength}...`, undefined, processId);
    const result = await executeQuery<Record<string, unknown>>(sql);
    const resultKey = JSON.stringify(result);

    if (resultGroups.has(resultKey)) {
      log(`      ✓ Matched existing group (${result.length} rows)`, undefined, processId);
    } else {
      resultGroups.set(resultKey, []);
      log(`      ✓ New result group (${result.length} rows)`, undefined, processId);
    }
    resultGroups.get(resultKey)!.push({ sql, result });
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWarn(`      ✗ SQL execution failed:`, errorMsg, processId);

    const refinement = await tryRefineSQL(sql, errorMsg, options, index, resultGroups);
    return refinement.success;
  }
}

function findBestResultGroup(resultGroups: Map<string, ResultGroup>, processId?: string): ResultGroup {
  let bestGroup: ResultGroup = [];
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

  return bestGroup;
}

export async function selfConsistencyVote(options: SelfConsistencyOptions): Promise<ConsistencyResult> {
  const { candidateCount, conversationHistory, processId } = options;

  const count = candidateCount ?? 3;
  const history = conversationHistory ?? [];
  const votingStartTime = Date.now();

  const numCandidates = Math.min(count, TEMPERATURES.length);
  log(`   🔄 Generating ${numCandidates} SQL candidates in parallel...`, undefined, processId);
  const generationStartTime = Date.now();

  // Generate multiple SQL candidates with varying temperatures in parallel
  const candidatePromises = TEMPERATURES.slice(0, numCandidates).map(
    (temperature, i) => generateCandidate(options, temperature, i, history)
  );

  const results = await Promise.all(candidatePromises);
  const candidates = results.filter((sql): sql is string => sql !== null);

  const generationTime = Date.now() - generationStartTime;
  log(`   📝 Generated ${candidates.length} valid SQL candidates (${generationTime}ms)`, undefined, processId);

  if (candidates.length === 0) {
    throw new Error("Failed to generate any valid SQL candidates");
  }

  // Execute each candidate and collect results
  const executionStartTime = Date.now();
  log(`   ⚡ Executing ${candidates.length} SQL queries...`, undefined, processId);

  const resultGroups = new Map<string, ResultGroup>();
  let successfulExecutions = 0;

  for (let i = 0; i < candidates.length; i++) {
    const success = await executeCandidate(candidates[i], i, candidates.length, options, resultGroups);
    if (success) successfulExecutions++;
  }

  const executionTime = Date.now() - executionStartTime;
  log(`   📊 Execution complete: ${successfulExecutions}/${candidates.length} successful, ${resultGroups.size} unique result(s) (${executionTime}ms)`, undefined, processId);

  if (resultGroups.size === 0) {
    throw new Error("All SQL candidates failed execution");
  }

  // Find the largest group (most common result)
  log(`   🗳️  Voting on results...`, undefined, processId);
  const bestGroup = findBestResultGroup(resultGroups, processId);

  // Select the first SQL from the best group (typically the one with lowest temperature)
  const selected = bestGroup[0];
  const confidence = bestGroup.length / successfulExecutions;

  const totalVotingTime = Date.now() - votingStartTime;
  log(`   🏆 Winner selected: ${bestGroup.length}/${successfulExecutions} votes (${(confidence * 100).toFixed(1)}% confidence)`, undefined, processId);
  log(`   ⏱️  Self-consistency voting total time: ${totalVotingTime}ms (${(totalVotingTime / 1000).toFixed(2)}s)`, undefined, processId);

  return {
    sql: selected.sql,
    data: selected.result,
    confidence,
    candidateCount: candidates.length,
    successfulExecutions,
  };
}

export interface SingleQueryOptions {
  userQuestion: string;
  linkedSchema: LinkedSchema;
  conversationHistory?: Array<{ role: string; content: string }>;
  dataContext?: DataContext;
  model: ModelId;
  costAccumulator: CostAccumulator;
  processId?: string;
}

// Simplified version for faster response (single query)
export async function singleQuery(
  options: SingleQueryOptions
): Promise<{ sql: string; data: Record<string, unknown>[] }> {
  const { userQuestion, linkedSchema, conversationHistory, dataContext, model, costAccumulator, processId } = options;

  const history = conversationHistory ?? [];
  const result = await generateSQL(userQuestion, linkedSchema, 0, history, dataContext, model, processId);
  costAccumulator.addUsage(result.model, result.usage, "SQL Generation (Single Query)");

  if (!isReadOnlyQuery(result.sql)) {
    logError("❌ Generated SQL is not a read-only query:", undefined, processId);
    logError(`   SQL: ${result.sql}`, undefined, processId);
    throw new Error("Generated SQL is not a read-only query");
  }

  const data = await executeQuery<Record<string, unknown>>(result.sql);
  return { sql: result.sql, data };
}
