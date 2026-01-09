import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Create mock functions
const mockReadFileSync = jest.fn<(path: string, encoding: string) => string>();

// Mock pg Client
const mockQuery = jest.fn<() => Promise<{rows: unknown[]}>>().mockResolvedValue({ rows: [] });
const mockConnect = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockEnd = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

const mockClient = {
  query: mockQuery,
  connect: mockConnect,
  end: mockEnd,
};

const MockClient = jest.fn(() => mockClient);

// Mock node:fs module using unstable_mockModule for ESM
jest.unstable_mockModule('node:fs', () => ({
  readFileSync: mockReadFileSync,
}));

jest.unstable_mockModule('pg', () => ({
  default: { Client: MockClient },
}));

// Dynamic imports after mock setup
const { loadToDatabase } = await import('./load-database.js');

describe('loadToDatabase', () => {
  const validPreprocessedData = {
    version: '1.0.0',
    generated_at: '2024-01-15T17:00:00Z',
    normalized: {
      locations: [{ id: 'loc-1', name: 'Downtown', timezone: 'America/New_York', toast_id: 't1', doordash_id: 'd1', square_id: 's1', address: { street: '123 Main' } }],
      categories: [{ id: 'cat-1', name: 'Burgers' }],
      products: [{ id: 'prod-1', name: 'Hamburger', category_id: 'cat-1', description: 'A burger' }],
      product_variations: [{ id: 'var-1', product_id: 'prod-1', name: 'Large', variation_type: 'size', source_raw_name: 'Large Burger' }],
      product_aliases: [{ id: 'alias-1', product_id: 'prod-1', raw_name: 'Burger', source: 'toast' }],
      orders: [{ id: 'order-1', source: 'toast', source_order_id: 'toast-1', location_id: 'loc-1', order_type: 'dine_in', channel: 'pos', status: 'completed', created_at: '2024-01-15T12:00:00Z', closed_at: '2024-01-15T12:30:00Z', subtotal_cents: 999, tax_cents: 80, tip_cents: 0, total_cents: 1079, delivery_fee_cents: 0, service_fee_cents: 0, commission_cents: 0, contains_alcohol: false, is_catering: false }],
      order_items: [{ id: 'item-1', order_id: 'order-1', product_id: 'prod-1', variation_id: 'var-1', original_name: 'Hamburger', quantity: 1, unit_price_cents: 999, total_price_cents: 999, tax_cents: 80, modifiers: [], special_instructions: 'No pickles' }],
      payments: [{ id: 'pay-1', order_id: 'order-1', source_payment_id: 'toast-pay-1', payment_type: 'credit', card_brand: 'visa', last_four: '4242', amount_cents: 1079, tip_cents: 200, processing_fee_cents: 30, created_at: '2024-01-15T12:30:00Z' }],
    },
  };

  let originalEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env.DATABASE_URL;
    // Reset mock implementations
    mockQuery.mockResolvedValue({ rows: [] });
    mockConnect.mockResolvedValue(undefined);
    mockEnd.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalEnv;
  });

  it('returns error when file cannot be read', async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('File not found');
    });

    const result = await loadToDatabase('/path/to/nonexistent.json');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not read file');
  });

  it('returns error for invalid preprocessed data format', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ invalid: true }));

    const result = await loadToDatabase('/path/to/data.json');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid preprocessed data file format');
  });

  it('returns error when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    mockReadFileSync.mockReturnValue(JSON.stringify(validPreprocessedData));

    const result = await loadToDatabase('/path/to/data.json');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing DATABASE_URL');
  });

  it('returns error for invalid JSON', async () => {
    mockReadFileSync.mockReturnValue('not valid json');

    const result = await loadToDatabase('/path/to/data.json');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not read file');
  });

  it('returns error when version is missing', async () => {
    const dataWithoutVersion = {
      generated_at: '2024-01-15T17:00:00Z',
      normalized: validPreprocessedData.normalized,
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(dataWithoutVersion));

    const result = await loadToDatabase('/path/to/data.json');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid preprocessed data file format');
  });

  it('returns error when normalized is missing', async () => {
    const dataWithoutNormalized = {
      version: '1.0.0',
      generated_at: '2024-01-15T17:00:00Z',
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(dataWithoutNormalized));

    const result = await loadToDatabase('/path/to/data.json');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid preprocessed data file format');
  });

  it('successfully loads data to database', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    // Mock schema and gold_views SQL files
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('schema.sql')) return 'CREATE TABLE test;';
      if (path.includes('gold_views.sql')) return 'CREATE VIEW test_view;';
      return JSON.stringify(validPreprocessedData);
    });

    const result = await loadToDatabase('/path/to/data.json');

    expect(result.success).toBe(true);
    expect(result.stats).toEqual({
      locations: 1,
      categories: 1,
      products: 1,
      product_variations: 1,
      product_aliases: 1,
      orders: 1,
      order_items: 1,
      payments: 1,
    });
    expect(mockConnect).toHaveBeenCalled();
    expect(mockEnd).toHaveBeenCalled();
  });

  it('cleans database when cleanDb is true', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('schema.sql')) return 'CREATE TABLE test;';
      if (path.includes('gold_views.sql')) return 'CREATE VIEW test_view;';
      return JSON.stringify(validPreprocessedData);
    });

    await loadToDatabase('/path/to/data.json', true);

    // Should have called query with DROP statements
    const dropCall = mockQuery.mock.calls.find((call: unknown[]) =>
      typeof call[0] === 'string' && (call[0] as string).includes('DROP VIEW')
    );
    expect(dropCall).toBeTruthy();
  });

  it('calls progress callback', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('schema.sql')) return 'CREATE TABLE test;';
      if (path.includes('gold_views.sql')) return 'CREATE VIEW test_view;';
      return JSON.stringify(validPreprocessedData);
    });

    const progressCallback = jest.fn();
    await loadToDatabase('/path/to/data.json', false, progressCallback);

    expect(progressCallback).toHaveBeenCalled();
    expect(progressCallback).toHaveBeenCalledWith('Connecting to database...');
    expect(progressCallback).toHaveBeenCalledWith('Done!');
  });

  it('handles database connection error', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('schema.sql')) return 'CREATE TABLE test;';
      if (path.includes('gold_views.sql')) return 'CREATE VIEW test_view;';
      return JSON.stringify(validPreprocessedData);
    });
    mockConnect.mockRejectedValue(new Error('Connection refused'));

    const result = await loadToDatabase('/path/to/data.json');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });

  it('handles query error during insert', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('schema.sql')) return 'CREATE TABLE test;';
      if (path.includes('gold_views.sql')) return 'CREATE VIEW test_view;';
      return JSON.stringify(validPreprocessedData);
    });
    // Fail on location insert
    let callCount = 0;
    mockQuery.mockImplementation(() => {
      callCount++;
      if (callCount > 2) {
        return Promise.reject(new Error('Insert failed'));
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await loadToDatabase('/path/to/data.json');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insert failed');
    expect(mockEnd).toHaveBeenCalled(); // Should close connection on error
  });

  it('handles error when closing connection fails', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('schema.sql')) return 'CREATE TABLE test;';
      if (path.includes('gold_views.sql')) return 'CREATE VIEW test_view;';
      return JSON.stringify(validPreprocessedData);
    });
    mockQuery.mockRejectedValue(new Error('Query failed'));
    mockEnd.mockRejectedValue(new Error('Close failed'));

    const result = await loadToDatabase('/path/to/data.json');

    // Should still return the original error, not the close error
    expect(result.success).toBe(false);
    expect(result.error).toBe('Query failed');
  });

  it('handles non-Error exceptions', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('schema.sql')) return 'CREATE TABLE test;';
      if (path.includes('gold_views.sql')) return 'CREATE VIEW test_view;';
      return JSON.stringify(validPreprocessedData);
    });
    mockConnect.mockRejectedValue('string error');

    const result = await loadToDatabase('/path/to/data.json');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error loading to database');
  });

  it('inserts locations with all fields', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    const dataWithRawData = {
      ...validPreprocessedData,
      normalized: {
        ...validPreprocessedData.normalized,
        locations: [{
          ...validPreprocessedData.normalized.locations[0],
          raw_data: { original: 'data' },
        }],
      },
    };
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('schema.sql')) return 'CREATE TABLE test;';
      if (path.includes('gold_views.sql')) return 'CREATE VIEW test_view;';
      return JSON.stringify(dataWithRawData);
    });

    await loadToDatabase('/path/to/data.json');

    // Find the location insert query
    const locationInsert = mockQuery.mock.calls.find((call: unknown[]) =>
      typeof call[0] === 'string' && (call[0] as string).includes('INSERT INTO locations')
    );
    expect(locationInsert).toBeTruthy();
  });

  it('handles products with and without raw_data', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    const dataWithRawData = {
      ...validPreprocessedData,
      normalized: {
        ...validPreprocessedData.normalized,
        products: [
          { ...validPreprocessedData.normalized.products[0], raw_data: { foo: 'bar' } },
        ],
        categories: [
          { ...validPreprocessedData.normalized.categories[0], raw_data: { cat: 'data' } },
        ],
      },
    };
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('schema.sql')) return 'CREATE TABLE test;';
      if (path.includes('gold_views.sql')) return 'CREATE VIEW test_view;';
      return JSON.stringify(dataWithRawData);
    });

    const result = await loadToDatabase('/path/to/data.json');
    expect(result.success).toBe(true);
  });

  it('handles orders with and without raw_data', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    const dataWithRawData = {
      ...validPreprocessedData,
      normalized: {
        ...validPreprocessedData.normalized,
        orders: [
          { ...validPreprocessedData.normalized.orders[0], raw_data: { order: 'data' } },
        ],
        order_items: [
          { ...validPreprocessedData.normalized.order_items[0], raw_data: { item: 'data' } },
        ],
        payments: [
          { ...validPreprocessedData.normalized.payments[0], raw_data: { pay: 'data' } },
        ],
        product_variations: [
          { ...validPreprocessedData.normalized.product_variations[0], raw_data: { var: 'data' } },
        ],
      },
    };
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('schema.sql')) return 'CREATE TABLE test;';
      if (path.includes('gold_views.sql')) return 'CREATE VIEW test_view;';
      return JSON.stringify(dataWithRawData);
    });

    const result = await loadToDatabase('/path/to/data.json');
    expect(result.success).toBe(true);
  });

  it('handles empty normalized data', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    const emptyData = {
      version: '1.0.0',
      generated_at: '2024-01-15T17:00:00Z',
      normalized: {
        locations: [],
        categories: [],
        products: [],
        product_variations: [],
        product_aliases: [],
        orders: [],
        order_items: [],
        payments: [],
      },
    };
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('schema.sql')) return 'CREATE TABLE test;';
      if (path.includes('gold_views.sql')) return 'CREATE VIEW test_view;';
      return JSON.stringify(emptyData);
    });

    const result = await loadToDatabase('/path/to/data.json');

    expect(result.success).toBe(true);
    expect(result.stats).toEqual({
      locations: 0,
      categories: 0,
      products: 0,
      product_variations: 0,
      product_aliases: 0,
      orders: 0,
      order_items: 0,
      payments: 0,
    });
  });
});
