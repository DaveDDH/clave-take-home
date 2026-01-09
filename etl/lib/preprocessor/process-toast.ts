import { randomUUID } from 'crypto';
import {
  findCanonicalProduct,
  mapToastOrderType,
  mapToastChannel,
  normalizePaymentType,
  normalizeCardBrand,
  extractVariation,
} from '../normalizers.js';
import type { DbProduct, DbProductVariation, DbOrder, DbOrderItem, DbPayment, ToastData } from '../types.js';
import type { OrdersResult, AddAliasFunction } from './types.js';

export function processToastOrders(
  data: ToastData,
  locationMap: Map<string, string>,
  products: Array<DbProduct & { id: string }>,
  _variations: Array<DbProductVariation & { id: string }>,
  variationMap: Map<string, string>,
  addAlias: AddAliasFunction
): OrdersResult {
  const orders: Array<DbOrder & { id: string }> = [];
  const items: Array<DbOrderItem & { id: string }> = [];
  const payments: Array<DbPayment & { id: string }> = [];

  for (const order of data.orders) {
    if (order.voided || order.deleted) continue;

    const locationId = locationMap.get(order.restaurantGuid);
    if (!locationId) continue;

    const orderId = randomUUID();
    let subtotal = 0;
    let tax = 0;
    let tip = 0;
    let total = 0;

    for (const check of order.checks) {
      if (check.voided || check.deleted) continue;

      subtotal += check.amount;
      tax += check.taxAmount;
      tip += check.tipAmount;
      total += check.totalAmount;

      // Process selections (items)
      for (const selection of check.selections) {
        if (selection.voided) continue;

        const canonical = findCanonicalProduct(selection.displayName, products);
        if (canonical) {
          addAlias(canonical.id, selection.displayName, 'toast');
        }

        // Try to find variation for this item
        let variationId: string | undefined;
        if (canonical) {
          const { variation } = extractVariation(selection.displayName);
          if (variation) {
            const variationKey = `${canonical.id}:${variation.toLowerCase()}`;
            variationId = variationMap.get(variationKey);
          }
        }

        items.push({
          id: randomUUID(),
          order_id: orderId,
          product_id: canonical?.id,
          variation_id: variationId,
          original_name: selection.displayName,
          quantity: selection.quantity,
          unit_price_cents: Math.round(selection.preDiscountPrice / selection.quantity),
          total_price_cents: selection.price,
          tax_cents: selection.tax,
          modifiers: selection.modifiers.map(m => ({
            name: m.displayName,
            price: m.price,
          })),
          raw_data: selection,
        });
      }

      // Process payments
      for (const payment of check.payments) {
        if (payment.refundStatus === 'FULL_REFUND') continue;

        payments.push({
          id: randomUUID(),
          order_id: orderId,
          source_payment_id: payment.guid,
          payment_type: normalizePaymentType(payment.type),
          card_brand: normalizeCardBrand(payment.cardType),
          last_four: payment.last4Digits,
          amount_cents: payment.amount,
          tip_cents: payment.tipAmount,
          processing_fee_cents: payment.originalProcessingFee,
          created_at: payment.paidDate,
          raw_data: payment,
        });
      }
    }

    // Skip if no items
    const orderItems = items.filter(i => i.order_id === orderId);
    if (orderItems.length === 0) continue;

    orders.push({
      id: orderId,
      source: 'toast',
      source_order_id: order.guid,
      location_id: locationId,
      order_type: mapToastOrderType(order.diningOption.behavior),
      channel: mapToastChannel(order.source),
      status: 'completed',
      created_at: order.openedDate,
      closed_at: order.closedDate,
      subtotal_cents: subtotal,
      tax_cents: tax,
      tip_cents: tip,
      total_cents: total,
      raw_data: order,
    });
  }

  return { orders, items, payments };
}
