import { jest, describe, it, expect } from '@jest/globals';
import * as variationPatterns from '../variation-patterns.js';
import * as productGroups from '../product-groups.js';
import { processDoorDashOrders } from './process-doordash.js';
import type { DoorDashData, DbProduct, DbProductVariation } from '../types.js';

// Spy on variation-patterns methods
jest.spyOn(variationPatterns, 'getVariationPatterns').mockReturnValue([]);
jest.spyOn(variationPatterns, 'getAbbreviationMap').mockReturnValue({});

// Spy on product-groups methods
jest.spyOn(productGroups, 'matchProductToGroup').mockReturnValue(null);

describe('processDoorDashOrders', () => {
  const createMockDoorDashData = (): DoorDashData => ({
    merchant: { merchant_id: 'merch-1', business_name: 'Test Restaurant', currency: 'USD' },
    stores: [],
    orders: [{
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
        special_instructions: 'No pickles',
        options: [{ name: 'Extra Cheese', price: 100 }],
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
    }],
  });

  const locationMap = new Map([['store-1', 'unified-loc-1']]);
  const products: Array<DbProduct & { id: string }> = [
    { id: 'prod-1', name: 'Hamburger' },
  ];
  const variations: Array<DbProductVariation & { id: string }> = [];
  const variationMap = new Map<string, string>();

  it('processes valid DoorDash order', () => {
    const data = createMockDoorDashData();
    const addAlias = jest.fn();

    const result = processDoorDashOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(result.orders).toHaveLength(1);
    expect(result.items).toHaveLength(1);
    expect(result.payments).toHaveLength(1);
  });

  it('creates order with correct properties', () => {
    const data = createMockDoorDashData();
    const addAlias = jest.fn();

    const { orders } = processDoorDashOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(orders[0].source).toBe('doordash');
    expect(orders[0].source_order_id).toBe('dd-order-1');
    expect(orders[0].location_id).toBe('unified-loc-1');
    expect(orders[0].order_type).toBe('delivery');
    expect(orders[0].channel).toBe('doordash');
    expect(orders[0].status).toBe('completed');
  });

  it('calculates order totals correctly', () => {
    const data = createMockDoorDashData();
    const addAlias = jest.fn();

    const { orders } = processDoorDashOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(orders[0].subtotal_cents).toBe(1998);
    expect(orders[0].tax_cents).toBe(160);
    expect(orders[0].tip_cents).toBe(500);
    expect(orders[0].total_cents).toBe(3256);
    expect(orders[0].delivery_fee_cents).toBe(399);
    expect(orders[0].service_fee_cents).toBe(199);
    expect(orders[0].commission_cents).toBe(300);
  });

  it('stores alcohol and catering flags', () => {
    const data = createMockDoorDashData();
    data.orders[0].contains_alcohol = true;
    data.orders[0].is_catering = true;
    const addAlias = jest.fn();

    const { orders } = processDoorDashOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(orders[0].contains_alcohol).toBe(true);
    expect(orders[0].is_catering).toBe(true);
  });

  it('creates order items correctly', () => {
    const data = createMockDoorDashData();
    const addAlias = jest.fn();

    const { items } = processDoorDashOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(items[0].original_name).toBe('Hamburger');
    expect(items[0].quantity).toBe(2);
    expect(items[0].unit_price_cents).toBe(999);
    expect(items[0].total_price_cents).toBe(1998);
    expect(items[0].special_instructions).toBe('No pickles');
  });

  it('includes item modifiers', () => {
    const data = createMockDoorDashData();
    const addAlias = jest.fn();

    const { items } = processDoorDashOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(items[0].modifiers).toEqual([{ name: 'Extra Cheese', price: 100 }]);
  });

  it('creates DoorDash platform payment', () => {
    const data = createMockDoorDashData();
    const addAlias = jest.fn();

    const { payments } = processDoorDashOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(payments[0].payment_type).toBe('doordash');
    expect(payments[0].amount_cents).toBe(2456); // merchant_payout
    expect(payments[0].tip_cents).toBe(500);
    expect(payments[0].processing_fee_cents).toBe(300); // commission
  });

  it('skips orders with unknown location', () => {
    const data = createMockDoorDashData();
    data.orders[0].store_id = 'unknown-store';
    const addAlias = jest.fn();

    const result = processDoorDashOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(result.orders).toHaveLength(0);
  });

  it('calls addAlias for matched products', () => {
    const data = createMockDoorDashData();
    const addAlias = jest.fn();

    processDoorDashOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(addAlias).toHaveBeenCalledWith('prod-1', 'Hamburger', 'doordash');
  });

  it('maps PICKUP fulfillment method', () => {
    const data = createMockDoorDashData();
    data.orders[0].order_fulfillment_method = 'PICKUP';
    const addAlias = jest.fn();

    const { orders } = processDoorDashOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(orders[0].order_type).toBe('pickup');
  });

  it('uses pickup_time when delivery_time is null', () => {
    const data = createMockDoorDashData();
    data.orders[0].delivery_time = null;
    const addAlias = jest.fn();

    const { orders, payments } = processDoorDashOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(orders[0].closed_at).toBe('2024-01-15T12:30:00Z');
    expect(payments[0].created_at).toBe('2024-01-15T12:30:00Z');
  });

  it('handles empty special_instructions', () => {
    const data = createMockDoorDashData();
    data.orders[0].order_items[0].special_instructions = '';
    const addAlias = jest.fn();

    const { items } = processDoorDashOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(items[0].special_instructions).toBeUndefined();
  });
});
