import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// Set DATABASE_URL before any imports
beforeAll(() => {
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
});

// Mock the db/index module
jest.unstable_mockModule('#db/index.js', () => ({
  executeQuery: jest.fn(),
  executeWriteQuery: jest.fn(),
  isReadOnlyQuery: jest.fn(),
}));

const { getDataContext } = await import('./data-context.js');
const { executeQuery } = await import('#db/index.js');

describe('data-context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDataContext', () => {
    it('returns order date range when query succeeds', async () => {
      const mockExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
      mockExecuteQuery.mockResolvedValueOnce([
        { min_date: '2024-01-01', max_date: '2024-01-31' },
      ]);

      const context = await getDataContext();

      expect(context).toEqual({
        orderDateRange: {
          earliest: '2024-01-01',
          latest: '2024-01-31',
        },
      });
    });

    it('returns null orderDateRange when query returns empty results', async () => {
      const mockExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
      mockExecuteQuery.mockResolvedValueOnce([]);

      const context = await getDataContext();

      expect(context).toEqual({
        orderDateRange: null,
      });
    });

    it('returns null orderDateRange when query fails', async () => {
      const mockExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
      mockExecuteQuery.mockRejectedValueOnce(new Error('Database error'));

      // Suppress console.warn for this test
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const context = await getDataContext();

      expect(context).toEqual({
        orderDateRange: null,
      });

      consoleSpy.mockRestore();
    });

    it('returns null orderDateRange when dates are null', async () => {
      const mockExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
      mockExecuteQuery.mockResolvedValueOnce([
        { min_date: null, max_date: null },
      ]);

      const context = await getDataContext();

      expect(context).toEqual({
        orderDateRange: null,
      });
    });

    it('calls executeQuery with correct SQL', async () => {
      const mockExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
      mockExecuteQuery.mockResolvedValueOnce([]);

      await getDataContext();

      expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
      const sql = mockExecuteQuery.mock.calls[0][0];
      expect(sql).toContain('SELECT');
      expect(sql).toContain('MIN');
      expect(sql).toContain('MAX');
    });
  });
});
