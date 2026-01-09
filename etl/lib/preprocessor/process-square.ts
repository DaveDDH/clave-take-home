import { randomUUID } from 'node:crypto';
import {
  mapSquareOrderType,
  mapSquareChannel,
  normalizeCardBrand,
  extractVariation,
} from '../normalizers.js';
import type { DbOrder, DbOrderItem, DbPayment } from '../types.js';
import type { SourceData, OrdersResult } from './types.js';

export function processSquareOrders(
  data: SourceData['square'],
  locationMap: Map<string, string>,
  productMap: Map<string, string>,
  variationMap: Map<string, string>,
  _categoryMap: Map<string, string>
): OrdersResult {
  const orders: Array<DbOrder & { id: string }> = [];
  const items: Array<DbOrderItem & { id: string }> = [];
  const payments: Array<DbPayment & { id: string }> = [];

  // Build variation lookup
  const variationToItem = new Map<string, { itemId: string; itemName: string; varName: string }>();
  for (const obj of data.catalog.objects) {
    if (obj.type === 'ITEM' && obj.item_data?.variations) {
      for (const variation of obj.item_data.variations) {
        variationToItem.set(variation.id, {
          itemId: obj.id,
          itemName: obj.item_data.name,
          varName: variation.item_variation_data.name,
        });
      }
    }
  }

  // Build payment lookup
  const paymentsByOrder = new Map<string, typeof data.payments.payments>();
  for (const payment of data.payments.payments) {
    const existing = paymentsByOrder.get(payment.order_id) || [];
    existing.push(payment);
    paymentsByOrder.set(payment.order_id, existing);
  }

  for (const order of data.orders.orders) {
    const locationId = locationMap.get(order.location_id);
    if (!locationId) continue;

    const orderId = randomUUID();
    const fulfillment = order.fulfillments?.[0];
    const orderType = fulfillment ? mapSquareOrderType(fulfillment.type) : 'dine_in';

    // Process line items
    for (const lineItem of order.line_items) {
      const catalogInfo = variationToItem.get(lineItem.catalog_object_id);
      const productId = catalogInfo ? productMap.get(catalogInfo.itemId) : undefined;
      const itemName = catalogInfo
        ? `${catalogInfo.itemName}${catalogInfo.varName !== 'Regular' ? ` - ${catalogInfo.varName}` : ''}`
        : lineItem.catalog_object_id;

      // Try to find variation for this item
      let variationId: string | undefined;
      if (productId && catalogInfo && catalogInfo.varName.toLowerCase() !== 'regular') {
        const { variation: normalizedVar } = extractVariation(catalogInfo.varName);
        const varName = normalizedVar || catalogInfo.varName;
        const variationKey = `${productId}:${varName.toLowerCase()}`;
        variationId = variationMap.get(variationKey);
      }

      const quantity = Number.parseInt(lineItem.quantity, 10);
      const totalPrice = lineItem.total_money.amount;
      const unitPrice = Math.round(totalPrice / quantity);

      items.push({
        id: randomUUID(),
        order_id: orderId,
        product_id: productId,
        variation_id: variationId,
        original_name: itemName,
        quantity,
        unit_price_cents: unitPrice,
        total_price_cents: totalPrice,
        modifiers: lineItem.applied_modifiers?.map(m => ({ modifier_id: m.modifier_id })) || [],
        raw_data: lineItem,
      });
    }

    // Skip if no items
    const orderItems = items.filter(i => i.order_id === orderId);
    if (orderItems.length === 0) continue;

    const total = order.total_money.amount;
    const tax = order.total_tax_money.amount;
    const tip = order.total_tip_money.amount;
    const subtotal = total - tax - tip;

    orders.push({
      id: orderId,
      source: 'square',
      source_order_id: order.id,
      location_id: locationId,
      order_type: orderType,
      channel: mapSquareChannel(order.source.name),
      status: order.state.toLowerCase(),
      created_at: order.created_at,
      closed_at: order.closed_at,
      subtotal_cents: subtotal,
      tax_cents: tax,
      tip_cents: tip,
      total_cents: total,
      raw_data: order,
    });

    // Process payments
    const orderPayments = paymentsByOrder.get(order.id) || [];
    for (const payment of orderPayments) {
      let paymentType = 'other';
      let cardBrand: string | undefined;
      let lastFour: string | undefined;

      if (payment.source_type === 'CARD' && payment.card_details) {
        paymentType = 'credit';
        cardBrand = normalizeCardBrand(payment.card_details.card.card_brand);
        lastFour = payment.card_details.card.last_4;
      } else if (payment.source_type === 'CASH') {
        paymentType = 'cash';
      } else if (payment.source_type === 'WALLET' && payment.wallet_details) {
        paymentType = 'wallet';
        cardBrand = normalizeCardBrand(payment.wallet_details.brand);
      }

      payments.push({
        id: randomUUID(),
        order_id: orderId,
        source_payment_id: payment.id,
        payment_type: paymentType,
        card_brand: cardBrand,
        last_four: lastFour,
        amount_cents: payment.amount_money.amount,
        tip_cents: payment.tip_money.amount,
        created_at: payment.created_at,
        raw_data: payment,
      });
    }
  }

  return { orders, items, payments };
}
