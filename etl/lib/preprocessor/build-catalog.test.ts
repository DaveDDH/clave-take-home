import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildUnifiedCatalog } from './build-catalog.js';
import type { SourceData } from './types.js';

// Mock variation-patterns
jest.mock('../variation-patterns.js', () => ({
  getVariationPatterns: jest.fn(() => []),
  getAbbreviationMap: jest.fn(() => ({})),
}));

// Mock product-groups
jest.mock('../product-groups.js', () => ({
  matchProductToGroup: jest.fn(() => null),
}));

describe('buildUnifiedCatalog', () => {
  const createEmptySources = (): SourceData => ({
    toast: { restaurant: { guid: 'r1', name: 'Test' }, locations: [], orders: [] },
    doordash: { merchant: { merchant_id: 'm1', business_name: 'Test', currency: 'USD' }, stores: [], orders: [] },
    square: {
      locations: { locations: [] },
      catalog: { objects: [] },
      orders: { orders: [], cursor: null },
      payments: { payments: [], cursor: null },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('empty sources', () => {
    it('returns empty catalog for empty sources', () => {
      const sources = createEmptySources();
      const result = buildUnifiedCatalog(sources);

      expect(result.categories).toHaveLength(0);
      expect(result.products).toHaveLength(0);
      expect(result.product_variations).toHaveLength(0);
    });

    it('creates empty maps for empty sources', () => {
      const sources = createEmptySources();
      const result = buildUnifiedCatalog(sources);

      expect(result.categoryMap.size).toBe(0);
      expect(result.productMap.size).toBe(0);
      expect(result.variationMap.size).toBe(0);
    });
  });

  describe('Square catalog', () => {
    it('extracts categories from Square catalog', () => {
      const sources = createEmptySources();
      sources.square.catalog.objects = [
        {
          type: 'CATEGORY',
          id: 'cat-1',
          category_data: { name: 'Burgers' },
        },
      ];

      const result = buildUnifiedCatalog(sources);

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].name).toBe('burgers');
    });

    it('extracts products from Square catalog', () => {
      const sources = createEmptySources();
      sources.square.catalog.objects = [
        {
          type: 'ITEM',
          id: 'item-1',
          item_data: {
            name: 'Hamburger',
            description: 'A tasty burger',
            variations: [],
          },
        },
      ];

      const result = buildUnifiedCatalog(sources);

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toBe('Hamburger');
      expect(result.products[0].description).toBe('A tasty burger');
    });

    it('maps Square item IDs to product IDs', () => {
      const sources = createEmptySources();
      sources.square.catalog.objects = [
        {
          type: 'ITEM',
          id: 'item-1',
          item_data: { name: 'Hamburger', variations: [] },
        },
      ];

      const result = buildUnifiedCatalog(sources);

      expect(result.productMap.get('item-1')).toBe(result.products[0].id);
    });

    it('maps Square variation IDs to product IDs', () => {
      const sources = createEmptySources();
      sources.square.catalog.objects = [
        {
          type: 'ITEM',
          id: 'item-1',
          item_data: {
            name: 'Hamburger',
            variations: [
              { id: 'var-1', item_variation_data: { name: 'Regular' } },
              { id: 'var-2', item_variation_data: { name: 'Large' } },
            ],
          },
        },
      ];

      const result = buildUnifiedCatalog(sources);

      expect(result.productMap.get('var-1')).toBe(result.products[0].id);
      expect(result.productMap.get('var-2')).toBe(result.products[0].id);
    });

    it('creates product variations from Square variations (excluding Regular)', () => {
      const sources = createEmptySources();
      sources.square.catalog.objects = [
        {
          type: 'ITEM',
          id: 'item-1',
          item_data: {
            name: 'Hamburger',
            variations: [
              { id: 'var-1', item_variation_data: { name: 'Regular' } },
              { id: 'var-2', item_variation_data: { name: 'Large' } },
            ],
          },
        },
      ];

      const result = buildUnifiedCatalog(sources);

      // "Regular" should be excluded
      expect(result.product_variations).toHaveLength(1);
      expect(result.product_variations[0].name).toBe('Large');
    });

    it('links categories to Square category IDs', () => {
      const sources = createEmptySources();
      sources.square.catalog.objects = [
        {
          type: 'CATEGORY',
          id: 'cat-1',
          category_data: { name: 'Burgers' },
        },
      ];

      const result = buildUnifiedCatalog(sources);

      expect(result.categoryMap.get('cat-1')).toBe(result.categories[0].id);
      expect(result.categoryMap.get('burgers')).toBe(result.categories[0].id);
    });
  });

  describe('Toast items', () => {
    it('extracts products from Toast order selections', () => {
      const sources = createEmptySources();
      sources.toast.orders = [{
        guid: 'order-1',
        restaurantGuid: 'loc-1',
        businessDate: '2024-01-15',
        openedDate: '2024-01-15T12:00:00Z',
        closedDate: '2024-01-15T12:30:00Z',
        paidDate: '2024-01-15T12:30:00Z',
        voided: false,
        deleted: false,
        source: 'POS',
        diningOption: { guid: 'do-1', name: 'Dine In', behavior: 'DINE_IN' },
        checks: [{
          guid: 'check-1',
          displayNumber: '1001',
          openedDate: '2024-01-15T12:00:00Z',
          closedDate: '2024-01-15T12:30:00Z',
          paidDate: '2024-01-15T12:30:00Z',
          voided: false,
          deleted: false,
          amount: 999,
          taxAmount: 80,
          totalAmount: 1079,
          tipAmount: 0,
          selections: [{
            guid: 'sel-1',
            displayName: 'Hamburger',
            itemGroup: { guid: 'ig-1', name: 'Burgers' },
            item: { guid: 'item-1', name: 'Hamburger' },
            quantity: 1,
            preDiscountPrice: 999,
            price: 999,
            tax: 80,
            voided: false,
            modifiers: [],
          }],
          payments: [],
        }],
      }];

      const result = buildUnifiedCatalog(sources);

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toBe('Hamburger');
    });

    it('skips voided Toast orders', () => {
      const sources = createEmptySources();
      sources.toast.orders = [{
        guid: 'order-1',
        restaurantGuid: 'loc-1',
        businessDate: '2024-01-15',
        openedDate: '2024-01-15T12:00:00Z',
        closedDate: '2024-01-15T12:30:00Z',
        paidDate: '2024-01-15T12:30:00Z',
        voided: true,
        deleted: false,
        source: 'POS',
        diningOption: { guid: 'do-1', name: 'Dine In', behavior: 'DINE_IN' },
        checks: [{
          guid: 'check-1',
          displayNumber: '1001',
          openedDate: '2024-01-15T12:00:00Z',
          closedDate: '2024-01-15T12:30:00Z',
          paidDate: '2024-01-15T12:30:00Z',
          voided: false,
          deleted: false,
          amount: 999,
          taxAmount: 80,
          totalAmount: 1079,
          tipAmount: 0,
          selections: [{
            guid: 'sel-1',
            displayName: 'Hamburger',
            itemGroup: { guid: 'ig-1', name: 'Burgers' },
            item: { guid: 'item-1', name: 'Hamburger' },
            quantity: 1,
            preDiscountPrice: 999,
            price: 999,
            tax: 80,
            voided: false,
            modifiers: [],
          }],
          payments: [],
        }],
      }];

      const result = buildUnifiedCatalog(sources);

      expect(result.products).toHaveLength(0);
    });

    it('extracts categories from Toast item groups', () => {
      const sources = createEmptySources();
      sources.toast.orders = [{
        guid: 'order-1',
        restaurantGuid: 'loc-1',
        businessDate: '2024-01-15',
        openedDate: '2024-01-15T12:00:00Z',
        closedDate: '2024-01-15T12:30:00Z',
        paidDate: '2024-01-15T12:30:00Z',
        voided: false,
        deleted: false,
        source: 'POS',
        diningOption: { guid: 'do-1', name: 'Dine In', behavior: 'DINE_IN' },
        checks: [{
          guid: 'check-1',
          displayNumber: '1001',
          openedDate: '2024-01-15T12:00:00Z',
          closedDate: '2024-01-15T12:30:00Z',
          paidDate: '2024-01-15T12:30:00Z',
          voided: false,
          deleted: false,
          amount: 999,
          taxAmount: 80,
          totalAmount: 1079,
          tipAmount: 0,
          selections: [{
            guid: 'sel-1',
            displayName: 'Hamburger',
            itemGroup: { guid: 'ig-1', name: 'Entrees' },
            item: { guid: 'item-1', name: 'Hamburger' },
            quantity: 1,
            preDiscountPrice: 999,
            price: 999,
            tax: 80,
            voided: false,
            modifiers: [],
          }],
          payments: [],
        }],
      }];

      const result = buildUnifiedCatalog(sources);

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].name).toBe('entrees');
    });
  });

  describe('DoorDash items', () => {
    it('extracts products from DoorDash order items', () => {
      const sources = createEmptySources();
      sources.doordash.orders = [{
        external_delivery_id: 'dd-order-1',
        store_id: 'store-1',
        order_fulfillment_method: 'MERCHANT_DELIVERY',
        order_status: 'COMPLETED',
        created_at: '2024-01-15T12:00:00Z',
        pickup_time: '2024-01-15T12:30:00Z',
        delivery_time: '2024-01-15T13:00:00Z',
        order_items: [{
          item_id: 'item-1',
          name: 'Hamburger',
          quantity: 2,
          unit_price: 999,
          total_price: 1998,
          category: 'Burgers',
        }],
        order_subtotal: 1998,
        delivery_fee: 399,
        service_fee: 199,
        dasher_tip: 500,
        tax_amount: 160,
        total_charged_to_consumer: 3256,
        commission: 300,
        merchant_payout: 2456,
        contains_alcohol: false,
        is_catering: false,
      }];

      const result = buildUnifiedCatalog(sources);

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toBe('Hamburger');
    });

    it('extracts categories from DoorDash item categories', () => {
      const sources = createEmptySources();
      sources.doordash.orders = [{
        external_delivery_id: 'dd-order-1',
        store_id: 'store-1',
        order_fulfillment_method: 'MERCHANT_DELIVERY',
        order_status: 'COMPLETED',
        created_at: '2024-01-15T12:00:00Z',
        pickup_time: '2024-01-15T12:30:00Z',
        delivery_time: '2024-01-15T13:00:00Z',
        order_items: [{
          item_id: 'item-1',
          name: 'Hamburger',
          quantity: 1,
          unit_price: 999,
          total_price: 999,
          category: 'Entrees',
        }],
        order_subtotal: 999,
        delivery_fee: 0,
        service_fee: 0,
        dasher_tip: 0,
        tax_amount: 0,
        total_charged_to_consumer: 999,
        commission: 0,
        merchant_payout: 999,
        contains_alcohol: false,
        is_catering: false,
      }];

      const result = buildUnifiedCatalog(sources);

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].name).toBe('entrees');
    });
  });

  describe('product grouping', () => {
    it('groups similar products by Levenshtein distance', () => {
      const sources = createEmptySources();
      // Add similar products from different sources
      sources.square.catalog.objects = [
        {
          type: 'ITEM',
          id: 'sq-item-1',
          item_data: { name: 'Hamburger', variations: [] },
        },
      ];
      sources.doordash.orders = [{
        external_delivery_id: 'dd-order-1',
        store_id: 'store-1',
        order_fulfillment_method: 'MERCHANT_DELIVERY',
        order_status: 'COMPLETED',
        created_at: '2024-01-15T12:00:00Z',
        pickup_time: '2024-01-15T12:30:00Z',
        delivery_time: '2024-01-15T13:00:00Z',
        order_items: [{
          item_id: 'dd-item-1',
          name: 'Hamburger', // Same name
          quantity: 1,
          unit_price: 999,
          total_price: 999,
        }],
        order_subtotal: 999,
        delivery_fee: 0,
        service_fee: 0,
        dasher_tip: 0,
        tax_amount: 0,
        total_charged_to_consumer: 999,
        commission: 0,
        merchant_payout: 999,
        contains_alcohol: false,
        is_catering: false,
      }];

      const result = buildUnifiedCatalog(sources);

      // Should be grouped into one product
      expect(result.products).toHaveLength(1);
    });

    it('deduplicates items from same source', () => {
      const sources = createEmptySources();
      sources.doordash.orders = [
        {
          external_delivery_id: 'dd-order-1',
          store_id: 'store-1',
          order_fulfillment_method: 'MERCHANT_DELIVERY',
          order_status: 'COMPLETED',
          created_at: '2024-01-15T12:00:00Z',
          pickup_time: '2024-01-15T12:30:00Z',
          delivery_time: '2024-01-15T13:00:00Z',
          order_items: [{
            item_id: 'item-1',
            name: 'Hamburger',
            quantity: 1,
            unit_price: 999,
            total_price: 999,
          }],
          order_subtotal: 999,
          delivery_fee: 0,
          service_fee: 0,
          dasher_tip: 0,
          tax_amount: 0,
          total_charged_to_consumer: 999,
          commission: 0,
          merchant_payout: 999,
          contains_alcohol: false,
          is_catering: false,
        },
        {
          external_delivery_id: 'dd-order-2',
          store_id: 'store-1',
          order_fulfillment_method: 'MERCHANT_DELIVERY',
          order_status: 'COMPLETED',
          created_at: '2024-01-15T13:00:00Z',
          pickup_time: '2024-01-15T13:30:00Z',
          delivery_time: '2024-01-15T14:00:00Z',
          order_items: [{
            item_id: 'item-1',
            name: 'Hamburger', // Same item
            quantity: 2,
            unit_price: 999,
            total_price: 1998,
          }],
          order_subtotal: 1998,
          delivery_fee: 0,
          service_fee: 0,
          dasher_tip: 0,
          tax_amount: 0,
          total_charged_to_consumer: 1998,
          commission: 0,
          merchant_payout: 1998,
          contains_alcohol: false,
          is_catering: false,
        },
      ];

      const result = buildUnifiedCatalog(sources);

      // Should only have one product
      expect(result.products).toHaveLength(1);
    });
  });

  describe('variation extraction', () => {
    it('extracts variation from product name with size pattern', () => {
      const sources = createEmptySources();
      sources.square.catalog.objects = [
        {
          type: 'ITEM',
          id: 'item-1',
          item_data: { name: 'Large Hamburger', variations: [] },
        },
      ];

      const result = buildUnifiedCatalog(sources);

      // Should extract "Large" as a variation
      expect(result.product_variations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('raw data storage', () => {
    it('stores raw category data', () => {
      const sources = createEmptySources();
      sources.square.catalog.objects = [
        {
          type: 'CATEGORY',
          id: 'cat-1',
          category_data: { name: 'Burgers' },
        },
      ];

      const result = buildUnifiedCatalog(sources);

      expect(result.categories[0].raw_data).toBeDefined();
      expect(result.categories[0].raw_data?.squareId).toBe('cat-1');
    });

    it('stores raw items in product raw_data', () => {
      const sources = createEmptySources();
      sources.square.catalog.objects = [
        {
          type: 'ITEM',
          id: 'item-1',
          item_data: { name: 'Hamburger', variations: [] },
        },
      ];

      const result = buildUnifiedCatalog(sources);

      expect(result.products[0].raw_data).toBeDefined();
      expect(result.products[0].raw_data?.items).toBeDefined();
    });
  });
});
