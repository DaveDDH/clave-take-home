import { describe, it, expect } from '@jest/globals';
import { REASONING_TO_CANDIDATES } from './types.js';
import type { ChartData, ProcessedMessage, ProcessOptions, ConversationMessage, ReasoningLevel } from './types.js';

describe('types', () => {
  describe('REASONING_TO_CANDIDATES', () => {
    it('maps low to 1 candidate', () => {
      expect(REASONING_TO_CANDIDATES.low).toBe(1);
    });

    it('maps medium to 2 candidates', () => {
      expect(REASONING_TO_CANDIDATES.medium).toBe(2);
    });

    it('maps high to 3 candidates', () => {
      expect(REASONING_TO_CANDIDATES.high).toBe(3);
    });

    it('has all reasoning levels', () => {
      const levels: ReasoningLevel[] = ['low', 'medium', 'high'];
      levels.forEach((level) => {
        expect(REASONING_TO_CANDIDATES[level]).toBeDefined();
      });
    });
  });

  describe('type definitions', () => {
    it('ChartData can be instantiated', () => {
      const chartData: ChartData = {
        type: 'bar',
        data: [{ name: 'A', value: 100 }],
        config: { xKey: 'name', yKey: 'value' },
      };
      expect(chartData.type).toBe('bar');
      expect(chartData.data).toHaveLength(1);
    });

    it('ProcessedMessage can be instantiated', () => {
      const message: ProcessedMessage = {
        content: 'Test content',
        charts: [],
        sql: 'SELECT 1',
      };
      expect(message.content).toBe('Test content');
    });

    it('ProcessOptions can be instantiated', () => {
      const options: ProcessOptions = {
        useConsistency: true,
        debug: false,
        model: 'gpt-oss-20b',
        reasoningLevel: 'medium',
      };
      expect(options.useConsistency).toBe(true);
    });

    it('ConversationMessage can be instantiated', () => {
      const msg: ConversationMessage = {
        role: 'user',
        content: 'Hello',
      };
      expect(msg.role).toBe('user');
    });
  });
});
