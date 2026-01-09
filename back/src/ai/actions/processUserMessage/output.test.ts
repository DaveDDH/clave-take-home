import { describe, it, expect } from '@jest/globals';
import { ResponseSchema } from './output.js';

describe('output', () => {
  describe('ResponseSchema', () => {
    it('validates valid response object', () => {
      const result = ResponseSchema.safeParse({ msg: 'Hello world' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.msg).toBe('Hello world');
      }
    });

    it('rejects missing msg field', () => {
      const result = ResponseSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects null msg', () => {
      const result = ResponseSchema.safeParse({ msg: null });
      expect(result.success).toBe(false);
    });

    it('rejects non-string msg', () => {
      const result = ResponseSchema.safeParse({ msg: 123 });
      expect(result.success).toBe(false);
    });

    it('accepts empty string msg', () => {
      const result = ResponseSchema.safeParse({ msg: '' });
      expect(result.success).toBe(true);
    });
  });
});
