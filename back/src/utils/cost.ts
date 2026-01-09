import type { ModelId } from "#ai/models/index.js";
import { log } from "#utils/logger.js";

// Token usage from a single LLM call
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
}

// Cost calculation result
export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cachedCost: number;
  totalCost: number;
}

// Pricing per 1M tokens (in dollars)
const MODEL_PRICING: Record<ModelId, { input: number; cached: number; output: number }> = {
  "grok-4.1-fast": { input: 0.2, cached: 0.05, output: 0.5 },
  "gpt-5.2": { input: 1.75, cached: 0.175, output: 14 },
  "gpt-oss-20b": { input: 0.075, cached: 0.075, output: 0.3 },
};

export function calculateCost(model: ModelId, usage: TokenUsage): CostBreakdown {
  const pricing = MODEL_PRICING[model];
  const cachedTokens = usage.cachedTokens ?? 0;
  const inputTokens = usage.promptTokens - cachedTokens;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const cachedCost = (cachedTokens / 1_000_000) * pricing.cached;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.output;

  return {
    inputCost,
    outputCost,
    cachedCost,
    totalCost: inputCost + cachedCost + outputCost,
  };
}

// Format cost in dollars with appropriate precision
function formatCost(cost: number): string {
  if (cost < 0.0001) return "$0.0000";
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

// Format token count with commas
function formatTokens(count: number): string {
  return count.toLocaleString();
}

interface CostEntry {
  label: string;
  model: ModelId;
  usage: TokenUsage;
  cost: CostBreakdown;
}

// Cost accumulator class for tracking across multiple calls
export class CostAccumulator {
  private readonly costs: CostEntry[] = [];
  private readonly processId?: string;

  constructor(processId?: string) {
    this.processId = processId;
  }

  addUsage(model: ModelId, usage: TokenUsage, label?: string): void {
    const cost = calculateCost(model, usage);
    const entryLabel = label || `LLM Call #${this.costs.length + 1}`;
    this.costs.push({ label: entryLabel, model, usage, cost });

    // Log detailed cost breakdown
    const cachedTokens = usage.cachedTokens ?? 0;
    const inputTokens = usage.promptTokens - cachedTokens;

    log(`   💰 [Cost] ${entryLabel}`, undefined, this.processId);
    log(`      Model: ${model}`, undefined, this.processId);
    log(`      Tokens: ${formatTokens(inputTokens)} input + ${formatTokens(cachedTokens)} cached + ${formatTokens(usage.completionTokens)} output = ${formatTokens(usage.promptTokens + usage.completionTokens)} total`, undefined, this.processId);
    log(`      Cost: ${formatCost(cost.inputCost)} input + ${formatCost(cost.cachedCost)} cached + ${formatCost(cost.outputCost)} output = ${formatCost(cost.totalCost)}`, undefined, this.processId);
    log(`      Running Total: ${formatCost(this.getTotalCost())} (${this.costs.length} calls)`, undefined, this.processId);
  }

  getTotalCost(): number {
    return this.costs.reduce((sum, c) => sum + c.cost.totalCost, 0);
  }

  getCallCount(): number {
    return this.costs.length;
  }

  getTotalTokens(): { input: number; cached: number; output: number; total: number } {
    const input = this.costs.reduce((sum, c) => {
      const cached = c.usage.cachedTokens ?? 0;
      return sum + (c.usage.promptTokens - cached);
    }, 0);
    const cached = this.costs.reduce((sum, c) => sum + (c.usage.cachedTokens ?? 0), 0);
    const output = this.costs.reduce((sum, c) => sum + c.usage.completionTokens, 0);
    return { input, cached, output, total: input + cached + output };
  }

  getTotalCostBreakdown(): CostBreakdown {
    return {
      inputCost: this.costs.reduce((sum, c) => sum + c.cost.inputCost, 0),
      cachedCost: this.costs.reduce((sum, c) => sum + c.cost.cachedCost, 0),
      outputCost: this.costs.reduce((sum, c) => sum + c.cost.outputCost, 0),
      totalCost: this.getTotalCost(),
    };
  }

  logSummary(): void {
    if (this.costs.length === 0) {
      log(`   💰 [Cost Summary] No LLM calls recorded`, undefined, this.processId);
      return;
    }

    const tokens = this.getTotalTokens();
    const costBreakdown = this.getTotalCostBreakdown();

    log(`\n   💰 ═══════════════════════════════════════`, undefined, this.processId);
    log(`   💰 COST SUMMARY`, undefined, this.processId);
    log(`   💰 ═══════════════════════════════════════`, undefined, this.processId);
    log(`   💰 LLM Calls: ${this.costs.length}`, undefined, this.processId);

    // Log each call
    this.costs.forEach((entry, i) => {
      const cachedTokens = entry.usage.cachedTokens ?? 0;
      const inputTokens = entry.usage.promptTokens - cachedTokens;
      log(`   💰   ${i + 1}. ${entry.label} (${entry.model}): ${formatTokens(inputTokens + cachedTokens + entry.usage.completionTokens)} tokens → ${formatCost(entry.cost.totalCost)}`, undefined, this.processId);
    });

    log(`   💰 ───────────────────────────────────────`, undefined, this.processId);
    log(`   💰 Total Tokens:`, undefined, this.processId);
    log(`   💰   Input:  ${formatTokens(tokens.input)}`, undefined, this.processId);
    log(`   💰   Cached: ${formatTokens(tokens.cached)}`, undefined, this.processId);
    log(`   💰   Output: ${formatTokens(tokens.output)}`, undefined, this.processId);
    log(`   💰   Total:  ${formatTokens(tokens.total)}`, undefined, this.processId);
    log(`   💰 ───────────────────────────────────────`, undefined, this.processId);
    log(`   💰 Total Cost:`, undefined, this.processId);
    log(`   💰   Input:  ${formatCost(costBreakdown.inputCost)}`, undefined, this.processId);
    log(`   💰   Cached: ${formatCost(costBreakdown.cachedCost)}`, undefined, this.processId);
    log(`   💰   Output: ${formatCost(costBreakdown.outputCost)}`, undefined, this.processId);
    log(`   💰   ════════════════════`, undefined, this.processId);
    log(`   💰   TOTAL:  ${formatCost(costBreakdown.totalCost)}`, undefined, this.processId);
    log(`   💰 ═══════════════════════════════════════\n`, undefined, this.processId);
  }
}
