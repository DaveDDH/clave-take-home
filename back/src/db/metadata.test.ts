import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// Set DATABASE_URL before any imports
beforeAll(() => {
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
});

// Mock the db/index module
jest.unstable_mockModule('./index.js', () => ({
  executeQuery: jest.fn(),
  executeWriteQuery: jest.fn(),
  isReadOnlyQuery: jest.fn(),
}));

const { getMetadata } = await import('./metadata.js');
const { executeQuery } = await import('./index.js');

describe('metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMetadata', () => {
    it('returns location and category names', async () => {
      const mockExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
      mockExecuteQuery
        .mockResolvedValueOnce([{ name: 'Downtown' }, { name: 'Airport' }])
        .mockResolvedValueOnce([{ name: 'Burgers' }, { name: 'Drinks' }]);

      const metadata = await getMetadata();

      expect(metadata).toEqual({
        locationNames: ['Downtown', 'Airport'],
        categoryNames: ['Burgers', 'Drinks'],
      });
    });

    it('returns empty arrays when queries return no results', async () => {
      const mockExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
      mockExecuteQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const metadata = await getMetadata();

      expect(metadata).toEqual({
        locationNames: [],
        categoryNames: [],
      });
    });

    it('returns empty defaults when queries fail', async () => {
      const mockExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
      mockExecuteQuery.mockRejectedValue(new Error('Database error'));

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const metadata = await getMetadata();

      expect(metadata).toEqual({
        locationNames: [],
        categoryNames: [],
      });

      consoleSpy.mockRestore();
    });

    it('queries locations table', async () => {
      const mockExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
      mockExecuteQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await getMetadata();

      expect(mockExecuteQuery).toHaveBeenCalledTimes(2);
      const firstCall = mockExecuteQuery.mock.calls[0][0];
      expect(firstCall).toContain('locations');
    });

    it('queries categories table', async () => {
      const mockExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
      mockExecuteQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await getMetadata();

      expect(mockExecuteQuery).toHaveBeenCalledTimes(2);
      const secondCall = mockExecuteQuery.mock.calls[1][0];
      expect(secondCall).toContain('categories');
    });
  });
});
