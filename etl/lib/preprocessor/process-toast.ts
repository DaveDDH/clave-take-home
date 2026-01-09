import { randomUUID } from 'node:crypto';
import {
  findCanonicalProduct,
  mapToastOrderType,
  mapToastChannel,
  normalizePaymentType,
  normalizeCardBrand,
  extractVariation,
} from '../normalizers.js';
import type { DbProduct, DbProductVariation, DbOrder, DbOrderItem, DbPayment, ToastData, ToastOrder, ToastCheck, ToastSelection, ToastPayment } from '../types.js';
import type { OrdersResult, AddAliasFunction } from './types.js';

interface ItemProcessingContext {
  products: Array<DbProduct & { id: string }>;
  variationMap: Map<string, string>;
  addAlias: AddAliasFunction;
}

interface CheckTotals {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

function processSelection(
  selection: ToastSelection,
  orderId: string,
  ctx: ItemProcessingContext
): DbOrderItem & { id: string } {
  const canonical = findCanonicalProduct(selection.displayName, ctx.products);
  if (canonical) {
    ctx.addAlias(canonical.id, selection.displayName, 'toast');
  }

  let variationId: string | undefined;
  if (canonical) {
    const { variation } = extractVariation(selection.displayName);
    if (variation) {
      const variationKey = `${canonical.id}:${variation.toLowerCase()}`;
      variationId = ctx.variationMap.get(variationKey);
    }
  }

  return {
    id: randomUUID(),
    order_id: orderId,
    product_id: canonical?.id,
    variation_id: variationId,
    original_name: selection.displayName,
    quantity: selection.quantity,
    unit_price_cents: Math.round(selection.preDiscountPrice / selection.quantity),
    total_price_cents: selection.price,
    tax_cents: selection.tax,
    modifiers: selection.modifiers.map(m => ({ name: m.displayName, price: m.price })),
    raw_data: selection,
  };
}

function processPayment(payment: ToastPayment, orderId: string): DbPayment & { id: string } {
  return {
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
  };
}

function processCheck(
  check: ToastCheck,
  orderId: string,
  ctx: ItemProcessingContext,
  items: Array<DbOrderItem & { id: string }>,
  payments: Array<DbPayment & { id: string }>
): CheckTotals {
  for (const selection of check.selections) {
    if (!selection.voided) {
      items.push(processSelection(selection, orderId, ctx));
    }
  }

  for (const payment of check.payments) {
    if (payment.refundStatus !== 'FULL_REFUND') {
      payments.push(processPayment(payment, orderId));
    }
  }

  return {
    subtotal: check.amount,
    tax: check.taxAmount,
    tip: check.tipAmount,
    total: check.totalAmount,
  };
}

function createOrderRecord(order: ToastOrder, orderId: string, locationId: string, totals: CheckTotals): DbOrder & { id: string } {
  return {
    id: orderId,
    source: 'toast',
    source_order_id: order.guid,
    location_id: locationId,
    order_type: mapToastOrderType(order.diningOption.behavior),
    channel: mapToastChannel(order.source),
    status: 'completed',
    created_at: order.openedDate,
    closed_at: order.closedDate,
    subtotal_cents: totals.subtotal,
    tax_cents: totals.tax,
    tip_cents: totals.tip,
    total_cents: totals.total,
    raw_data: order,
  };
}

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

  const ctx: ItemProcessingContext = { products, variationMap, addAlias };

  for (const order of data.orders) {
    if (order.voided || order.deleted) continue;

    const locationId = locationMap.get(order.restaurantGuid);
    if (!locationId) continue;

    const orderId = randomUUID();
    const totals: CheckTotals = { subtotal: 0, tax: 0, tip: 0, total: 0 };

    for (const check of order.checks) {
      if (check.voided || check.deleted) continue;
      const checkTotals = processCheck(check, orderId, ctx, items, payments);
      totals.subtotal += checkTotals.subtotal;
      totals.tax += checkTotals.tax;
      totals.tip += checkTotals.tip;
      totals.total += checkTotals.total;
    }

    const orderItems = items.filter(i => i.order_id === orderId);
    if (orderItems.length === 0) continue;

    orders.push(createOrderRecord(order, orderId, locationId, totals));
  }

  return { orders, items, payments };
}
