import { describe, it, expect } from '@jest/globals';
import { DoorDashDataSchema } from './doordash.js';

describe('DoorDashDataSchema', () => {
  const validDoorDashData = {
    merchant: { merchant_id: 'merch-123', business_name: 'Test Restaurant', currency: 'USD' },
    stores: [{
      store_id: 'store-123', name: 'Downtown Location', timezone: 'America/New_York',
      address: { street: '123 Main St', city: 'New York', state: 'NY', zip_code: '10001', country: 'US' },
    }],
    orders: [{
      external_delivery_id: 'dd-order-123', store_id: 'store-123', order_fulfillment_method: 'MERCHANT_DELIVERY',
      order_status: 'COMPLETED', created_at: '2024-01-15T12:00:00Z', pickup_time: '2024-01-15T12:30:00Z',
      delivery_time: '2024-01-15T13:00:00Z', order_subtotal: 1998, delivery_fee: 399, service_fee: 199,
      dasher_tip: 500, tax_amount: 160, total_charged_to_consumer: 3256, commission: 300,
      merchant_payout: 2456, contains_alcohol: false, is_catering: false,
      order_items: [{
        item_id: 'item-123', name: 'Hamburger', quantity: 2, unit_price: 999, total_price: 1998,
        special_instructions: 'No pickles', category: 'Burgers',
        options: [{ name: 'Extra cheese', price: 100 }],
      }],
    }],
  };

  it('validates valid DoorDash data', () => {
    const result = DoorDashDataSchema.safeParse(validDoorDashData);
    expect(result.success).toBe(true);
  });

  it('validates data with empty orders array', () => {
    const data = { ...validDoorDashData, orders: [] };
    const result = DoorDashDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates data with multiple stores', () => {
    const data = {
      ...validDoorDashData,
      stores: [
        ...validDoorDashData.stores,
        {
          store_id: 'store-456', name: 'Uptown Location', timezone: 'America/New_York',
          address: { street: '456 Park Ave', city: 'New York', state: 'NY', zip_code: '10002', country: 'US' },
        },
      ],
    };
    const result = DoorDashDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates order with null delivery_time', () => {
    const data = JSON.parse(JSON.stringify(validDoorDashData));
    data.orders[0].delivery_time = null;
    const result = DoorDashDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates order with empty options array', () => {
    const data = JSON.parse(JSON.stringify(validDoorDashData));
    data.orders[0].order_items[0].options = [];
    const result = DoorDashDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects missing merchant', () => {
    const { merchant: _, ...data } = validDoorDashData;
    const result = DoorDashDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects missing stores', () => {
    const { stores: _, ...data } = validDoorDashData;
    const result = DoorDashDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects missing orders', () => {
    const { orders: _, ...data } = validDoorDashData;
    const result = DoorDashDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('validates order with contains_alcohol true', () => {
    const data = JSON.parse(JSON.stringify(validDoorDashData));
    data.orders[0].contains_alcohol = true;
    const result = DoorDashDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates order with is_catering true', () => {
    const data = JSON.parse(JSON.stringify(validDoorDashData));
    data.orders[0].is_catering = true;
    const result = DoorDashDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});
