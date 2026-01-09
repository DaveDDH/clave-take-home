import { randomUUID } from 'node:crypto';
import {
  mapSquareOrderType,
  mapSquareChannel,
  normalizeCardBrand,
  extractVariation,
} from '../normalizers.js';
import type { DbOrder, DbOrderItem, DbPayment } from '../types.js';
import type { SourceData, OrdersResult } from './types.js';

type SquarePayment = SourceData['square']['payments']['payments'][number];
type SquareLineItem = SourceData['square']['orders']['orders'][number]['line_items'][number];
type SquareOrder = SourceData['square']['orders']['orders'][number];

interface CatalogInfo {
  itemId: string;
  itemName: string;
  varName: string;
}

function buildVariationLookup(catalog: SourceData['square']['catalog']): Map<string, CatalogInfo> {
  const lookup = new Map<string, CatalogInfo>();
  for (const obj of catalog.objects) {
    if (obj.type === 'ITEM' && obj.item_data?.variations) {
      for (const variation of obj.item_data.variations) {
        lookup.set(variation.id, {
          itemId: obj.id,
          itemName: obj.item_data.name,
          varName: variation.item_variation_data.name,
        });
      }
    }
  }
  return lookup;
}

function buildPaymentLookup(payments: SquarePayment[]): Map<string, SquarePayment[]> {
  const lookup = new Map<string, SquarePayment[]>();
  for (const payment of payments) {
    const existing = lookup.get(payment.order_id) || [];
    existing.push(payment);
    lookup.set(payment.order_id, existing);
  }
  return lookup;
}

function processLineItem(
  lineItem: SquareLineItem,
  orderId: string,
  catalogInfo: CatalogInfo | undefined,
  productMap: Map<string, string>,
  variationMap: Map<string, string>
): DbOrderItem & { id: string } {
  const productId = catalogInfo ? productMap.get(catalogInfo.itemId) : undefined;
  let itemName: string;
  if (catalogInfo) {
    const varSuffix = catalogInfo.varName === 'Regular' ? '' : ` - ${catalogInfo.varName}`;
    itemName = `${catalogInfo.itemName}${varSuffix}`;
  } else {
    itemName = lineItem.catalog_object_id;
  }

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

  return {
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
  };
}

function extractPaymentDetails(payment: SquarePayment): { paymentType: string; cardBrand?: string; lastFour?: string } {
  if (payment.source_type === 'CARD' && payment.card_details) {
    return {
      paymentType: 'credit',
      cardBrand: normalizeCardBrand(payment.card_details.card.card_brand),
      lastFour: payment.card_details.card.last_4,
    };
  }
  if (payment.source_type === 'CASH') {
    return { paymentType: 'cash' };
  }
  if (payment.source_type === 'WALLET' && payment.wallet_details) {
    return {
      paymentType: 'wallet',
      cardBrand: normalizeCardBrand(payment.wallet_details.brand),
    };
  }
  return { paymentType: 'other' };
}

function processPayment(payment: SquarePayment, orderId: string): DbPayment & { id: string } {
  const { paymentType, cardBrand, lastFour } = extractPaymentDetails(payment);
  return {
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
  };
}

function createOrderRecord(order: SquareOrder, orderId: string, locationId: string, orderType: string): DbOrder & { id: string } {
  const total = order.total_money.amount;
  const tax = order.total_tax_money.amount;
  const tip = order.total_tip_money.amount;
  const subtotal = total - tax - tip;

  return {
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
  };
}

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

  const variationToItem = buildVariationLookup(data.catalog);
  const paymentsByOrder = buildPaymentLookup(data.payments.payments);

  for (const order of data.orders.orders) {
    const locationId = locationMap.get(order.location_id);
    if (!locationId) continue;

    const orderId = randomUUID();
    const fulfillment = order.fulfillments?.[0];
    const orderType = fulfillment ? mapSquareOrderType(fulfillment.type) : 'dine_in';

    for (const lineItem of order.line_items) {
      const catalogInfo = variationToItem.get(lineItem.catalog_object_id);
      items.push(processLineItem(lineItem, orderId, catalogInfo, productMap, variationMap));
    }

    const orderItems = items.filter(i => i.order_id === orderId);
    if (orderItems.length === 0) continue;

    orders.push(createOrderRecord(order, orderId, locationId, orderType));

    const orderPayments = paymentsByOrder.get(order.id) || [];
    for (const payment of orderPayments) {
      payments.push(processPayment(payment, orderId));
    }
  }

  return { orders, items, payments };
}
