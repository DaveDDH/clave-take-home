import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const validConfig = {
  description: 'Test product groups',
  groups: [
    { base_name: 'Wings', suffix: 'wings' },
    { base_name: 'Pizza', suffix: 'pizza' },
    { base_name: 'Coffee', keywords: ['coffee', 'espresso', 'latte', 'cappuccino'] },
    { base_name: 'Burger', suffix: 'burger', keywords: ['hamburger'] },
  ],
};

// Create mock function with proper typing
const mockReadFileSync = jest.fn<(path: string, encoding: string) => string>(() => JSON.stringify(validConfig));

// Mock fs module using unstable_mockModule for ESM
jest.unstable_mockModule('fs', () => ({
  readFileSync: mockReadFileSync,
}));

// Dynamic imports after mock setup
const {
  loadProductGroups,
  initializeProductGroups,
  getProductGroups,
  matchProductToGroup,
} = await import('./product-groups.js');

describe('product-groups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));
  });

  describe('loadProductGroups', () => {
    it('loads and validates valid config', () => {
      const result = loadProductGroups('/fake/path.json');

      expect(result).toEqual(validConfig);
      expect(mockReadFileSync).toHaveBeenCalledWith('/fake/path.json', 'utf-8');
    });

    it('throws error for invalid config', () => {
      const invalidConfig = { groups: [] };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      expect(() => loadProductGroups('/fake/path.json')).toThrow('Invalid product groups config');
    });

    it('throws error for invalid JSON', () => {
      mockReadFileSync.mockReturnValue('not valid json');

      expect(() => loadProductGroups('/fake/path.json')).toThrow();
    });

    it('throws error for group without suffix or keywords', () => {
      const invalidConfig = { groups: [{ base_name: 'Test' }] };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      expect(() => loadProductGroups('/fake/path.json')).toThrow('Invalid product groups config');
    });
  });

  describe('initializeProductGroups', () => {
    it('initializes groups from config file', () => {
      initializeProductGroups('/fake/path.json');

      const groups = getProductGroups();
      expect(groups).toHaveLength(4);
    });

    it('compiles groups with lowercase suffix', () => {
      initializeProductGroups('/fake/path.json');

      const groups = getProductGroups();
      const wingsGroup = groups.find(g => g.baseName === 'Wings');
      expect(wingsGroup?.suffix).toBe('wings');
    });

    it('compiles groups with lowercase keywords', () => {
      initializeProductGroups('/fake/path.json');

      const groups = getProductGroups();
      const coffeeGroup = groups.find(g => g.baseName === 'Coffee');
      expect(coffeeGroup?.keywords).toContain('coffee');
      expect(coffeeGroup?.keywords).toContain('espresso');
    });
  });

  describe('getProductGroups', () => {
    it('returns cached groups after initialization', () => {
      initializeProductGroups('/fake/path.json');

      const groups1 = getProductGroups();
      const groups2 = getProductGroups();

      expect(groups1).toBe(groups2); // Same reference
    });
  });

  describe('matchProductToGroup', () => {
    beforeEach(() => {
      initializeProductGroups('/fake/path.json');
    });

    it('matches product by suffix', () => {
      const result = matchProductToGroup('Buffalo Wings');

      expect(result).not.toBeNull();
      expect(result?.baseName).toBe('Wings');
      expect(result?.variationName).toBe('Buffalo');
    });

    it('matches product by suffix (exact match)', () => {
      const result = matchProductToGroup('Wings');

      expect(result).not.toBeNull();
      expect(result?.baseName).toBe('Wings');
      expect(result?.variationName).toBeNull();
    });

    it('matches product by keyword (exact)', () => {
      const result = matchProductToGroup('Espresso');

      expect(result).not.toBeNull();
      expect(result?.baseName).toBe('Coffee');
    });

    it('matches product by keyword (contains)', () => {
      const result = matchProductToGroup('Double Espresso Shot');

      expect(result).not.toBeNull();
      expect(result?.baseName).toBe('Coffee');
    });

    it('returns null for no match', () => {
      const result = matchProductToGroup('Salad');

      expect(result).toBeNull();
    });

    it('extracts variation from suffix match', () => {
      const result = matchProductToGroup('Pepperoni Pizza');

      expect(result).not.toBeNull();
      expect(result?.baseName).toBe('Pizza');
      expect(result?.variationName).toBe('Pepperoni');
    });

    it('handles case insensitivity', () => {
      const result = matchProductToGroup('BUFFALO WINGS');

      expect(result).not.toBeNull();
      expect(result?.baseName).toBe('Wings');
    });

    it('matches with fuzzy suffix (typo correction)', () => {
      // "Wngs" should match "wings" with distance 1
      const result = matchProductToGroup('Buffalo Wngs');

      expect(result).not.toBeNull();
      expect(result?.baseName).toBe('Wings');
    });

    it('matches with fuzzy keyword (typo correction)', () => {
      // "expresso" should match "espresso" with distance 1
      const result = matchProductToGroup('Expresso');

      expect(result).not.toBeNull();
      expect(result?.baseName).toBe('Coffee');
    });

    it('rejects same-length short words as typos', () => {
      // "rings" vs "wings" - both 5 chars, distance 1
      // Should NOT match because they're different words
      const config = {
        groups: [{ base_name: 'Wings', suffix: 'wings' }],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(config));
      initializeProductGroups('/fake/path.json');

      const result = matchProductToGroup('Onion Rings');

      expect(result).toBeNull();
    });

    it('handles product that matches base name exactly', () => {
      const result = matchProductToGroup('Coffee');

      expect(result).not.toBeNull();
      expect(result?.baseName).toBe('Coffee');
      expect(result?.variationName).toBeNull();
    });

    it('matches multi-word suffix patterns', () => {
      const config = {
        groups: [{ base_name: 'Cheese Pizza', suffix: 'cheese pizza' }],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(config));
      initializeProductGroups('/fake/path.json');

      const result = matchProductToGroup('Extra Cheese Pizza');

      expect(result).not.toBeNull();
      expect(result?.baseName).toBe('Cheese Pizza');
      expect(result?.variationName).toBe('Extra');
    });
  });

  describe('extractVariation edge cases', () => {
    beforeEach(() => {
      initializeProductGroups('/fake/path.json');
    });

    it('handles empty variation (product IS the base)', () => {
      const result = matchProductToGroup('Pizza');

      expect(result).not.toBeNull();
      expect(result?.variationName).toBeNull();
    });

    it('handles whitespace in product names', () => {
      const result = matchProductToGroup('  Buffalo Wings  ');

      expect(result).not.toBeNull();
      expect(result?.baseName).toBe('Wings');
    });
  });
});
