import { randomUUID } from 'node:crypto';
import {
  findCanonicalProduct,
  mapDoorDashOrderType,
  extractVariation,
} from '../normalizers.js';
import type { DbProduct, DbProductVariation, DbOrder, DbOrderItem, DbPayment, DoorDashData, DoorDashOrder, DoorDashOrderItem } from '../types.js';
import type { OrdersResult, AddAliasFunction } from './types.js';

interface ItemProcessingContext {
  products: Array<DbProduct & { id: string }>;
  variationMap: Map<string, string>;
  addAlias: AddAliasFunction;
}

function processOrderItem(
  item: DoorDashOrderItem,
  orderId: string,
  ctx: ItemProcessingContext
): DbOrderItem & { id: string } {
  const canonical = findCanonicalProduct(item.name, ctx.products);
  if (canonical) {
    ctx.addAlias(canonical.id, item.name, 'doordash');
  }

  let variationId: string | undefined;
  if (canonical) {
    const { variation } = extractVariation(item.name);
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
    original_name: item.name,
    quantity: item.quantity,
    unit_price_cents: item.unit_price,
    total_price_cents: item.total_price,
    modifiers: item.options,
    special_instructions: item.special_instructions || undefined,
    raw_data: item,
  };
}

function createOrderRecord(order: DoorDashOrder, orderId: string, locationId: string): DbOrder & { id: string } {
  return {
    id: orderId,
    source: 'doordash',
    source_order_id: order.external_delivery_id,
    location_id: locationId,
    order_type: mapDoorDashOrderType(order.order_fulfillment_method),
    channel: 'doordash',
    status: order.order_status.toLowerCase(),
    created_at: order.created_at,
    closed_at: order.delivery_time || order.pickup_time,
    subtotal_cents: order.order_subtotal,
    tax_cents: order.tax_amount,
    tip_cents: order.dasher_tip,
    total_cents: order.total_charged_to_consumer,
    delivery_fee_cents: order.delivery_fee,
    service_fee_cents: order.service_fee,
    commission_cents: order.commission,
    contains_alcohol: order.contains_alcohol,
    is_catering: order.is_catering,
    raw_data: order,
  };
}

function createPaymentRecord(order: DoorDashOrder, orderId: string): DbPayment & { id: string } {
  return {
    id: randomUUID(),
    order_id: orderId,
    source_payment_id: `dd_pay_${order.external_delivery_id}`,
    payment_type: 'doordash',
    amount_cents: order.merchant_payout,
    tip_cents: order.dasher_tip,
    processing_fee_cents: order.commission,
    created_at: order.delivery_time || order.pickup_time || order.created_at,
    raw_data: { source: 'doordash', order_id: order.external_delivery_id, merchant_payout: order.merchant_payout, commission: order.commission },
  };
}

export function processDoorDashOrders(
  data: DoorDashData,
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
    const locationId = locationMap.get(order.store_id);
    if (!locationId) continue;

    const orderId = randomUUID();

    for (const item of order.order_items) {
      items.push(processOrderItem(item, orderId, ctx));
    }

    const orderItems = items.filter(i => i.order_id === orderId);
    if (orderItems.length === 0) continue;

    orders.push(createOrderRecord(order, orderId, locationId));
    payments.push(createPaymentRecord(order, orderId));
  }

  return { orders, items, payments };
}
