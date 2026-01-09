import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('constants', () => {
  const originalEnv = { ...process.env };

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('API keys', () => {
    beforeAll(() => {
      process.env.XAI_API_KEY = 'test-xai-key';
      process.env.GROQ_API_KEY = 'test-groq-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.HELICONE_KEY = 'test-helicone-key';
    });

    it('exports XAI_API_KEY from env', async () => {
      const { XAI_API_KEY } = await import('./index.js');
      expect(XAI_API_KEY).toBe('test-xai-key');
    });

    it('exports GROQ_API_KEY from env', async () => {
      const { GROQ_API_KEY } = await import('./index.js');
      expect(GROQ_API_KEY).toBe('test-groq-key');
    });

    it('exports OPENAI_API_KEY from env', async () => {
      const { OPENAI_API_KEY } = await import('./index.js');
      expect(OPENAI_API_KEY).toBe('test-openai-key');
    });

    it('exports HELICONE_KEY from env', async () => {
      const { HELICONE_KEY } = await import('./index.js');
      expect(HELICONE_KEY).toBe('test-helicone-key');
    });
  });

  describe('model defaults', () => {
    it('exports XAI_MODEL', async () => {
      const { XAI_MODEL } = await import('./index.js');
      expect(typeof XAI_MODEL).toBe('string');
      expect(XAI_MODEL.length).toBeGreaterThan(0);
    });

    it('exports GROQ_MODEL', async () => {
      const { GROQ_MODEL } = await import('./index.js');
      expect(typeof GROQ_MODEL).toBe('string');
    });

    it('exports OPENAI_MODEL', async () => {
      const { OPENAI_MODEL } = await import('./index.js');
      expect(typeof OPENAI_MODEL).toBe('string');
    });
  });

  describe('DEBUG_MODE', () => {
    it('exports DEBUG_MODE as boolean', async () => {
      const { DEBUG_MODE } = await import('./index.js');
      expect(typeof DEBUG_MODE).toBe('boolean');
    });
  });
});
