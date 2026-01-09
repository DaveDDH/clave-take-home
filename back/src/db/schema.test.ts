import { describe, it, expect } from '@jest/globals';
import { FULL_SCHEMA, TABLE_DESCRIPTIONS, COLUMN_INFO } from './schema.js';

describe('schema', () => {
  describe('FULL_SCHEMA', () => {
    it('is a non-empty string', () => {
      expect(typeof FULL_SCHEMA).toBe('string');
      expect(FULL_SCHEMA.length).toBeGreaterThan(0);
    });

    it('contains Gold layer tables', () => {
      expect(FULL_SCHEMA).toContain('gold_orders');
      expect(FULL_SCHEMA).toContain('gold_order_items');
      expect(FULL_SCHEMA).toContain('gold_daily_sales');
      expect(FULL_SCHEMA).toContain('gold_product_performance');
      expect(FULL_SCHEMA).toContain('gold_hourly_trends');
    });

    it('contains Silver layer tables', () => {
      expect(FULL_SCHEMA).toContain('locations');
      expect(FULL_SCHEMA).toContain('categories');
      expect(FULL_SCHEMA).toContain('products');
      expect(FULL_SCHEMA).toContain('orders');
      expect(FULL_SCHEMA).toContain('order_items');
      expect(FULL_SCHEMA).toContain('payments');
    });
  });

  describe('TABLE_DESCRIPTIONS', () => {
    it('is an object with table descriptions', () => {
      expect(typeof TABLE_DESCRIPTIONS).toBe('object');
    });

    it('contains all expected tables', () => {
      expect(TABLE_DESCRIPTIONS.locations).toBeDefined();
      expect(TABLE_DESCRIPTIONS.categories).toBeDefined();
      expect(TABLE_DESCRIPTIONS.products).toBeDefined();
      expect(TABLE_DESCRIPTIONS.orders).toBeDefined();
      expect(TABLE_DESCRIPTIONS.order_items).toBeDefined();
      expect(TABLE_DESCRIPTIONS.payments).toBeDefined();
    });

    it('has non-empty descriptions', () => {
      Object.values(TABLE_DESCRIPTIONS).forEach((desc) => {
        expect(typeof desc).toBe('string');
        expect(desc.length).toBeGreaterThan(0);
      });
    });
  });

  describe('COLUMN_INFO', () => {
    it('contains moneyColumns array', () => {
      expect(Array.isArray(COLUMN_INFO.moneyColumns)).toBe(true);
      expect(COLUMN_INFO.moneyColumns).toContain('subtotal_cents');
      expect(COLUMN_INFO.moneyColumns).toContain('total_cents');
    });

    it('contains orderTypes array', () => {
      expect(Array.isArray(COLUMN_INFO.orderTypes)).toBe(true);
      expect(COLUMN_INFO.orderTypes).toContain('dine_in');
      expect(COLUMN_INFO.orderTypes).toContain('delivery');
    });

    it('contains channels array', () => {
      expect(Array.isArray(COLUMN_INFO.channels)).toBe(true);
      expect(COLUMN_INFO.channels).toContain('pos');
      expect(COLUMN_INFO.channels).toContain('online');
    });

    it('contains sources array', () => {
      expect(Array.isArray(COLUMN_INFO.sources)).toBe(true);
      expect(COLUMN_INFO.sources).toContain('toast');
      expect(COLUMN_INFO.sources).toContain('doordash');
      expect(COLUMN_INFO.sources).toContain('square');
    });

    it('contains paymentTypes array', () => {
      expect(Array.isArray(COLUMN_INFO.paymentTypes)).toBe(true);
      expect(COLUMN_INFO.paymentTypes).toContain('credit');
      expect(COLUMN_INFO.paymentTypes).toContain('cash');
    });
  });
});
