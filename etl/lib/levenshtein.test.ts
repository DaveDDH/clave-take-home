import { describe, it, expect } from '@jest/globals';
import { levenshtein } from './levenshtein.js';

describe('levenshtein', () => {
  describe('basic distance calculations', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshtein('hello', 'hello')).toBe(0);
    });

    it('returns string length for empty string comparisons', () => {
      expect(levenshtein('hello', '')).toBe(5);
      expect(levenshtein('', 'world')).toBe(5);
    });

    it('returns 0 for two empty strings', () => {
      expect(levenshtein('', '')).toBe(0);
    });

    it('calculates distance for single character difference', () => {
      expect(levenshtein('cat', 'hat')).toBe(1); // substitution
      expect(levenshtein('cat', 'cats')).toBe(1); // insertion
      expect(levenshtein('cats', 'cat')).toBe(1); // deletion
    });

    it('calculates distance for multiple edits', () => {
      expect(levenshtein('kitten', 'sitting')).toBe(3);
      expect(levenshtein('saturday', 'sunday')).toBe(3);
    });

    it('handles completely different strings', () => {
      expect(levenshtein('abc', 'xyz')).toBe(3);
    });
  });

  describe('case sensitivity', () => {
    it('is case insensitive by default', () => {
      expect(levenshtein('Hello', 'hello')).toBe(0);
      expect(levenshtein('WORLD', 'world')).toBe(0);
      expect(levenshtein('Cat', 'CAT')).toBe(0);
    });

    it('respects case when caseSensitive is true', () => {
      expect(levenshtein('Hello', 'hello', { caseSensitive: true })).toBe(1);
      expect(levenshtein('ABC', 'abc', { caseSensitive: true })).toBe(3);
    });
  });

  describe('diacritics normalization', () => {
    it('does not normalize diacritics by default', () => {
      expect(levenshtein('cafe', 'cafe')).toBe(0);
      // Without normalization, accented characters differ
      expect(levenshtein('cafe', 'cafe')).toBe(0);
    });

    it('normalizes diacritics when normalizeDiacritics is true', () => {
      expect(levenshtein('cafe', 'cafe', { normalizeDiacritics: true })).toBe(0);
      expect(levenshtein('Bogota', 'Bogota', { normalizeDiacritics: true })).toBe(0);
      expect(levenshtein('resume', 'resume', { normalizeDiacritics: true })).toBe(0);
    });
  });

  describe('maxDistance early termination', () => {
    it('returns maxDistance + 1 when distance exceeds cap', () => {
      // "abc" to "xyz" is distance 3
      expect(levenshtein('abc', 'xyz', { maxDistance: 2 })).toBe(3);
      expect(levenshtein('abc', 'xyz', { maxDistance: 1 })).toBe(2);
    });

    it('returns actual distance when within cap', () => {
      expect(levenshtein('cat', 'hat', { maxDistance: 5 })).toBe(1);
      expect(levenshtein('kitten', 'sitting', { maxDistance: 5 })).toBe(3);
    });

    it('early abandons based on length difference', () => {
      // Length diff of 10, so maxDistance of 5 should early-abandon
      expect(levenshtein('a', 'abcdefghijk', { maxDistance: 5 })).toBe(6);
    });
  });

  describe('symmetry', () => {
    it('returns the same distance regardless of argument order', () => {
      expect(levenshtein('abc', 'def')).toBe(levenshtein('def', 'abc'));
      expect(levenshtein('kitten', 'sitting')).toBe(levenshtein('sitting', 'kitten'));
      expect(levenshtein('hello', 'world')).toBe(levenshtein('world', 'hello'));
    });
  });

  describe('edge cases', () => {
    it('handles single character strings', () => {
      expect(levenshtein('a', 'a')).toBe(0);
      expect(levenshtein('a', 'b')).toBe(1);
    });

    it('handles unicode characters', () => {
      expect(levenshtein('hello', 'hello')).toBe(0);
    });

    it('handles strings with spaces', () => {
      expect(levenshtein('hello world', 'hello world')).toBe(0);
      expect(levenshtein('hello world', 'helloworld')).toBe(1);
    });
  });
});
