import type { ModelId } from "#ai/models/index.js";

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
  "grok-4.1-fast": { input: 0.20, cached: 0.05, output: 0.5 },
  "gpt-5.2": { input: 1.75, cached: 0.175, output: 14.0 },
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

// Cost accumulator class for tracking across multiple calls
export class CostAccumulator {
  private costs: { model: ModelId; usage: TokenUsage; cost: CostBreakdown }[] = [];

  addUsage(model: ModelId, usage: TokenUsage): void {
    const cost = calculateCost(model, usage);
    this.costs.push({ model, usage, cost });
  }

  getTotalCost(): number {
    return this.costs.reduce((sum, c) => sum + c.cost.totalCost, 0);
  }

  getCallCount(): number {
    return this.costs.length;
  }
}
