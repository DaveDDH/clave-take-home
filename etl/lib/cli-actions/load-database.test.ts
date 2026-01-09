import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Create mock functions
const mockReadFileSync = jest.fn<(path: string, encoding: string) => string>();

// Mock node:fs module using unstable_mockModule for ESM
jest.unstable_mockModule('node:fs', () => ({
  readFileSync: mockReadFileSync,
}));

// Dynamic imports after mock setup
const { loadToDatabase } = await import('./load-database.js');

describe('loadToDatabase', () => {
  const validPreprocessedData = {
    version: '1.0.0',
    generated_at: '2024-01-15T17:00:00Z',
    normalized: {
      locations: [{ id: 'loc-1', name: 'Downtown', timezone: 'America/New_York' }],
      categories: [{ id: 'cat-1', name: 'Burgers' }],
      products: [{ id: 'prod-1', name: 'Hamburger', category_id: 'cat-1' }],
      product_variations: [{ id: 'var-1', product_id: 'prod-1', name: 'Large' }],
      product_aliases: [{ id: 'alias-1', product_id: 'prod-1', raw_name: 'Burger', source: 'toast' }],
      orders: [{ id: 'order-1', source: 'toast', source_order_id: 'toast-1', location_id: 'loc-1', order_type: 'dine_in', channel: 'pos', status: 'completed', created_at: '2024-01-15T12:00:00Z', closed_at: '2024-01-15T12:30:00Z', subtotal_cents: 999, tax_cents: 80, tip_cents: 0, total_cents: 1079 }],
      order_items: [{ id: 'item-1', order_id: 'order-1', product_id: 'prod-1', original_name: 'Hamburger', quantity: 1, total_price_cents: 999, modifiers: [] }],
      payments: [{ id: 'pay-1', order_id: 'order-1', source_payment_id: 'toast-pay-1', payment_type: 'credit', amount_cents: 1079, created_at: '2024-01-15T12:30:00Z' }],
    },
  };

  let originalEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env.DATABASE_URL;
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

  it('attempts database connection with valid preprocessed data', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    mockReadFileSync.mockReturnValue(JSON.stringify(validPreprocessedData));

    const result = await loadToDatabase('/path/to/data.json');

    // Will fail because no actual database, but shows it tried to connect
    expect(result.success).toBe(false);
    // The error should be about database connection, not validation
    expect(result.error).not.toContain('Invalid preprocessed data file format');
    expect(result.error).not.toContain('Missing DATABASE_URL');
  });
});
