import { jest, describe, it, expect } from '@jest/globals';
import type { SourceData } from './types.js';

// Mock variation-patterns module using unstable_mockModule for ESM
jest.unstable_mockModule('../variation-patterns.js', () => ({
  getVariationPatterns: jest.fn(() => []),
  getAbbreviationMap: jest.fn(() => ({})),
}));

// Dynamic import after mock setup
const { processSquareOrders } = await import('./process-square.js');

describe('processSquareOrders', () => {
  const createMockSquareData = (): SourceData['square'] => ({
    locations: { locations: [] },
    catalog: {
      objects: [{
        type: 'ITEM',
        id: 'item-1',
        item_data: {
          name: 'Hamburger',
          variations: [{
            type: 'ITEM_VARIATION',
            id: 'var-1',
            item_variation_data: {
              item_id: 'item-1',
              name: 'Regular',
              pricing_type: 'FIXED',
              price_money: { amount: 999, currency: 'USD' },
            },
          }],
        },
      }],
    },
    orders: {
      orders: [{
        id: 'order-1',
        location_id: 'loc-1',
        reference_id: 'ref-1',
        source: { name: 'Square POS' },
        created_at: '2024-01-15T12:00:00Z',
        updated_at: '2024-01-15T12:30:00Z',
        closed_at: '2024-01-15T12:30:00Z',
        state: 'COMPLETED',
        line_items: [{
          uid: 'li-1',
          catalog_object_id: 'var-1',
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
    },
    payments: {
      payments: [{
        id: 'pay-1',
        order_id: 'order-1',
        location_id: 'loc-1',
        created_at: '2024-01-15T12:30:00Z',
        amount_money: { amount: 999, currency: 'USD' },
        tip_money: { amount: 0, currency: 'USD' },
        total_money: { amount: 999, currency: 'USD' },
        status: 'COMPLETED',
        source_type: 'CARD',
        card_details: {
          status: 'CAPTURED',
          entry_method: 'KEYED',
          card: { card_brand: 'VISA', last_4: '4242' },
        },
      }],
    },
  });

  const locationMap = new Map([['loc-1', 'unified-loc-1']]);
  const productMap = new Map([['item-1', 'prod-1']]);
  const variationMap = new Map<string, string>();
  const categoryMap = new Map<string, string>();

  it('processes valid Square order', () => {
    const data = createMockSquareData();

    const result = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(result.orders).toHaveLength(1);
    expect(result.items).toHaveLength(1);
    expect(result.payments).toHaveLength(1);
  });

  it('creates order with correct properties', () => {
    const data = createMockSquareData();

    const { orders } = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(orders[0].source).toBe('square');
    expect(orders[0].source_order_id).toBe('order-1');
    expect(orders[0].location_id).toBe('unified-loc-1');
    expect(orders[0].order_type).toBe('pickup');
    expect(orders[0].channel).toBe('pos');
    expect(orders[0].status).toBe('completed');
  });

  it('calculates order totals correctly', () => {
    const data = createMockSquareData();

    const { orders } = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(orders[0].total_cents).toBe(1079);
    expect(orders[0].tax_cents).toBe(80);
    expect(orders[0].tip_cents).toBe(0);
    expect(orders[0].subtotal_cents).toBe(999); // total - tax - tip
  });

  it('creates order items from line items', () => {
    const data = createMockSquareData();

    const { items } = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(items[0].original_name).toBe('Hamburger');
    expect(items[0].quantity).toBe(1);
    expect(items[0].total_price_cents).toBe(999);
    expect(items[0].product_id).toBe('prod-1');
  });

  it('creates payments with card details', () => {
    const data = createMockSquareData();

    const { payments } = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(payments[0].payment_type).toBe('credit');
    expect(payments[0].card_brand).toBe('visa');
    expect(payments[0].last_four).toBe('4242');
  });

  it('handles cash payments', () => {
    const data = createMockSquareData();
    data.payments.payments[0] = {
      ...data.payments.payments[0],
      source_type: 'CASH',
      card_details: undefined,
      cash_details: {
        buyer_supplied_money: { amount: 1000, currency: 'USD' },
        change_back_money: { amount: 1, currency: 'USD' },
      },
    };

    const { payments } = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(payments[0].payment_type).toBe('cash');
    expect(payments[0].card_brand).toBeUndefined();
  });

  it('handles wallet payments', () => {
    const data = createMockSquareData();
    data.payments.payments[0] = {
      ...data.payments.payments[0],
      source_type: 'WALLET',
      card_details: undefined,
      wallet_details: { status: 'CAPTURED', brand: 'APPLE_PAY' },
    };

    const { payments } = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(payments[0].payment_type).toBe('wallet');
    expect(payments[0].card_brand).toBe('apple_pay');
  });

  it('skips orders with unknown location', () => {
    const data = createMockSquareData();
    data.orders.orders[0].location_id = 'unknown-loc';

    const result = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(result.orders).toHaveLength(0);
  });

  it('maps DINE_IN fulfillment type', () => {
    const data = createMockSquareData();
    data.orders.orders[0].fulfillments[0].type = 'DINE_IN';

    const { orders } = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(orders[0].order_type).toBe('dine_in');
  });

  it('maps DELIVERY fulfillment type', () => {
    const data = createMockSquareData();
    data.orders.orders[0].fulfillments[0].type = 'DELIVERY';

    const { orders } = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(orders[0].order_type).toBe('delivery');
  });

  it('defaults to dine_in when no fulfillments', () => {
    const data = createMockSquareData();
    data.orders.orders[0].fulfillments = [];

    const { orders } = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(orders[0].order_type).toBe('dine_in');
  });

  it('maps online channel from source name', () => {
    const data = createMockSquareData();
    data.orders.orders[0].source.name = 'Online Store';

    const { orders } = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(orders[0].channel).toBe('online');
  });

  it('handles line items with applied modifiers', () => {
    const data = createMockSquareData();
    data.orders.orders[0].line_items[0].applied_modifiers = [{ modifier_id: 'mod-1' }];

    const { items } = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(items[0].modifiers).toEqual([{ modifier_id: 'mod-1' }]);
  });

  it('includes variation name when not Regular', () => {
    const data = createMockSquareData();
    data.catalog.objects[0].item_data!.variations[0].item_variation_data.name = 'Large';

    const { items } = processSquareOrders(data, locationMap, productMap, variationMap, categoryMap);

    expect(items[0].original_name).toBe('Hamburger - Large');
  });
});
