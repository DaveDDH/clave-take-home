import { jest, describe, it, expect } from '@jest/globals';
import type { ToastData, DbProduct, DbProductVariation } from '../types.js';

// Mock modules using unstable_mockModule for ESM
jest.unstable_mockModule('../variation-patterns.js', () => ({
  getVariationPatterns: jest.fn(() => []),
  getAbbreviationMap: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../product-groups.js', () => ({
  matchProductToGroup: jest.fn(() => null),
}));

// Dynamic import after mock setup
const { processToastOrders } = await import('./process-toast.js');

describe('processToastOrders', () => {
  const createMockToastData = (): ToastData => ({
    restaurant: { guid: 'rest-1', name: 'Test Restaurant' },
    locations: [],
    orders: [{
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
  });

  const locationMap = new Map([['loc-1', 'unified-loc-1']]);
  const products: Array<DbProduct & { id: string }> = [
    { id: 'prod-1', name: 'Hamburger' },
  ];
  const variations: Array<DbProductVariation & { id: string }> = [];
  const variationMap = new Map<string, string>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes valid Toast order', () => {
    const data = createMockToastData();
    const addAlias = jest.fn();

    const result = processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(result.orders).toHaveLength(1);
    expect(result.items).toHaveLength(1);
    expect(result.payments).toHaveLength(1);
  });

  it('creates order with correct properties', () => {
    const data = createMockToastData();
    const addAlias = jest.fn();

    const { orders } = processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(orders[0].source).toBe('toast');
    expect(orders[0].source_order_id).toBe('order-1');
    expect(orders[0].location_id).toBe('unified-loc-1');
    expect(orders[0].order_type).toBe('dine_in');
    expect(orders[0].channel).toBe('pos');
    expect(orders[0].status).toBe('completed');
  });

  it('calculates order totals from checks', () => {
    const data = createMockToastData();
    const addAlias = jest.fn();

    const { orders } = processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(orders[0].subtotal_cents).toBe(999);
    expect(orders[0].tax_cents).toBe(80);
    expect(orders[0].tip_cents).toBe(200);
    expect(orders[0].total_cents).toBe(1079);
  });

  it('creates order items from selections', () => {
    const data = createMockToastData();
    const addAlias = jest.fn();

    const { items } = processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(items[0].original_name).toBe('Hamburger');
    expect(items[0].quantity).toBe(1);
    expect(items[0].total_price_cents).toBe(999);
    expect(items[0].tax_cents).toBe(80);
  });

  it('creates payments from check payments', () => {
    const data = createMockToastData();
    const addAlias = jest.fn();

    const { payments } = processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(payments[0].payment_type).toBe('credit');
    expect(payments[0].card_brand).toBe('visa');
    expect(payments[0].last_four).toBe('4242');
    expect(payments[0].amount_cents).toBe(1079);
    expect(payments[0].tip_cents).toBe(200);
  });

  it('skips voided orders', () => {
    const data = createMockToastData();
    data.orders[0].voided = true;
    const addAlias = jest.fn();

    const result = processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(result.orders).toHaveLength(0);
  });

  it('skips deleted orders', () => {
    const data = createMockToastData();
    data.orders[0].deleted = true;
    const addAlias = jest.fn();

    const result = processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(result.orders).toHaveLength(0);
  });

  it('skips voided checks', () => {
    const data = createMockToastData();
    data.orders[0].checks[0].voided = true;
    const addAlias = jest.fn();

    const result = processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(result.orders).toHaveLength(0); // No items = no order
  });

  it('skips voided selections', () => {
    const data = createMockToastData();
    data.orders[0].checks[0].selections[0].voided = true;
    const addAlias = jest.fn();

    const result = processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(result.items).toHaveLength(0);
    expect(result.orders).toHaveLength(0); // No items = no order
  });

  it('skips orders with unknown location', () => {
    const data = createMockToastData();
    data.orders[0].restaurantGuid = 'unknown-loc';
    const addAlias = jest.fn();

    const result = processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(result.orders).toHaveLength(0);
  });

  it('skips fully refunded payments', () => {
    const data = createMockToastData();
    data.orders[0].checks[0].payments[0].refundStatus = 'FULL_REFUND';
    const addAlias = jest.fn();

    const { payments } = processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(payments).toHaveLength(0);
  });

  it('calls addAlias for matched products', () => {
    const data = createMockToastData();
    const addAlias = jest.fn();

    processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(addAlias).toHaveBeenCalledWith('prod-1', 'Hamburger', 'toast');
  });

  it('handles items with modifiers', () => {
    const data = createMockToastData();
    data.orders[0].checks[0].selections[0].modifiers = [
      { guid: 'mod-1', displayName: 'Extra Cheese', price: 100 },
    ];
    const addAlias = jest.fn();

    const { items } = processToastOrders(data, locationMap, products, variations, variationMap, addAlias);

    expect(items[0].modifiers).toHaveLength(1);
    expect(items[0].modifiers![0]).toEqual({ name: 'Extra Cheese', price: 100 });
  });
});
