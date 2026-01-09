import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import * as variationPatterns from '../variation-patterns.js';
import * as productGroups from '../product-groups.js';
import { preprocessData } from './index.js';
import type { SourceData } from './types.js';
import type { LocationConfig } from '../types.js';

// Spy on variation-patterns methods
jest.spyOn(variationPatterns, 'getVariationPatterns').mockReturnValue([]);
jest.spyOn(variationPatterns, 'getAbbreviationMap').mockReturnValue({});

// Spy on product-groups methods
jest.spyOn(productGroups, 'matchProductToGroup').mockReturnValue(null);

describe('preprocessData', () => {
  const createMockSources = (): SourceData => ({
    toast: {
      restaurant: { guid: 'r1', name: 'Test Restaurant' },
      locations: [],
      orders: [{
        guid: 'toast-order-1',
        restaurantGuid: 'toast-loc-1',
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
          tipAmount: 200,
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
          payments: [{
            guid: 'pay-1',
            paidDate: '2024-01-15T12:30:00Z',
            type: 'CREDIT',
            cardType: 'VISA',
            last4Digits: '4242',
            amount: 1079,
            tipAmount: 200,
            originalProcessingFee: 32,
            refundStatus: 'NONE',
          }],
        }],
      }],
    },
    doordash: {
      merchant: { merchant_id: 'm1', business_name: 'Test Restaurant', currency: 'USD' },
      stores: [],
      orders: [{
        external_delivery_id: 'dd-order-1',
        store_id: 'dd-store-1',
        order_fulfillment_method: 'MERCHANT_DELIVERY',
        order_status: 'COMPLETED',
        created_at: '2024-01-15T14:00:00Z',
        pickup_time: '2024-01-15T14:30:00Z',
        delivery_time: '2024-01-15T15:00:00Z',
        order_items: [{
          item_id: 'dd-item-1',
          name: 'Pizza',
          quantity: 1,
          unit_price: 1499,
          total_price: 1499,
          category: 'Pizza',
        }],
        order_subtotal: 1499,
        delivery_fee: 399,
        service_fee: 199,
        dasher_tip: 300,
        tax_amount: 120,
        total_charged_to_consumer: 2517,
        commission: 300,
        merchant_payout: 2217,
        contains_alcohol: false,
        is_catering: false,
      }],
    },
    square: {
      locations: { locations: [] },
      catalog: {
        objects: [
          {
            type: 'CATEGORY',
            id: 'sq-cat-1',
            category_data: { name: 'Burgers' },
          },
          {
            type: 'ITEM',
            id: 'sq-item-1',
            item_data: {
              name: 'Hamburger',
              category_id: 'sq-cat-1',
              variations: [
                { id: 'sq-var-1', item_variation_data: { name: 'Regular', item_id: 'sq-item-1', pricing_type: 'FIXED', price_money: { amount: 999, currency: 'USD' } } },
              ],
            },
          },
        ],
      },
      orders: {
        orders: [{
          id: 'sq-order-1',
          location_id: 'sq-loc-1',
          reference_id: 'ref-1',
          source: { name: 'Square POS' },
          created_at: '2024-01-15T16:00:00Z',
          updated_at: '2024-01-15T16:30:00Z',
          closed_at: '2024-01-15T16:30:00Z',
          state: 'COMPLETED',
          version: 1,
          line_items: [{
            uid: 'li-1',
            catalog_object_id: 'sq-var-1',
            quantity: '1',
            item_type: 'ITEM',
            gross_sales_money: { amount: 999, currency: 'USD' },
            total_money: { amount: 999, currency: 'USD' },
          }],
          fulfillments: [{ uid: 'ful-1', type: 'PICKUP', state: 'COMPLETED' }],
          total_money: { amount: 1079, currency: 'USD' },
          total_tax_money: { amount: 80, currency: 'USD' },
          total_tip_money: { amount: 0, currency: 'USD' },
        }],
        cursor: null,
      },
      payments: {
        payments: [{
          id: 'sq-pay-1',
          order_id: 'sq-order-1',
          location_id: 'sq-loc-1',
          created_at: '2024-01-15T16:30:00Z',
          updated_at: '2024-01-15T16:30:00Z',
          amount_money: { amount: 1079, currency: 'USD' },
          tip_money: { amount: 0, currency: 'USD' },
          total_money: { amount: 1079, currency: 'USD' },
          status: 'COMPLETED',
          source_type: 'CARD',
          card_details: {
            status: 'CAPTURED',
            entry_method: 'KEYED',
            card: { card_brand: 'VISA', last_4: '1234' },
          },
        }],
        cursor: null,
      },
    },
  });

  const locationConfigs: LocationConfig[] = [
    { name: 'Downtown', toast_id: 'toast-loc-1', doordash_id: 'dd-store-1', square_id: 'sq-loc-1' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes all sources and returns normalized data', () => {
    const sources = createMockSources();
    const result = preprocessData(sources, locationConfigs);

    expect(result.locations).toBeDefined();
    expect(result.categories).toBeDefined();
    expect(result.products).toBeDefined();
    expect(result.product_variations).toBeDefined();
    expect(result.product_aliases).toBeDefined();
    expect(result.orders).toBeDefined();
    expect(result.order_items).toBeDefined();
    expect(result.payments).toBeDefined();
  });

  it('creates locations from config', () => {
    const sources = createMockSources();
    const result = preprocessData(sources, locationConfigs);

    expect(result.locations).toHaveLength(1);
    expect(result.locations[0].name).toBe('Downtown');
  });

  it('processes orders from all sources', () => {
    const sources = createMockSources();
    const result = preprocessData(sources, locationConfigs);

    // 1 Toast + 1 DoorDash + 1 Square
    expect(result.orders).toHaveLength(3);
  });

  it('processes payments from all sources', () => {
    const sources = createMockSources();
    const result = preprocessData(sources, locationConfigs);

    // 1 Toast + 1 DoorDash + 1 Square
    expect(result.payments).toHaveLength(3);
  });

  it('creates product aliases from Square catalog items', () => {
    const sources = createMockSources();
    const result = preprocessData(sources, locationConfigs);

    // Should have alias for Square catalog item
    const squareAliases = result.product_aliases.filter(a => a.source === 'square');
    expect(squareAliases.length).toBeGreaterThanOrEqual(1);
  });

  it('creates product aliases without duplicates', () => {
    const sources = createMockSources();
    const result = preprocessData(sources, locationConfigs);

    // Check no duplicate aliases
    const aliasKeys = result.product_aliases.map(a => `${a.raw_name.toLowerCase()}:${a.source}`);
    const uniqueKeys = [...new Set(aliasKeys)];
    expect(aliasKeys.length).toBe(uniqueKeys.length);
  });

  it('maps orders to correct location IDs', () => {
    const sources = createMockSources();
    const result = preprocessData(sources, locationConfigs);

    const locationId = result.locations[0].id;

    // All orders should be mapped to the same location
    for (const order of result.orders) {
      expect(order.location_id).toBe(locationId);
    }
  });

  it('assigns unique IDs to all entities', () => {
    const sources = createMockSources();
    const result = preprocessData(sources, locationConfigs);

    // Check all IDs are UUIDs (basic check: 36 chars with hyphens)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const loc of result.locations) {
      expect(loc.id).toMatch(uuidRegex);
    }
    for (const order of result.orders) {
      expect(order.id).toMatch(uuidRegex);
    }
    for (const item of result.order_items) {
      expect(item.id).toMatch(uuidRegex);
    }
  });

  it('handles empty location configs', () => {
    const sources = createMockSources();
    const result = preprocessData(sources, []);

    expect(result.locations).toHaveLength(0);
    // Orders should be skipped since no locations are mapped
    expect(result.orders).toHaveLength(0);
  });

  it('processes multiple orders per source', () => {
    const sources = createMockSources();
    // Add another DoorDash order
    sources.doordash.orders.push({
      external_delivery_id: 'dd-order-2',
      store_id: 'dd-store-1',
      order_fulfillment_method: 'PICKUP',
      order_status: 'COMPLETED',
      created_at: '2024-01-15T17:00:00Z',
      pickup_time: '2024-01-15T17:30:00Z',
      delivery_time: null,
      order_items: [{
        item_id: 'dd-item-2',
        name: 'Salad',
        quantity: 1,
        unit_price: 899,
        total_price: 899,
      }],
      order_subtotal: 899,
      delivery_fee: 0,
      service_fee: 0,
      dasher_tip: 0,
      tax_amount: 72,
      total_charged_to_consumer: 971,
      commission: 100,
      merchant_payout: 871,
      contains_alcohol: false,
      is_catering: false,
    });

    const result = preprocessData(sources, locationConfigs);

    // 1 Toast + 2 DoorDash + 1 Square
    expect(result.orders).toHaveLength(4);
  });
});
