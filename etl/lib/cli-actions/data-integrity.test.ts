import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { checkDataIntegrity, logDataIntegrityReport } from './data-integrity.js';
import type { SourceData } from '../preprocessor/index.js';
import type { PreprocessedData, DataIntegrityResult } from './types.js';

describe('data-integrity', () => {
  const createMockSources = (): SourceData => ({
    toast: {
      restaurant: { guid: 'r1', name: 'Test' },
      locations: [],
      orders: [
        {
          guid: 'toast-order-1',
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
            selections: [],
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
        },
      ],
    },
    doordash: {
      merchant: { merchant_id: 'm1', business_name: 'Test', currency: 'USD' },
      stores: [],
      orders: [
        {
          external_delivery_id: 'dd-order-1',
          store_id: 'store-1',
          order_fulfillment_method: 'MERCHANT_DELIVERY',
          order_status: 'COMPLETED',
          created_at: '2024-01-15T14:00:00Z',
          pickup_time: '2024-01-15T14:30:00Z',
          delivery_time: '2024-01-15T15:00:00Z',
          order_items: [],
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
        },
      ],
    },
    square: {
      locations: { locations: [] },
      catalog: { objects: [] },
      orders: {
        orders: [
          {
            id: 'sq-order-1',
            location_id: 'loc-1',
            reference_id: 'ref-1',
            source: { name: 'Square POS' },
            created_at: '2024-01-15T16:00:00Z',
            updated_at: '2024-01-15T16:30:00Z',
            closed_at: '2024-01-15T16:30:00Z',
            state: 'COMPLETED',
            line_items: [],
            fulfillments: [],
            total_money: { amount: 1079, currency: 'USD' },
            total_tax_money: { amount: 80, currency: 'USD' },
            total_tip_money: { amount: 0, currency: 'USD' },
          },
        ],
      },
      payments: {
        payments: [
          {
            id: 'sq-pay-1',
            order_id: 'sq-order-1',
            location_id: 'loc-1',
            created_at: '2024-01-15T16:30:00Z',
            amount_money: { amount: 1079, currency: 'USD' },
            tip_money: { amount: 0, currency: 'USD' },
            total_money: { amount: 1079, currency: 'USD' },
            status: 'COMPLETED',
            source_type: 'CARD',
          },
        ],
      },
    },
  });

  const createMockPreprocessedData = (orderCount: number, paymentCount: number): PreprocessedData => ({
    version: '1.0.0',
    generated_at: '2024-01-15T17:00:00Z',
    normalized: {
      locations: [],
      categories: [],
      products: [],
      product_variations: [],
      product_aliases: [],
      orders: Array(orderCount).fill(null).map((_, i) => ({
        id: `order-${i}`,
        source: 'toast',
        source_order_id: `src-${i}`,
        location_id: 'loc-1',
        order_type: 'dine_in',
        channel: 'pos',
        status: 'completed',
        created_at: '2024-01-15T12:00:00Z',
        closed_at: '2024-01-15T12:30:00Z',
        subtotal_cents: 999,
        tax_cents: 80,
        tip_cents: 0,
        total_cents: 1079,
      })),
      order_items: [],
      payments: Array(paymentCount).fill(null).map((_, i) => ({
        id: `pay-${i}`,
        order_id: `order-${i % orderCount}`,
        source_payment_id: `src-pay-${i}`,
        payment_type: 'credit',
        amount_cents: 1079,
        tip_cents: 0,
        created_at: '2024-01-15T12:30:00Z',
      })),
    },
  });

  describe('checkDataIntegrity', () => {
    it('returns success when counts match', () => {
      const sources = createMockSources();
      // 1 Toast + 1 DoorDash + 1 Square = 3 orders
      // 1 Toast payment + 1 DoorDash payment + 1 Square payment = 3 payments
      const preprocessed = createMockPreprocessedData(3, 3);

      const result = checkDataIntegrity(sources, preprocessed);

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('returns summary with correct order counts', () => {
      const sources = createMockSources();
      const preprocessed = createMockPreprocessedData(3, 3);

      const result = checkDataIntegrity(sources, preprocessed);

      expect(result.summary.sourceOrders.toast).toBe(1);
      expect(result.summary.sourceOrders.doordash).toBe(1);
      expect(result.summary.sourceOrders.square).toBe(1);
      expect(result.summary.sourceOrders.total).toBe(3);
      expect(result.summary.preprocessedOrders).toBe(3);
    });

    it('returns summary with correct payment counts', () => {
      const sources = createMockSources();
      const preprocessed = createMockPreprocessedData(3, 3);

      const result = checkDataIntegrity(sources, preprocessed);

      expect(result.summary.sourcePayments.toast).toBe(1);
      expect(result.summary.sourcePayments.doordash).toBe(1); // 1 per order
      expect(result.summary.sourcePayments.square).toBe(1);
      expect(result.summary.sourcePayments.total).toBe(3);
      expect(result.summary.preprocessedPayments).toBe(3);
    });

    it('warns when order counts do not match', () => {
      const sources = createMockSources();
      const preprocessed = createMockPreprocessedData(2, 3); // Missing 1 order

      const result = checkDataIntegrity(sources, preprocessed);

      expect(result.success).toBe(false);
      expect(result.warnings.some(w => w.includes('Order count mismatch'))).toBe(true);
    });

    it('warns when payment counts do not match', () => {
      const sources = createMockSources();
      const preprocessed = createMockPreprocessedData(3, 2); // Missing 1 payment

      const result = checkDataIntegrity(sources, preprocessed);

      expect(result.success).toBe(false);
      expect(result.warnings.some(w => w.includes('Payment count mismatch'))).toBe(true);
    });

    it('excludes voided Toast orders from count', () => {
      const sources = createMockSources();
      sources.toast.orders[0].voided = true;
      const preprocessed = createMockPreprocessedData(2, 2); // Exclude voided order

      const result = checkDataIntegrity(sources, preprocessed);

      expect(result.summary.sourceOrders.toast).toBe(0);
      expect(result.success).toBe(true);
    });

    it('excludes deleted Toast orders from count', () => {
      const sources = createMockSources();
      sources.toast.orders[0].deleted = true;
      const preprocessed = createMockPreprocessedData(2, 2);

      const result = checkDataIntegrity(sources, preprocessed);

      expect(result.summary.sourceOrders.toast).toBe(0);
      expect(result.success).toBe(true);
    });

    it('excludes voided checks from payment count', () => {
      const sources = createMockSources();
      sources.toast.orders[0].checks[0].voided = true;
      const preprocessed = createMockPreprocessedData(3, 2); // No payment from voided check

      const result = checkDataIntegrity(sources, preprocessed);

      expect(result.summary.sourcePayments.toast).toBe(0);
      expect(result.success).toBe(true);
    });

    it('excludes fully refunded payments from count', () => {
      const sources = createMockSources();
      sources.toast.orders[0].checks[0].payments[0].refundStatus = 'FULL_REFUND';
      const preprocessed = createMockPreprocessedData(3, 2);

      const result = checkDataIntegrity(sources, preprocessed);

      expect(result.summary.sourcePayments.toast).toBe(0);
      expect(result.success).toBe(true);
    });

    it('calculates orders with payments correctly', () => {
      const sources = createMockSources();
      const preprocessed = createMockPreprocessedData(3, 3);

      const result = checkDataIntegrity(sources, preprocessed);

      expect(result.summary.ordersWithPayments).toBe(3);
      expect(result.summary.ordersWithoutPayments).toBe(0);
    });

    it('warns when orders have no payments', () => {
      const sources = createMockSources();
      const preprocessed = createMockPreprocessedData(3, 2);
      // One order will not have a payment
      preprocessed.normalized.payments = preprocessed.normalized.payments.map((p, i) => ({
        ...p,
        order_id: `order-${i}`,
      }));

      const result = checkDataIntegrity(sources, preprocessed);

      expect(result.summary.ordersWithoutPayments).toBe(1);
      expect(result.warnings.some(w => w.includes('orders have no payments'))).toBe(true);
    });
  });

  describe('logDataIntegrityReport', () => {
    let consoleSpy: jest.SpiedFunction<typeof console.log>;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('logs success message when no warnings', () => {
      const result: DataIntegrityResult = {
        success: true,
        warnings: [],
        summary: {
          sourceOrders: { toast: 1, doordash: 1, square: 1, total: 3 },
          preprocessedOrders: 3,
          sourcePayments: { toast: 1, doordash: 1, square: 1, total: 3 },
          preprocessedPayments: 3,
          ordersWithPayments: 3,
          ordersWithoutPayments: 0,
        },
      };

      logDataIntegrityReport(result);

      expect(consoleSpy).toHaveBeenCalled();
      const allOutput = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(allOutput).toContain('Data integrity check passed');
    });

    it('logs warnings when present', () => {
      const result: DataIntegrityResult = {
        success: false,
        warnings: ['Order count mismatch', 'Payment count mismatch'],
        summary: {
          sourceOrders: { toast: 1, doordash: 1, square: 1, total: 3 },
          preprocessedOrders: 2,
          sourcePayments: { toast: 1, doordash: 1, square: 1, total: 3 },
          preprocessedPayments: 2,
          ordersWithPayments: 2,
          ordersWithoutPayments: 0,
        },
      };

      logDataIntegrityReport(result);

      expect(consoleSpy).toHaveBeenCalled();
      const allOutput = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(allOutput).toContain('warnings');
    });

    it('formats order summary in table', () => {
      const result: DataIntegrityResult = {
        success: true,
        warnings: [],
        summary: {
          sourceOrders: { toast: 5, doordash: 3, square: 2, total: 10 },
          preprocessedOrders: 10,
          sourcePayments: { toast: 5, doordash: 3, square: 2, total: 10 },
          preprocessedPayments: 10,
          ordersWithPayments: 10,
          ordersWithoutPayments: 0,
        },
      };

      logDataIntegrityReport(result);

      const allOutput = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(allOutput).toContain('Toast');
      expect(allOutput).toContain('DoorDash');
      expect(allOutput).toContain('Square');
      expect(allOutput).toContain('Orders');
      expect(allOutput).toContain('Payments');
    });
  });
});
