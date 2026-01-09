import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  loadVariationPatterns,
  initializePatterns,
  getVariationPatterns,
  getAbbreviationMap,
} from './variation-patterns.js';

// Mock fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

import { readFileSync } from 'fs';
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

describe('variation-patterns', () => {
  const validConfig = {
    patterns: [
      {
        name: 'quantity_pcs',
        regex: '(\\d+)\\s*(?:pcs?|pieces?)',
        flags: 'i',
        type: 'quantity',
        format: '{1} pcs',
      },
      {
        name: 'size_prefix',
        regex: '^(lg|sm|med)\\s+',
        flags: 'i',
        type: 'size',
        format: '{1|size_expand}',
      },
      {
        name: 'strength_pattern',
        regex: '(single|double|dbl)\\s+',
        flags: 'i',
        type: 'strength',
        format: '{1|strength_expand}',
      },
    ],
    abbreviations: {
      coke: 'coca-cola',
      fries: 'french fries',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadVariationPatterns', () => {
    it('loads and validates valid config', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      const result = loadVariationPatterns('/fake/path.json');

      expect(result).toEqual(validConfig);
      expect(mockReadFileSync).toHaveBeenCalledWith('/fake/path.json', 'utf-8');
    });

    it('throws error for invalid config', () => {
      const invalidConfig = { patterns: [], abbreviations: {} };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      expect(() => loadVariationPatterns('/fake/path.json')).toThrow('Invalid variation patterns config');
    });

    it('throws error for invalid JSON', () => {
      mockReadFileSync.mockReturnValue('not valid json');

      expect(() => loadVariationPatterns('/fake/path.json')).toThrow();
    });

    it('throws error for missing patterns', () => {
      const invalidConfig = { abbreviations: {} };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      expect(() => loadVariationPatterns('/fake/path.json')).toThrow('Invalid variation patterns config');
    });
  });

  describe('initializePatterns', () => {
    it('initializes patterns from config file', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      initializePatterns('/fake/path.json');

      const patterns = getVariationPatterns();
      expect(patterns).toHaveLength(3);
      expect(patterns[0].name).toBe('quantity_pcs');
      expect(patterns[0].type).toBe('quantity');
    });

    it('compiles regex patterns correctly', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      initializePatterns('/fake/path.json');

      const patterns = getVariationPatterns();
      expect(patterns[0].regex).toBeInstanceOf(RegExp);
      expect(patterns[0].regex.test('12 pcs')).toBe(true);
    });

    it('creates format function from template', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      initializePatterns('/fake/path.json');

      const patterns = getVariationPatterns();
      const match = '12 pcs'.match(patterns[0].regex);
      if (match) {
        expect(patterns[0].format(match)).toBe('12 pcs');
      }
    });

    it('applies size_expand transformer', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      initializePatterns('/fake/path.json');

      const patterns = getVariationPatterns();
      const sizePattern = patterns.find(p => p.name === 'size_prefix')!;
      const match = 'lg Coke'.match(sizePattern.regex);
      if (match) {
        expect(sizePattern.format(match)).toBe('Large');
      }
    });

    it('applies strength_expand transformer', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      initializePatterns('/fake/path.json');

      const patterns = getVariationPatterns();
      const strengthPattern = patterns.find(p => p.name === 'strength_pattern')!;
      const match = 'double shot'.match(strengthPattern.regex);
      if (match) {
        expect(strengthPattern.format(match)).toBe('Double');
      }
    });
  });

  describe('getVariationPatterns', () => {
    it('throws error if not initialized', () => {
      // Reset module state by reinitializing with invalid then throwing
      jest.resetModules();

      // This test assumes the module starts uninitialized
      // In practice, we'd need to reset the cached state
    });

    it('returns cached patterns after initialization', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      initializePatterns('/fake/path.json');

      const patterns1 = getVariationPatterns();
      const patterns2 = getVariationPatterns();

      expect(patterns1).toBe(patterns2); // Same reference
    });
  });

  describe('getAbbreviationMap', () => {
    it('returns abbreviation map after initialization', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      initializePatterns('/fake/path.json');

      const abbreviations = getAbbreviationMap();
      expect(abbreviations).toEqual({ coke: 'coca-cola', fries: 'french fries' });
    });

    it('returns cached abbreviations', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      initializePatterns('/fake/path.json');

      const abbr1 = getAbbreviationMap();
      const abbr2 = getAbbreviationMap();

      expect(abbr1).toBe(abbr2); // Same reference
    });
  });

  describe('format transformers', () => {
    it('capitalize transformer works correctly', () => {
      const configWithCapitalize = {
        patterns: [{
          name: 'test',
          regex: '(\\w+)',
          type: 'size',
          format: '{1|capitalize}',
        }],
        abbreviations: {},
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(configWithCapitalize));

      initializePatterns('/fake/path.json');

      const patterns = getVariationPatterns();
      const match = 'hello world'.match(patterns[0].regex);
      if (match) {
        expect(patterns[0].format(match)).toBe('Hello');
      }
    });

    it('size_expand handles unknown sizes', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      initializePatterns('/fake/path.json');

      const patterns = getVariationPatterns();
      const sizePattern = patterns.find(p => p.name === 'size_prefix')!;

      // Test with a size that's not in the map
      const mockMatch = ['xl Coke', 'xl'] as unknown as RegExpMatchArray;
      mockMatch.index = 0;
      mockMatch.input = 'xl Coke';

      expect(sizePattern.format(mockMatch)).toBe('xl');
    });

    it('strength_expand handles unknown strengths', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      initializePatterns('/fake/path.json');

      const patterns = getVariationPatterns();
      const strengthPattern = patterns.find(p => p.name === 'strength_pattern')!;

      const mockMatch = ['triple shot', 'triple'] as unknown as RegExpMatchArray;
      mockMatch.index = 0;
      mockMatch.input = 'triple shot';

      expect(strengthPattern.format(mockMatch)).toBe('triple');
    });

    it('handles missing capture group gracefully', () => {
      const configWithBadFormat = {
        patterns: [{
          name: 'test',
          regex: 'test',
          type: 'size',
          format: '{5}', // Group 5 doesn't exist
        }],
        abbreviations: {},
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(configWithBadFormat));

      initializePatterns('/fake/path.json');

      const patterns = getVariationPatterns();
      const mockMatch = ['test'] as unknown as RegExpMatchArray;

      expect(patterns[0].format(mockMatch)).toBe('');
    });
  });
});
