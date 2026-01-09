import { describe, it, expect } from '@jest/globals';
import { MODEL_IDS, DEFAULT_MODEL, AVAILABLE_MODELS } from './index.js';
import type { ModelId } from './index.js';

describe('ai/models', () => {
  describe('MODEL_IDS', () => {
    it('is an array of model IDs', () => {
      expect(Array.isArray(MODEL_IDS)).toBe(true);
      expect(MODEL_IDS.length).toBeGreaterThan(0);
    });

    it('contains expected models', () => {
      expect(MODEL_IDS).toContain('gpt-oss-20b');
      expect(MODEL_IDS).toContain('grok-4.1-fast');
      expect(MODEL_IDS).toContain('gpt-5.2');
    });

    it('is ordered from cheapest to most expensive', () => {
      // gpt-oss-20b is cheapest, should be first
      expect(MODEL_IDS[0]).toBe('gpt-oss-20b');
      // gpt-5.2 is most expensive, should be last
      expect(MODEL_IDS[MODEL_IDS.length - 1]).toBe('gpt-5.2');
    });
  });

  describe('DEFAULT_MODEL', () => {
    it('is a valid model ID', () => {
      expect(MODEL_IDS).toContain(DEFAULT_MODEL);
    });

    it('is the cheapest model', () => {
      expect(DEFAULT_MODEL).toBe('gpt-oss-20b');
    });
  });

  describe('AVAILABLE_MODELS', () => {
    it('is an array of model objects', () => {
      expect(Array.isArray(AVAILABLE_MODELS)).toBe(true);
      expect(AVAILABLE_MODELS.length).toBe(MODEL_IDS.length);
    });

    it('each model has id, name, and provider', () => {
      AVAILABLE_MODELS.forEach((model) => {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.provider).toBeDefined();
        expect(typeof model.id).toBe('string');
        expect(typeof model.name).toBe('string');
        expect(typeof model.provider).toBe('string');
      });
    });

    it('all model IDs are valid', () => {
      AVAILABLE_MODELS.forEach((model) => {
        expect(MODEL_IDS).toContain(model.id);
      });
    });

    it('has correct providers', () => {
      const gptOss = AVAILABLE_MODELS.find((m) => m.id === 'gpt-oss-20b');
      expect(gptOss?.provider).toBe('Groq');

      const grok = AVAILABLE_MODELS.find((m) => m.id === 'grok-4.1-fast');
      expect(grok?.provider).toBe('xAI');

      const gpt52 = AVAILABLE_MODELS.find((m) => m.id === 'gpt-5.2');
      expect(gpt52?.provider).toBe('OpenAI');
    });
  });

  describe('type ModelId', () => {
    it('allows valid model IDs', () => {
      const validId: ModelId = 'gpt-oss-20b';
      expect(validId).toBe('gpt-oss-20b');
    });
  });
});
