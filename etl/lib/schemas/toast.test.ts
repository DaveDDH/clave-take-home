import { describe, it, expect } from '@jest/globals';
import { ToastDataSchema } from './toast.js';

describe('ToastDataSchema', () => {
  const validToastData = {
    restaurant: { guid: 'rest-123', name: 'Test Restaurant', managementGroupGuid: 'mgmt-456' },
    locations: [{
      guid: 'loc-123', name: 'Downtown Location', timezone: 'America/New_York',
      address: { line1: '123 Main St', city: 'New York', state: 'NY', zip: '10001', country: 'US' },
    }],
    orders: [{
      guid: 'order-123', entityType: 'Order', externalId: null, restaurantGuid: 'rest-123',
      businessDate: '2024-01-15', openedDate: '2024-01-15T12:00:00Z', closedDate: '2024-01-15T12:30:00Z',
      paidDate: '2024-01-15T12:30:00Z', voided: false, deleted: false, source: 'POS',
      voidDate: null, voidBusinessDate: null,
      revenueCenter: { guid: 'rc-123', name: 'Main', entityType: 'RevenueCenter' },
      server: { guid: 'server-123', firstName: 'John', lastName: 'Doe', entityType: 'RestaurantUser' },
      diningOption: { guid: 'do-123', name: 'Dine In', behavior: 'DINE_IN', entityType: 'DiningOption' },
      checks: [{
        guid: 'check-123', entityType: 'Check', displayNumber: '1001',
        openedDate: '2024-01-15T12:00:00Z', closedDate: '2024-01-15T12:30:00Z', paidDate: '2024-01-15T12:30:00Z',
        voided: false, deleted: false, amount: 999, taxAmount: 80, totalAmount: 1079, tipAmount: 200,
        selections: [{
          guid: 'sel-123', entityType: 'OrderSelection', displayName: 'Hamburger', quantity: 1,
          preDiscountPrice: 999, price: 999, tax: 80, voided: false, modifiers: [],
          itemGroup: { guid: 'ig-123', name: 'Burgers', entityType: 'MenuGroup' },
          item: { guid: 'item-123', name: 'Hamburger', entityType: 'MenuItem' },
        }],
        payments: [{
          guid: 'pay-123', entityType: 'Payment', paidDate: '2024-01-15T12:30:00Z', paidBusinessDate: '2024-01-15',
          type: 'CREDIT', cardType: 'VISA', last4Digits: '4242', amount: 1079, tipAmount: 200,
          originalProcessingFee: 32, refundStatus: 'NONE',
        }],
      }],
    }],
  };

  it('validates valid Toast data', () => {
    const result = ToastDataSchema.safeParse(validToastData);
    expect(result.success).toBe(true);
  });

  it('validates data with empty orders array', () => {
    const data = { ...validToastData, orders: [] };
    const result = ToastDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates data with multiple locations', () => {
    const data = {
      ...validToastData,
      locations: [
        ...validToastData.locations,
        {
          guid: 'loc-456', name: 'Uptown Location', timezone: 'America/New_York',
          address: { line1: '456 Park Ave', city: 'New York', state: 'NY', zip: '10002', country: 'US' },
        },
      ],
    };
    const result = ToastDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects missing restaurant', () => {
    const { restaurant: _, ...data } = validToastData;
    const result = ToastDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects missing locations', () => {
    const { locations: _, ...data } = validToastData;
    const result = ToastDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects missing orders', () => {
    const { orders: _, ...data } = validToastData;
    const result = ToastDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('validates payment with null card details', () => {
    const data = structuredClone(validToastData) as typeof validToastData & {
      orders: Array<{ checks: Array<{ payments: Array<{ cardType: string | null; last4Digits: string | null }> }> }>;
    };
    data.orders[0].checks[0].payments[0].cardType = null;
    data.orders[0].checks[0].payments[0].last4Digits = null;
    const result = ToastDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});
