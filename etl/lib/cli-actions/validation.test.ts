import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { runValidation } from './validation.js';
import type { EnvConfig } from './types.js';

// Mock fs module
jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
}));

// Mock variation-patterns
jest.mock('../variation-patterns.js', () => ({
  initializePatterns: jest.fn(),
}));

// Mock product-groups
jest.mock('../product-groups.js', () => ({
  initializeProductGroups: jest.fn(),
}));

import { readFileSync } from 'node:fs';
import { initializePatterns } from '../variation-patterns.js';
import { initializeProductGroups } from '../product-groups.js';

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockInitializePatterns = initializePatterns as jest.MockedFunction<typeof initializePatterns>;
const mockInitializeProductGroups = initializeProductGroups as jest.MockedFunction<typeof initializeProductGroups>;

describe('runValidation', () => {
  const mockConfig: EnvConfig = {
    LOCATIONS_PATH: '/path/to/locations.json',
    VARIATION_PATTERNS_PATH: '/path/to/variations.json',
    PRODUCT_GROUPS_PATH: '/path/to/products.json',
    TOAST_POS_PATH: '/path/to/toast.json',
    DOORDASH_ORDERS_PATH: '/path/to/doordash.json',
    SQUARE_LOCATIONS_PATH: '/path/to/square-locations.json',
    SQUARE_CATALOG_PATH: '/path/to/square-catalog.json',
    SQUARE_ORDERS_PATH: '/path/to/square-orders.json',
    SQUARE_PAYMENTS_PATH: '/path/to/square-payments.json',
  };

  const validLocationsConfig = { locations: [] };
  const validVariationPatterns = { patterns: [], abbreviations: {} };
  const validProductGroups = { groups: [] };
  const validToastData = { restaurant: { guid: 'r1', name: 'Test' }, locations: [], orders: [] };
  const validDoorDashData = { merchant: { merchant_id: 'm1', business_name: 'Test', currency: 'USD' }, stores: [], orders: [] };
  const validSquareLocations = { locations: [] };
  const validSquareCatalog = { objects: [] };
  const validSquareOrders = { orders: [], cursor: null };
  const validSquarePayments = { payments: [], cursor: null };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInitializePatterns.mockImplementation(() => {});
    mockInitializeProductGroups.mockImplementation(() => {});
  });

  it('returns success when all files are valid', async () => {
    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('locations')) return JSON.stringify(validLocationsConfig);
      if (pathStr.includes('variations')) return JSON.stringify(validVariationPatterns);
      if (pathStr.includes('products')) return JSON.stringify(validProductGroups);
      if (pathStr.includes('toast')) return JSON.stringify(validToastData);
      if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
      if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
      if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
      if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
      if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
      return '{}';
    });

    const result = await runValidation(mockConfig);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('initializes patterns after successful validation', async () => {
    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('locations')) return JSON.stringify(validLocationsConfig);
      if (pathStr.includes('variations')) return JSON.stringify(validVariationPatterns);
      if (pathStr.includes('products')) return JSON.stringify(validProductGroups);
      if (pathStr.includes('toast')) return JSON.stringify(validToastData);
      if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
      if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
      if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
      if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
      if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
      return '{}';
    });

    await runValidation(mockConfig);

    expect(mockInitializePatterns).toHaveBeenCalledWith('/path/to/variations.json');
    expect(mockInitializeProductGroups).toHaveBeenCalledWith('/path/to/products.json');
  });

  it('returns error for invalid JSON', async () => {
    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('locations')) return 'not valid json';
      return '{}';
    });

    const result = await runValidation(mockConfig);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Locations Config');
  });

  it('returns error for file read failure', async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('File not found');
    });

    const result = await runValidation(mockConfig);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('File not found');
  });

  it('returns error when initializePatterns fails', async () => {
    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('locations')) return JSON.stringify(validLocationsConfig);
      if (pathStr.includes('variations')) return JSON.stringify(validVariationPatterns);
      if (pathStr.includes('products')) return JSON.stringify(validProductGroups);
      if (pathStr.includes('toast')) return JSON.stringify(validToastData);
      if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
      if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
      if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
      if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
      if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
      return '{}';
    });
    mockInitializePatterns.mockImplementation(() => {
      throw new Error('Invalid pattern config');
    });

    const result = await runValidation(mockConfig);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Variation Patterns: Invalid pattern config');
  });

  it('returns error when initializeProductGroups fails', async () => {
    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('locations')) return JSON.stringify(validLocationsConfig);
      if (pathStr.includes('variations')) return JSON.stringify(validVariationPatterns);
      if (pathStr.includes('products')) return JSON.stringify(validProductGroups);
      if (pathStr.includes('toast')) return JSON.stringify(validToastData);
      if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
      if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
      if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
      if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
      if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
      return '{}';
    });
    mockInitializeProductGroups.mockImplementation(() => {
      throw new Error('Invalid product groups config');
    });

    const result = await runValidation(mockConfig);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Product Groups: Invalid product groups config');
  });

  it('returns schema validation errors with path information', async () => {
    const invalidToastData = {
      restaurant: { guid: 'r1' }, // missing 'name'
      locations: [],
      orders: [],
    };

    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('locations')) return JSON.stringify(validLocationsConfig);
      if (pathStr.includes('variations')) return JSON.stringify(validVariationPatterns);
      if (pathStr.includes('products')) return JSON.stringify(validProductGroups);
      if (pathStr.includes('toast')) return JSON.stringify(invalidToastData);
      if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
      if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
      if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
      if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
      if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
      return '{}';
    });

    const result = await runValidation(mockConfig);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Toast POS'))).toBe(true);
  });

  it('reports multiple validation errors at once', async () => {
    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('locations')) return 'invalid';
      if (pathStr.includes('variations')) return 'invalid';
      if (pathStr.includes('products')) return JSON.stringify(validProductGroups);
      if (pathStr.includes('toast')) return JSON.stringify(validToastData);
      if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
      if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
      if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
      if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
      if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
      return '{}';
    });

    const result = await runValidation(mockConfig);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
