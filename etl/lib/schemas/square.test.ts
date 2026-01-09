import { describe, it, expect } from '@jest/globals';
import {
  SquareLocationsDataSchema,
  SquareCatalogDataSchema,
  SquareOrdersDataSchema,
  SquarePaymentsDataSchema,
} from './square.js';

describe('SquareLocationsDataSchema', () => {
  const validLocationsData = {
    locations: [{
      id: 'loc-123', name: 'Downtown', timezone: 'America/New_York', status: 'ACTIVE',
      type: 'PHYSICAL', merchant_id: 'merch-123',
      address: {
        address_line_1: '123 Main St', locality: 'New York',
        administrative_district_level_1: 'NY', postal_code: '10001', country: 'US',
      },
    }],
  };

  it('validates valid locations data', () => {
    const result = SquareLocationsDataSchema.safeParse(validLocationsData);
    expect(result.success).toBe(true);
  });

  it('validates data with multiple locations', () => {
    const data = {
      locations: [
        ...validLocationsData.locations,
        {
          id: 'loc-456', name: 'Uptown', timezone: 'America/New_York', status: 'ACTIVE',
          type: 'PHYSICAL', merchant_id: 'merch-123',
          address: {
            address_line_1: '456 Park Ave', locality: 'New York',
            administrative_district_level_1: 'NY', postal_code: '10002', country: 'US',
          },
        },
      ],
    };
    const result = SquareLocationsDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects missing locations', () => {
    const result = SquareLocationsDataSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('SquareCatalogDataSchema', () => {
  const validCatalogData = {
    objects: [
      {
        type: 'CATEGORY', id: 'cat-123',
        category_data: { name: 'Burgers' },
      },
      {
        type: 'ITEM', id: 'item-123', present_at_location_ids: ['loc-123'],
        item_data: {
          name: 'Hamburger', description: 'A classic burger', category_id: 'cat-123',
          variations: [{
            type: 'ITEM_VARIATION', id: 'var-123',
            item_variation_data: {
              item_id: 'item-123', name: 'Regular', pricing_type: 'FIXED',
              price_money: { amount: 999, currency: 'USD' },
            },
          }],
        },
      },
    ],
  };

  it('validates valid catalog data', () => {
    const result = SquareCatalogDataSchema.safeParse(validCatalogData);
    expect(result.success).toBe(true);
  });

  it('validates catalog with empty objects array', () => {
    const result = SquareCatalogDataSchema.safeParse({ objects: [] });
    expect(result.success).toBe(true);
  });

  it('validates item without description', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = structuredClone(validCatalogData) as any;
    delete data.objects[1].item_data.description;
    const result = SquareCatalogDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates item without category_id', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = structuredClone(validCatalogData) as any;
    delete data.objects[1].item_data.category_id;
    const result = SquareCatalogDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates item without present_at_location_ids', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = structuredClone(validCatalogData) as any;
    delete data.objects[1].present_at_location_ids;
    const result = SquareCatalogDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates modifier with optional price_money', () => {
    const data = {
      objects: [{
        type: 'MODIFIER', id: 'mod-123',
        modifier_data: { name: 'Extra Cheese' },
      }],
    };
    const result = SquareCatalogDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates modifier with price_money', () => {
    const data = {
      objects: [{
        type: 'MODIFIER', id: 'mod-123',
        modifier_data: { name: 'Extra Cheese', price_money: { amount: 100, currency: 'USD' } },
      }],
    };
    const result = SquareCatalogDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('SquareOrdersDataSchema', () => {
  const validOrdersData = {
    orders: [{
      id: 'order-123', location_id: 'loc-123', reference_id: 'ref-123',
      source: { name: 'Square POS' }, created_at: '2024-01-15T12:00:00Z',
      updated_at: '2024-01-15T12:30:00Z', closed_at: '2024-01-15T12:30:00Z',
      state: 'COMPLETED', version: 1,
      line_items: [{
        uid: 'li-123', catalog_object_id: 'var-123', quantity: '1', item_type: 'ITEM',
        gross_sales_money: { amount: 999, currency: 'USD' },
        total_money: { amount: 999, currency: 'USD' },
      }],
      fulfillments: [{ uid: 'ful-123', type: 'PICKUP', state: 'COMPLETED' }],
      total_money: { amount: 1079, currency: 'USD' },
      total_tax_money: { amount: 80, currency: 'USD' },
      total_tip_money: { amount: 0, currency: 'USD' },
    }],
    cursor: null,
  };

  it('validates valid orders data', () => {
    const result = SquareOrdersDataSchema.safeParse(validOrdersData);
    expect(result.success).toBe(true);
  });

  it('validates data with empty orders array', () => {
    const result = SquareOrdersDataSchema.safeParse({ orders: [], cursor: null });
    expect(result.success).toBe(true);
  });

  it('validates order with applied_modifiers', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = structuredClone(validOrdersData) as any;
    data.orders[0].line_items[0].applied_modifiers = [{ modifier_id: 'mod-123' }];
    const result = SquareOrdersDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates order without applied_modifiers', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = structuredClone(validOrdersData) as any;
    delete data.orders[0].line_items[0].applied_modifiers;
    const result = SquareOrdersDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates cursor with string value', () => {
    const data = { ...validOrdersData, cursor: 'next-page-cursor' };
    const result = SquareOrdersDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects missing orders', () => {
    const result = SquareOrdersDataSchema.safeParse({ cursor: null });
    expect(result.success).toBe(false);
  });
});

describe('SquarePaymentsDataSchema', () => {
  const validPaymentsData = {
    payments: [{
      id: 'pay-123', order_id: 'order-123', location_id: 'loc-123',
      created_at: '2024-01-15T12:30:00Z', updated_at: '2024-01-15T12:30:00Z',
      amount_money: { amount: 999, currency: 'USD' },
      tip_money: { amount: 200, currency: 'USD' },
      total_money: { amount: 1199, currency: 'USD' },
      status: 'COMPLETED', source_type: 'CARD',
      card_details: {
        status: 'CAPTURED', entry_method: 'KEYED',
        card: { card_brand: 'VISA', last_4: '4242' },
      },
    }],
    cursor: null,
  };

  it('validates valid payments data', () => {
    const result = SquarePaymentsDataSchema.safeParse(validPaymentsData);
    expect(result.success).toBe(true);
  });

  it('validates data with empty payments array', () => {
    const result = SquarePaymentsDataSchema.safeParse({ payments: [], cursor: null });
    expect(result.success).toBe(true);
  });

  it('validates payment with cash_details', () => {
    const data = {
      payments: [{
        id: 'pay-123', order_id: 'order-123', location_id: 'loc-123',
        created_at: '2024-01-15T12:30:00Z', updated_at: '2024-01-15T12:30:00Z',
        amount_money: { amount: 999, currency: 'USD' },
        tip_money: { amount: 0, currency: 'USD' },
        total_money: { amount: 999, currency: 'USD' },
        status: 'COMPLETED', source_type: 'CASH',
        cash_details: {
          buyer_supplied_money: { amount: 1000, currency: 'USD' },
          change_back_money: { amount: 1, currency: 'USD' },
        },
      }],
      cursor: null,
    };
    const result = SquarePaymentsDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates payment with wallet_details', () => {
    const data = {
      payments: [{
        id: 'pay-123', order_id: 'order-123', location_id: 'loc-123',
        created_at: '2024-01-15T12:30:00Z', updated_at: '2024-01-15T12:30:00Z',
        amount_money: { amount: 999, currency: 'USD' },
        tip_money: { amount: 0, currency: 'USD' },
        total_money: { amount: 999, currency: 'USD' },
        status: 'COMPLETED', source_type: 'WALLET',
        wallet_details: { status: 'CAPTURED', brand: 'APPLE_PAY' },
      }],
      cursor: null,
    };
    const result = SquarePaymentsDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates card without optional exp fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = structuredClone(validPaymentsData) as any;
    delete data.payments[0].card_details.card.exp_month;
    delete data.payments[0].card_details.card.exp_year;
    const result = SquarePaymentsDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects missing payments', () => {
    const result = SquarePaymentsDataSchema.safeParse({ cursor: null });
    expect(result.success).toBe(false);
  });
});
