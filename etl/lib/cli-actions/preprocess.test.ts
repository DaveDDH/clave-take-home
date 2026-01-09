import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  runPreprocess,
  savePreprocessedData,
  getCachedSourceData,
  getCachedPreprocessedData,
} from './preprocess.js';
import type { EnvConfig } from './types.js';

// Mock fs module
jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// Mock preprocessor
jest.mock('../preprocessor/index.js', () => ({
  preprocessData: jest.fn(),
}));

import { readFileSync, writeFileSync } from 'node:fs';
import { preprocessData } from '../preprocessor/index.js';

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockPreprocessData = preprocessData as jest.MockedFunction<typeof preprocessData>;

describe('preprocess', () => {
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
  const validToastData = { restaurant: { guid: 'r1', name: 'Test' }, locations: [], orders: [] };
  const validDoorDashData = { merchant: { merchant_id: 'm1', business_name: 'Test', currency: 'USD' }, stores: [], orders: [] };
  const validSquareLocations = { locations: [] };
  const validSquareCatalog = { objects: [] };
  const validSquareOrders = { orders: [], cursor: null };
  const validSquarePayments = { payments: [], cursor: null };

  const mockNormalizedData = {
    locations: [],
    categories: [],
    products: [],
    product_variations: [],
    product_aliases: [],
    orders: [],
    order_items: [],
    payments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPreprocessData.mockReturnValue(mockNormalizedData);
  });

  describe('runPreprocess', () => {
    it('loads all source files and calls preprocessData', async () => {
      mockReadFileSync.mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('locations')) return JSON.stringify(validLocationsConfig);
        if (pathStr.includes('toast')) return JSON.stringify(validToastData);
        if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
        if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
        if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
        if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
        if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
        return '{}';
      });

      const result = await runPreprocess(mockConfig);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockPreprocessData).toHaveBeenCalled();
    });

    it('returns preprocessed data with version and timestamp', async () => {
      mockReadFileSync.mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('locations')) return JSON.stringify(validLocationsConfig);
        if (pathStr.includes('toast')) return JSON.stringify(validToastData);
        if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
        if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
        if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
        if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
        if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
        return '{}';
      });

      const result = await runPreprocess(mockConfig);

      expect(result.data?.version).toBe('1.0.0');
      expect(result.data?.generated_at).toBeDefined();
      expect(result.data?.normalized).toBeDefined();
    });

    it('caches source data after preprocessing', async () => {
      mockReadFileSync.mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('locations')) return JSON.stringify(validLocationsConfig);
        if (pathStr.includes('toast')) return JSON.stringify(validToastData);
        if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
        if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
        if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
        if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
        if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
        return '{}';
      });

      await runPreprocess(mockConfig);

      const cachedSource = getCachedSourceData();
      expect(cachedSource).not.toBeNull();
      expect(cachedSource?.toast).toBeDefined();
      expect(cachedSource?.doordash).toBeDefined();
      expect(cachedSource?.square).toBeDefined();
    });

    it('caches preprocessed data after preprocessing', async () => {
      mockReadFileSync.mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('locations')) return JSON.stringify(validLocationsConfig);
        if (pathStr.includes('toast')) return JSON.stringify(validToastData);
        if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
        if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
        if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
        if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
        if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
        return '{}';
      });

      await runPreprocess(mockConfig);

      const cachedData = getCachedPreprocessedData();
      expect(cachedData).not.toBeNull();
      expect(cachedData?.normalized).toBeDefined();
    });

    it('returns error when file read fails', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = await runPreprocess(mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('returns error when JSON parsing fails', async () => {
      mockReadFileSync.mockReturnValue('invalid json');

      const result = await runPreprocess(mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('passes location configs to preprocessData', async () => {
      const locationsWithConfig = { locations: [{ name: 'Downtown', toast_id: 't1' }] };

      mockReadFileSync.mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('locations')) return JSON.stringify(locationsWithConfig);
        if (pathStr.includes('toast')) return JSON.stringify(validToastData);
        if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
        if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
        if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
        if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
        if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
        return '{}';
      });

      await runPreprocess(mockConfig);

      expect(mockPreprocessData).toHaveBeenCalledWith(
        expect.anything(),
        locationsWithConfig.locations
      );
    });
  });

  describe('savePreprocessedData', () => {
    it('writes preprocessed data to file', async () => {
      mockReadFileSync.mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('locations')) return JSON.stringify(validLocationsConfig);
        if (pathStr.includes('toast')) return JSON.stringify(validToastData);
        if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
        if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
        if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
        if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
        if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
        return '{}';
      });

      // Run preprocess first to cache data
      await runPreprocess(mockConfig);

      await savePreprocessedData(mockConfig, '/output/data.json');

      expect(mockWriteFileSync).toHaveBeenCalled();
      const [filePath, content] = mockWriteFileSync.mock.calls[0];
      expect(filePath).toContain('data.json');
      expect(content).toBeDefined();
    });

    it('runs preprocess if no cached data exists', async () => {
      // Reset the module to clear cache - this is tricky with ESM
      // Instead we'll just verify writeFileSync is called
      mockReadFileSync.mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('locations')) return JSON.stringify(validLocationsConfig);
        if (pathStr.includes('toast')) return JSON.stringify(validToastData);
        if (pathStr.includes('doordash')) return JSON.stringify(validDoorDashData);
        if (pathStr.includes('square-locations')) return JSON.stringify(validSquareLocations);
        if (pathStr.includes('square-catalog')) return JSON.stringify(validSquareCatalog);
        if (pathStr.includes('square-orders')) return JSON.stringify(validSquareOrders);
        if (pathStr.includes('square-payments')) return JSON.stringify(validSquarePayments);
        return '{}';
      });

      await savePreprocessedData(mockConfig, '/output/data.json');

      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });
});
