import { jest, describe, it, expect } from '@jest/globals';
import { calculateCost, CostAccumulator } from './cost.js';
import type { TokenUsage } from './cost.js';

// Mock the logger to avoid console output during tests
jest.mock('./logger.js', () => ({
  log: jest.fn(),
}));

describe('calculateCost', () => {
  it('calculates cost for grok-4.1-fast model', () => {
    const usage: TokenUsage = {
      promptTokens: 1000,
      completionTokens: 500,
    };

    const result = calculateCost('grok-4.1-fast', usage);

    // grok-4.1-fast: input $0.20/1M, output $0.50/1M
    expect(result.inputCost).toBeCloseTo(0.0002, 6); // 1000 / 1M * 0.20
    expect(result.outputCost).toBeCloseTo(0.00025, 6); // 500 / 1M * 0.50
    expect(result.cachedCost).toBe(0);
    expect(result.totalCost).toBeCloseTo(0.00045, 6);
  });

  it('calculates cost for gpt-5.2 model', () => {
    const usage: TokenUsage = {
      promptTokens: 1000,
      completionTokens: 500,
    };

    const result = calculateCost('gpt-5.2', usage);

    // gpt-5.2: input $1.75/1M, output $14.0/1M
    expect(result.inputCost).toBeCloseTo(0.00175, 6); // 1000 / 1M * 1.75
    expect(result.outputCost).toBeCloseTo(0.007, 6); // 500 / 1M * 14.0
    expect(result.cachedCost).toBe(0);
    expect(result.totalCost).toBeCloseTo(0.00875, 6);
  });

  it('calculates cost for gpt-oss-20b model', () => {
    const usage: TokenUsage = {
      promptTokens: 1000,
      completionTokens: 500,
    };

    const result = calculateCost('gpt-oss-20b', usage);

    // gpt-oss-20b: input $0.075/1M, output $0.30/1M
    expect(result.inputCost).toBeCloseTo(0.000075, 6); // 1000 / 1M * 0.075
    expect(result.outputCost).toBeCloseTo(0.00015, 6); // 500 / 1M * 0.30
    expect(result.cachedCost).toBe(0);
    expect(result.totalCost).toBeCloseTo(0.000225, 6);
  });

  it('handles cached tokens correctly', () => {
    const usage: TokenUsage = {
      promptTokens: 1000,
      completionTokens: 500,
      cachedTokens: 400,
    };

    const result = calculateCost('grok-4.1-fast', usage);

    // grok-4.1-fast: input $0.20/1M, cached $0.05/1M, output $0.50/1M
    // inputTokens = 1000 - 400 = 600
    expect(result.inputCost).toBeCloseTo(0.00012, 6); // 600 / 1M * 0.20
    expect(result.cachedCost).toBeCloseTo(0.00002, 6); // 400 / 1M * 0.05
    expect(result.outputCost).toBeCloseTo(0.00025, 6); // 500 / 1M * 0.50
    expect(result.totalCost).toBeCloseTo(0.00039, 6);
  });

  it('handles zero tokens', () => {
    const usage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
    };

    const result = calculateCost('grok-4.1-fast', usage);

    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
    expect(result.cachedCost).toBe(0);
    expect(result.totalCost).toBe(0);
  });
});

describe('CostAccumulator', () => {
  it('starts with zero cost and no calls', () => {
    const accumulator = new CostAccumulator();

    expect(accumulator.getTotalCost()).toBe(0);
    expect(accumulator.getCallCount()).toBe(0);
  });

  it('accumulates costs from multiple calls', () => {
    const accumulator = new CostAccumulator();

    accumulator.addUsage('grok-4.1-fast', { promptTokens: 1000, completionTokens: 500 });
    accumulator.addUsage('gpt-5.2', { promptTokens: 1000, completionTokens: 500 });

    expect(accumulator.getCallCount()).toBe(2);
    // grok-4.1-fast total: ~0.00045 + gpt-5.2 total: ~0.00875 = ~0.0092
    expect(accumulator.getTotalCost()).toBeCloseTo(0.0092, 4);
  });

  it('returns correct total tokens', () => {
    const accumulator = new CostAccumulator();

    accumulator.addUsage('grok-4.1-fast', { promptTokens: 1000, completionTokens: 500, cachedTokens: 200 });
    accumulator.addUsage('gpt-5.2', { promptTokens: 2000, completionTokens: 1000, cachedTokens: 500 });

    const tokens = accumulator.getTotalTokens();

    expect(tokens.input).toBe(800 + 1500); // (1000-200) + (2000-500)
    expect(tokens.cached).toBe(700); // 200 + 500
    expect(tokens.output).toBe(1500); // 500 + 1000
    expect(tokens.total).toBe(800 + 1500 + 700 + 1500); // input + cached + output
  });

  it('returns correct cost breakdown', () => {
    const accumulator = new CostAccumulator();

    accumulator.addUsage('grok-4.1-fast', { promptTokens: 1000000, completionTokens: 0 });

    const breakdown = accumulator.getTotalCostBreakdown();

    // grok-4.1-fast: input $0.20/1M tokens
    expect(breakdown.inputCost).toBeCloseTo(0.2, 4);
    expect(breakdown.outputCost).toBe(0);
    expect(breakdown.cachedCost).toBe(0);
    expect(breakdown.totalCost).toBeCloseTo(0.2, 4);
  });
});
