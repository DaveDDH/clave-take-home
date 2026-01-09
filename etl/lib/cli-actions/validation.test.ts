import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { EnvConfig } from './types.js';

// Create mock functions
const mockReadFileSync = jest.fn<(path: string, encoding: string) => string>();
const mockInitializePatterns = jest.fn();
const mockInitializeProductGroups = jest.fn();

// Mock node:fs module using unstable_mockModule for ESM
jest.unstable_mockModule('node:fs', () => ({
  readFileSync: mockReadFileSync,
}));

jest.unstable_mockModule('../variation-patterns.js', () => ({
  initializePatterns: mockInitializePatterns,
  getVariationPatterns: jest.fn(() => []),
  getAbbreviationMap: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../product-groups.js', () => ({
  initializeProductGroups: mockInitializeProductGroups,
  getProductGroups: jest.fn(() => []),
}));

// Dynamic imports after mock setup
const { runValidation } = await import('./validation.js');

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

  // Valid data - schemas require at least one item in arrays
  const validLocationsConfig = { locations: [{ name: 'Downtown', toast_id: 't1', doordash_id: 'd1', square_id: 's1' }] };
  const validVariationPatterns = {
    patterns: [{ name: 'size', regex: '(sm|med|lg)', type: 'size', format: '{1}' }],
    abbreviations: {},
  };
  const validProductGroups = {
    groups: [{ base_name: 'Wings', suffix: 'wings' }],
  };
  const validToastData = {
    restaurant: { guid: 'r1', name: 'Test', managementGroupGuid: 'mgmt-1' },
    locations: [{
      guid: 'loc-1', name: 'Downtown', timezone: 'America/New_York',
      address: { line1: '123 Main St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
    }],
    orders: [],
  };
  const validDoorDashData = {
    merchant: { merchant_id: 'm1', business_name: 'Test', currency: 'USD' },
    stores: [{
      store_id: 's1', name: 'Downtown', timezone: 'America/New_York',
      address: { street: '123 Main St', city: 'NYC', state: 'NY', zip_code: '10001', country: 'US' },
    }],
    orders: [],
  };
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
      if (pathStr.includes('locations.json')) return JSON.stringify(validLocationsConfig);
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
      if (pathStr.includes('locations.json')) return JSON.stringify(validLocationsConfig);
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
      if (pathStr.includes('locations.json')) return 'not valid json';
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
      if (pathStr.includes('locations.json')) return JSON.stringify(validLocationsConfig);
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
      if (pathStr.includes('locations.json')) return JSON.stringify(validLocationsConfig);
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
      restaurant: { guid: 'r1' }, // missing 'name' and 'managementGroupGuid'
      locations: [],
      orders: [],
    };

    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('locations.json')) return JSON.stringify(validLocationsConfig);
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
      if (pathStr.includes('locations.json')) return 'invalid';
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
