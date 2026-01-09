import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  extractVariation,
  normalizeVariationName,
  expandAbbreviation,
  getNormalizedBaseName,
  normalizeCategory,
  normalizeProductName,
  findCanonicalProduct,
  mapToastOrderType,
  mapToastChannel,
  mapDoorDashOrderType,
  mapSquareOrderType,
  mapSquareChannel,
  normalizePaymentType,
  normalizeCardBrand,
} from './normalizers.js';
import { initializePatterns } from './variation-patterns.js';
import type { DbProduct } from './types.js';

// Create test fixture for variation patterns
const testPatternsConfig = {
  patterns: [
    {
      name: 'quantity_pcs',
      regex: '(\\d+)\\s*(?:pcs?|pieces?)',
      flags: 'i',
      type: 'quantity' as const,
      format: '{1} pcs',
    },
    {
      name: 'size_prefix',
      regex: '^(lg|sm|med)\\s+',
      flags: 'i',
      type: 'size' as const,
      format: '{1|size_expand}',
    },
    {
      name: 'size_suffix',
      regex: '\\s*[-–]\\s*(small|medium|large|lg|sm|med)$',
      flags: 'i',
      type: 'size' as const,
      format: '{1|size_expand}',
    },
  ],
  abbreviations: {
    coke: 'coca-cola',
    fries: 'french fries',
  },
};

// Mock fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => JSON.stringify(testPatternsConfig)),
}));

describe('normalizers', () => {
  beforeEach(() => {
    // Initialize patterns before tests that depend on them
    initializePatterns('/fake/path.json');
  });

  describe('extractVariation', () => {
    it('extracts quantity variation from product name', () => {
      const result = extractVariation('Churros 12pcs');
      expect(result.baseName).toBe('Churros');
      expect(result.variation).toBe('12 pcs');
      expect(result.variationType).toBe('quantity');
    });

    it('extracts size prefix from product name', () => {
      const result = extractVariation('Lg Coke');
      expect(result.baseName).toBe('Coke');
      expect(result.variation).toBe('Large');
      expect(result.variationType).toBe('size');
    });

    it('extracts size suffix from product name', () => {
      const result = extractVariation('Fries - Large');
      expect(result.baseName).toBe('Fries');
      expect(result.variation).toBe('Large');
      expect(result.variationType).toBe('size');
    });

    it('returns original name when no variation found', () => {
      const result = extractVariation('Hamburger');
      expect(result.baseName).toBe('Hamburger');
      expect(result.variation).toBeUndefined();
      expect(result.variationType).toBeUndefined();
    });

    it('trims whitespace from name', () => {
      const result = extractVariation('  Burger  ');
      expect(result.baseName).toBe('Burger');
    });
  });

  describe('normalizeVariationName', () => {
    it('returns empty for falsy input', () => {
      expect(normalizeVariationName('')).toEqual({ normalized: '' });
    });

    it('extracts variation from name with embedded info', () => {
      const result = normalizeVariationName('Buffalo Wings 12pc');
      expect(result.normalized).toBe('12 pcs');
      expect(result.variationType).toBe('quantity');
    });

    it('normalizes size abbreviations', () => {
      expect(normalizeVariationName('lg')).toEqual({
        normalized: 'Large',
        variationType: 'size',
      });
      expect(normalizeVariationName('sm')).toEqual({
        normalized: 'Small',
        variationType: 'size',
      });
      expect(normalizeVariationName('med')).toEqual({
        normalized: 'Medium',
        variationType: 'size',
      });
    });

    it('cleans up dash prefix', () => {
      const result = normalizeVariationName('- Large');
      expect(result.normalized).toBe('Large');
    });

    it('capitalizes lowercase names', () => {
      const result = normalizeVariationName('extra large');
      expect(result.normalized).toBe('Extra Large');
    });
  });

  describe('expandAbbreviation', () => {
    it('expands known abbreviations', () => {
      expect(expandAbbreviation('Coke')).toBe('coca-cola');
      expect(expandAbbreviation('FRIES')).toBe('french fries');
    });

    it('returns lowercase original for unknown abbreviations', () => {
      expect(expandAbbreviation('Burger')).toBe('burger');
    });
  });

  describe('getNormalizedBaseName', () => {
    it('extracts base name and expands abbreviations', () => {
      expect(getNormalizedBaseName('Lg Coke')).toBe('coca-cola');
      expect(getNormalizedBaseName('Fries - Large')).toBe('french fries');
    });

    it('handles names without variations', () => {
      expect(getNormalizedBaseName('Hamburger')).toBe('hamburger');
    });
  });

  describe('normalizeCategory', () => {
    it('removes emojis from category names', () => {
      expect(normalizeCategory('🍔 Burgers')).toBe('Burgers');
      expect(normalizeCategory('🍟 Sides & Appetizers')).toBe('Sides & Appetizers');
    });

    it('normalizes whitespace', () => {
      expect(normalizeCategory('  Multiple   Spaces  ')).toBe('Multiple Spaces');
    });

    it('capitalizes words properly', () => {
      expect(normalizeCategory('burgers and fries')).toBe('Burgers And Fries');
    });
  });

  describe('normalizeProductName', () => {
    it('lowercases and trims', () => {
      expect(normalizeProductName('  BURGER  ')).toBe('burger');
    });

    it('normalizes whitespace', () => {
      expect(normalizeProductName('Double   Cheeseburger')).toBe('double cheeseburger');
    });
  });

  describe('findCanonicalProduct', () => {
    const products: Array<DbProduct & { id: string }> = [
      { id: '1', name: 'Hamburger' },
      { id: '2', name: 'French Fries' },
      { id: '3', name: 'Coca-Cola' },
    ];

    it('finds exact match', () => {
      const result = findCanonicalProduct('Hamburger', products);
      expect(result?.id).toBe('1');
    });

    it('finds match with fuzzy matching', () => {
      const result = findCanonicalProduct('Hamburgr', products, 2); // typo
      expect(result?.id).toBe('1');
    });

    it('returns null when no match within threshold', () => {
      const result = findCanonicalProduct('Pizza', products, 3);
      expect(result).toBeNull();
    });

    it('uses ratio-based threshold for longer names', () => {
      const longProducts: Array<DbProduct & { id: string }> = [
        { id: '1', name: 'Double Bacon Cheeseburger' },
      ];
      const result = findCanonicalProduct('Duble Bacon Cheeseburger', longProducts, 3);
      expect(result?.id).toBe('1');
    });
  });

  describe('mapToastOrderType', () => {
    it('maps DINE_IN to dine_in', () => {
      expect(mapToastOrderType('DINE_IN')).toBe('dine_in');
    });

    it('maps TAKE_OUT to takeout', () => {
      expect(mapToastOrderType('TAKE_OUT')).toBe('takeout');
    });

    it('maps DELIVERY to delivery', () => {
      expect(mapToastOrderType('DELIVERY')).toBe('delivery');
    });

    it('lowercases unknown values', () => {
      expect(mapToastOrderType('UNKNOWN_TYPE')).toBe('unknown_type');
    });
  });

  describe('mapToastChannel', () => {
    it('maps POS to pos', () => {
      expect(mapToastChannel('POS')).toBe('pos');
    });

    it('maps ONLINE to online', () => {
      expect(mapToastChannel('ONLINE')).toBe('online');
    });

    it('maps THIRD_PARTY to third_party', () => {
      expect(mapToastChannel('THIRD_PARTY')).toBe('third_party');
    });

    it('lowercases unknown values', () => {
      expect(mapToastChannel('APP')).toBe('app');
    });
  });

  describe('mapDoorDashOrderType', () => {
    it('maps MERCHANT_DELIVERY to delivery', () => {
      expect(mapDoorDashOrderType('MERCHANT_DELIVERY')).toBe('delivery');
    });

    it('maps PICKUP to pickup', () => {
      expect(mapDoorDashOrderType('PICKUP')).toBe('pickup');
    });

    it('lowercases unknown values', () => {
      expect(mapDoorDashOrderType('OTHER')).toBe('other');
    });
  });

  describe('mapSquareOrderType', () => {
    it('maps DINE_IN to dine_in', () => {
      expect(mapSquareOrderType('DINE_IN')).toBe('dine_in');
    });

    it('maps PICKUP to pickup', () => {
      expect(mapSquareOrderType('PICKUP')).toBe('pickup');
    });

    it('maps DELIVERY to delivery', () => {
      expect(mapSquareOrderType('DELIVERY')).toBe('delivery');
    });

    it('lowercases unknown values', () => {
      expect(mapSquareOrderType('CURBSIDE')).toBe('curbside');
    });
  });

  describe('mapSquareChannel', () => {
    it('returns online for source names containing online', () => {
      expect(mapSquareChannel('Online Store')).toBe('online');
      expect(mapSquareChannel('ONLINE_ORDERS')).toBe('online');
    });

    it('returns pos for other sources', () => {
      expect(mapSquareChannel('Square POS')).toBe('pos');
      expect(mapSquareChannel('Register')).toBe('pos');
    });
  });

  describe('normalizePaymentType', () => {
    it('normalizes credit card types', () => {
      expect(normalizePaymentType('CREDIT')).toBe('credit');
      expect(normalizePaymentType('CARD')).toBe('credit');
    });

    it('normalizes cash', () => {
      expect(normalizePaymentType('CASH')).toBe('cash');
    });

    it('normalizes wallet', () => {
      expect(normalizePaymentType('WALLET')).toBe('wallet');
    });

    it('normalizes other', () => {
      expect(normalizePaymentType('OTHER')).toBe('other');
    });

    it('lowercases unknown types', () => {
      expect(normalizePaymentType('GIFT_CARD')).toBe('gift_card');
    });
  });

  describe('normalizeCardBrand', () => {
    it('returns undefined for null/undefined', () => {
      expect(normalizeCardBrand(null)).toBeUndefined();
      expect(normalizeCardBrand(undefined)).toBeUndefined();
    });

    it('normalizes VISA', () => {
      expect(normalizeCardBrand('VISA')).toBe('visa');
    });

    it('normalizes MASTERCARD', () => {
      expect(normalizeCardBrand('MASTERCARD')).toBe('mastercard');
    });

    it('normalizes AMEX variants', () => {
      expect(normalizeCardBrand('AMEX')).toBe('amex');
      expect(normalizeCardBrand('AMERICAN_EXPRESS')).toBe('amex');
    });

    it('normalizes DISCOVER', () => {
      expect(normalizeCardBrand('DISCOVER')).toBe('discover');
    });

    it('normalizes digital wallets', () => {
      expect(normalizeCardBrand('APPLE_PAY')).toBe('apple_pay');
      expect(normalizeCardBrand('GOOGLE_PAY')).toBe('google_pay');
    });

    it('lowercases unknown brands', () => {
      expect(normalizeCardBrand('UNKNOWN_CARD')).toBe('unknown_card');
    });
  });
});
