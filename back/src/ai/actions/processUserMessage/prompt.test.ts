import { describe, it, expect, jest, beforeAll } from '@jest/globals';

// Set DATABASE_URL before any imports
beforeAll(() => {
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
});

// Mock the db modules
jest.unstable_mockModule('#db/index.js', () => ({
  executeQuery: jest.fn(() => Promise.resolve([])),
  executeWriteQuery: jest.fn(),
  isReadOnlyQuery: jest.fn(),
}));

jest.unstable_mockModule('#db/metadata.js', () => ({
  getMetadata: jest.fn(() => Promise.resolve({
    locationNames: ['Downtown', 'Airport', 'Mall Location'],
    categoryNames: ['Burgers', 'Drinks', 'Desserts', 'Beer & Wine'],
  })),
}));

const { getCalibrationSystemPrompt, SCHEMA_LINKING_SYSTEM_PROMPT, RESPONSE_GENERATION_SYSTEM_PROMPT } = await import('./prompt.js');

describe('prompt', () => {
  describe('getCalibrationSystemPrompt', () => {
    it('returns a string', async () => {
      const prompt = await getCalibrationSystemPrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('contains location names from metadata', async () => {
      const prompt = await getCalibrationSystemPrompt();
      expect(prompt).toContain('Downtown');
      expect(prompt).toContain('Airport');
      expect(prompt).toContain('Mall Location');
    });

    it('contains category names from metadata', async () => {
      const prompt = await getCalibrationSystemPrompt();
      expect(prompt).toContain('Burgers');
      expect(prompt).toContain('Drinks');
      expect(prompt).toContain('Desserts');
    });

    it('identifies beverage categories', async () => {
      const prompt = await getCalibrationSystemPrompt();
      // Beer & Wine should be identified as a beverage category
      expect(prompt).toContain('Beer & Wine');
    });

    it('contains SQL writing instructions', async () => {
      const prompt = await getCalibrationSystemPrompt();
      expect(prompt).toContain('SQL');
      expect(prompt).toContain('Gold');
      expect(prompt).toContain('gold_orders');
    });

    it('contains source types', async () => {
      const prompt = await getCalibrationSystemPrompt();
      expect(prompt).toContain('toast');
      expect(prompt).toContain('doordash');
      expect(prompt).toContain('square');
    });

    it('contains order types', async () => {
      const prompt = await getCalibrationSystemPrompt();
      expect(prompt).toContain('dine_in');
      expect(prompt).toContain('delivery');
      expect(prompt).toContain('takeout');
    });

    it('contains payment types', async () => {
      const prompt = await getCalibrationSystemPrompt();
      expect(prompt).toContain('credit');
      expect(prompt).toContain('cash');
      expect(prompt).toContain('wallet');
    });
  });

  describe('SCHEMA_LINKING_SYSTEM_PROMPT', () => {
    it('is a non-empty string', () => {
      expect(typeof SCHEMA_LINKING_SYSTEM_PROMPT).toBe('string');
      expect(SCHEMA_LINKING_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('mentions Gold views', () => {
      expect(SCHEMA_LINKING_SYSTEM_PROMPT).toContain('Gold');
      expect(SCHEMA_LINKING_SYSTEM_PROMPT).toContain('gold_orders');
    });

    it('mentions Silver tables', () => {
      expect(SCHEMA_LINKING_SYSTEM_PROMPT).toContain('Silver');
    });
  });

  describe('RESPONSE_GENERATION_SYSTEM_PROMPT', () => {
    it('is a non-empty string', () => {
      expect(typeof RESPONSE_GENERATION_SYSTEM_PROMPT).toBe('string');
      expect(RESPONSE_GENERATION_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('contains formatting guidelines', () => {
      expect(RESPONSE_GENERATION_SYSTEM_PROMPT).toContain('markdown');
      expect(RESPONSE_GENERATION_SYSTEM_PROMPT).toContain('bold');
    });

    it('contains examples', () => {
      expect(RESPONSE_GENERATION_SYSTEM_PROMPT).toContain('Good response');
      expect(RESPONSE_GENERATION_SYSTEM_PROMPT).toContain('Bad response');
    });
  });
});
