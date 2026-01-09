import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { EnvConfig } from './types.js';

// Create mock functions
const mockReadFileSync = jest.fn<(path: string, encoding: string) => string>();

// Mock node:fs module using unstable_mockModule for ESM
jest.unstable_mockModule('node:fs', () => ({
  readFileSync: mockReadFileSync,
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns error for invalid JSON in locations config', async () => {
    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('locations.json')) return 'not valid json';
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

  it('returns schema validation errors with path information', async () => {
    const invalidToastData = {
      restaurant: { guid: 'r1' }, // missing 'name'
      locations: [],
      orders: [],
    };

    const validLocationConfig = { locations: [{ name: 'Test', toast_id: 't1', doordash_id: 'd1', square_id: 's1' }] };
    const validVariationPatterns = { patterns: [{ name: 'test', regex: 'test', type: 'size', format: '{1}' }], abbreviations: {} };
    const validProductGroups = { groups: [{ base_name: 'Test', suffix: 'test' }] };
    const validDoorDashData = { merchant: { merchant_id: 'm1', business_name: 'Test', currency: 'USD' }, stores: [{ store_id: 's1', name: 'Test', timezone: 'America/New_York', address: { street: '123 Main', city: 'NYC', state: 'NY', zip_code: '10001', country: 'US' } }], orders: [] };
    const validSquareLocations = { locations: [] };
    const validSquareCatalog = { objects: [] };
    const validSquareOrders = { orders: [] };
    const validSquarePayments = { payments: [] };

    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('toast')) return JSON.stringify(invalidToastData);
      if (pathStr.includes('locations.json')) return JSON.stringify(validLocationConfig);
      if (pathStr.includes('variations')) return JSON.stringify(validVariationPatterns);
      if (pathStr.includes('products')) return JSON.stringify(validProductGroups);
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
      return '{}';
    });

    const result = await runValidation(mockConfig);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('returns error for missing required fields in locations config', async () => {
    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('locations.json')) return JSON.stringify({ locations: [] }); // Empty array fails min(1)
      return '{}';
    });

    const result = await runValidation(mockConfig);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Locations Config'))).toBe(true);
  });

  it('returns error for invalid variation patterns config', async () => {
    const validLocationConfig = { locations: [{ name: 'Test', toast_id: 't1', doordash_id: 'd1', square_id: 's1' }] };

    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('locations.json')) return JSON.stringify(validLocationConfig);
      if (pathStr.includes('variations')) return JSON.stringify({ patterns: [] }); // Empty patterns fails min(1)
      return '{}';
    });

    const result = await runValidation(mockConfig);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Variation Patterns'))).toBe(true);
  });

  it('returns error for invalid product groups config', async () => {
    const validLocationConfig = { locations: [{ name: 'Test', toast_id: 't1', doordash_id: 'd1', square_id: 's1' }] };
    const validVariationPatterns = { patterns: [{ name: 'test', regex: 'test', type: 'size', format: '{1}' }], abbreviations: {} };

    mockReadFileSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('locations.json')) return JSON.stringify(validLocationConfig);
      if (pathStr.includes('variations')) return JSON.stringify(validVariationPatterns);
      if (pathStr.includes('products')) return JSON.stringify({ groups: [] }); // Empty groups fails min(1)
      return '{}';
    });

    const result = await runValidation(mockConfig);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Product Groups'))).toBe(true);
  });

  it('handles non-Error exceptions in file read', async () => {
    mockReadFileSync.mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- Testing non-Error exception handling
      throw null;
    });

    const result = await runValidation(mockConfig);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Unknown error'))).toBe(true);
  });
});
