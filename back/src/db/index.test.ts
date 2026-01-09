import { describe, it, expect, beforeAll } from '@jest/globals';

// Set DATABASE_URL before importing the module
beforeAll(() => {
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
});

describe('db/index', () => {
  describe('isReadOnlyQuery', () => {
    // Import dynamically after env is set
    let isReadOnlyQuery: (sql: string) => boolean;

    beforeAll(async () => {
      const module = await import('./index.js');
      isReadOnlyQuery = module.isReadOnlyQuery;
    });

    describe('valid read-only queries', () => {
      it('accepts simple SELECT', () => {
        expect(isReadOnlyQuery('SELECT * FROM orders')).toBe(true);
      });

      it('accepts SELECT with WHERE clause', () => {
        expect(isReadOnlyQuery('SELECT id, name FROM products WHERE category_id = 1')).toBe(true);
      });

      it('accepts SELECT with JOIN', () => {
        expect(isReadOnlyQuery('SELECT o.id, l.name FROM orders o JOIN locations l ON o.location_id = l.id')).toBe(true);
      });

      it('accepts SELECT with GROUP BY', () => {
        expect(isReadOnlyQuery('SELECT location_id, COUNT(*) FROM orders GROUP BY location_id')).toBe(true);
      });

      it('accepts SELECT with ORDER BY', () => {
        expect(isReadOnlyQuery('SELECT * FROM products ORDER BY name')).toBe(true);
      });

      it('accepts WITH (CTE) queries', () => {
        expect(isReadOnlyQuery('WITH daily AS (SELECT * FROM orders) SELECT * FROM daily')).toBe(true);
      });

      it('accepts lowercase queries', () => {
        expect(isReadOnlyQuery('select * from orders')).toBe(true);
      });

      it('accepts mixed case queries', () => {
        expect(isReadOnlyQuery('Select * From orders Where id = 1')).toBe(true);
      });

      it('accepts SELECT with column aliases containing keywords', () => {
        expect(isReadOnlyQuery('SELECT created_at, updated_at FROM orders')).toBe(true);
      });

      it('accepts SELECT with subqueries', () => {
        expect(isReadOnlyQuery('SELECT * FROM orders WHERE location_id IN (SELECT id FROM locations)')).toBe(true);
      });
    });

    describe('invalid queries (not read-only)', () => {
      it('rejects INSERT', () => {
        expect(isReadOnlyQuery('INSERT INTO orders (id) VALUES (1)')).toBe(false);
      });

      it('rejects UPDATE', () => {
        expect(isReadOnlyQuery('UPDATE orders SET status = \'completed\'')).toBe(false);
      });

      it('rejects DELETE', () => {
        expect(isReadOnlyQuery('DELETE FROM orders WHERE id = 1')).toBe(false);
      });

      it('rejects DROP', () => {
        expect(isReadOnlyQuery('DROP TABLE orders')).toBe(false);
      });

      it('rejects ALTER', () => {
        expect(isReadOnlyQuery('ALTER TABLE orders ADD COLUMN foo TEXT')).toBe(false);
      });

      it('rejects TRUNCATE', () => {
        expect(isReadOnlyQuery('TRUNCATE TABLE orders')).toBe(false);
      });

      it('rejects CREATE', () => {
        expect(isReadOnlyQuery('CREATE TABLE test (id INT)')).toBe(false);
      });

      it('rejects SELECT with embedded INSERT', () => {
        expect(isReadOnlyQuery('SELECT * FROM orders; INSERT INTO orders (id) VALUES (1)')).toBe(false);
      });

      it('rejects SELECT with embedded UPDATE', () => {
        expect(isReadOnlyQuery('SELECT * FROM orders; UPDATE orders SET status = \'done\'')).toBe(false);
      });

      it('rejects SELECT with embedded DELETE', () => {
        expect(isReadOnlyQuery('SELECT * FROM orders; DELETE FROM orders')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('rejects empty string', () => {
        expect(isReadOnlyQuery('')).toBe(false);
      });

      it('rejects whitespace only', () => {
        expect(isReadOnlyQuery('   ')).toBe(false);
      });

      it('handles leading whitespace', () => {
        expect(isReadOnlyQuery('  SELECT * FROM orders')).toBe(true);
      });

      it('does not match UPDATE in column names (updated_at)', () => {
        expect(isReadOnlyQuery('SELECT updated_at FROM orders')).toBe(true);
      });

      it('does not match DELETE in column names (is_deleted)', () => {
        expect(isReadOnlyQuery('SELECT is_deleted FROM orders')).toBe(true);
      });

      it('does not match CREATE in column names (created_at)', () => {
        expect(isReadOnlyQuery('SELECT created_at FROM orders')).toBe(true);
      });
    });
  });
});
