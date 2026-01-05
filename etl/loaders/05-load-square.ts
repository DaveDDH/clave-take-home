import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../lib/supabase.js';
import {
  mapSquareOrderType,
  mapSquareChannel,
  normalizeCardBrand
} from '../lib/normalizers.js';
import type {
  SquareOrdersData,
  SquarePaymentsData,
  SquareCatalogData,
  DbOrder,
  DbOrderItem,
  DbPayment
} from '../lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data/sources');

export async function loadSquare(
  locationMap: Map<string, string>,
  productMap: Map<string, string>
): Promise<{ orders: number; items: number; payments: number }> {
  console.log('Loading Square data...');

  // Load Square data files
  const ordersPath = join(DATA_DIR, 'square/orders.json');
  const paymentsPath = join(DATA_DIR, 'square/payments.json');
  const catalogPath = join(DATA_DIR, 'square/catalog.json');

  const ordersData: SquareOrdersData = JSON.parse(readFileSync(ordersPath, 'utf-8'));
  const paymentsData: SquarePaymentsData = JSON.parse(readFileSync(paymentsPath, 'utf-8'));
  const catalogData: SquareCatalogData = JSON.parse(readFileSync(catalogPath, 'utf-8'));

  // Build catalog lookup: variation_id -> item details
  const variationToItem = new Map<string, { itemId: string; itemName: string; varName: string }>();
  for (const obj of catalogData.objects) {
    if (obj.type === 'ITEM' && obj.item_data?.variations) {
      for (const variation of obj.item_data.variations) {
        variationToItem.set(variation.id, {
          itemId: obj.id,
          itemName: obj.item_data.name,
          varName: variation.item_variation_data.name
        });
      }
    }
  }

  // Build payment lookup by order_id
  const paymentsByOrder = new Map<string, typeof paymentsData.payments>();
  for (const payment of paymentsData.payments) {
    const existing = paymentsByOrder.get(payment.order_id) || [];
    existing.push(payment);
    paymentsByOrder.set(payment.order_id, existing);
  }

  // Process orders
  const orderInserts: DbOrder[] = [];
  const itemInsertGroups: DbOrderItem[][] = [];
  const paymentInsertGroups: DbPayment[][] = [];

  for (const order of ordersData.orders) {
    // Map location
    const locationId = locationMap.get(order.location_id);
    if (!locationId) {
      console.warn(`Unknown Square location: ${order.location_id}`);
      continue;
    }

    // Determine order type from fulfillments
    const fulfillment = order.fulfillments?.[0];
    const orderType = fulfillment ? mapSquareOrderType(fulfillment.type) : 'dine_in';

    // Process line items
    const orderItems: DbOrderItem[] = [];

    for (const lineItem of order.line_items) {
      // Look up product from catalog
      const catalogInfo = variationToItem.get(lineItem.catalog_object_id);
      const productId = catalogInfo ? productMap.get(catalogInfo.itemId) : undefined;
      const itemName = catalogInfo
        ? `${catalogInfo.itemName}${catalogInfo.varName !== 'Regular' ? ` - ${catalogInfo.varName}` : ''}`
        : lineItem.catalog_object_id;

      const quantity = parseInt(lineItem.quantity, 10);
      const totalPrice = lineItem.total_money.amount;
      const unitPrice = Math.round(totalPrice / quantity);

      orderItems.push({
        order_id: '', // Will be set after order insert
        product_id: productId,
        original_name: itemName,
        quantity,
        unit_price_cents: unitPrice,
        total_price_cents: totalPrice,
        modifiers: lineItem.applied_modifiers?.map(m => ({ modifier_id: m.modifier_id })) || []
      });
    }

    // Skip orders with no items
    if (orderItems.length === 0) continue;

    // Calculate subtotal (total - tax - tip)
    const total = order.total_money.amount;
    const tax = order.total_tax_money.amount;
    const tip = order.total_tip_money.amount;
    const subtotal = total - tax - tip;

    orderInserts.push({
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
      total_cents: total
    });

    itemInsertGroups.push(orderItems);

    // Process payments for this order
    const orderPayments: DbPayment[] = [];
    const payments = paymentsByOrder.get(order.id) || [];

    for (const payment of payments) {
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

      orderPayments.push({
        order_id: '', // Will be set after order insert
        source_payment_id: payment.id,
        payment_type: paymentType,
        card_brand: cardBrand,
        last_four: lastFour,
        amount_cents: payment.amount_money.amount,
        tip_cents: payment.tip_money.amount,
        created_at: payment.created_at
      });
    }

    paymentInsertGroups.push(orderPayments);
  }

  // Insert orders
  const { data: insertedOrders, error: orderError } = await supabase
    .from('orders')
    .insert(orderInserts)
    .select('id');

  if (orderError) {
    throw new Error(`Failed to insert Square orders: ${orderError.message}`);
  }

  console.log(`Inserted ${insertedOrders.length} Square orders`);

  // Insert items with order IDs
  let totalItems = 0;
  for (let i = 0; i < insertedOrders.length; i++) {
    const orderId = insertedOrders[i].id;
    const items = itemInsertGroups[i].map(item => ({
      ...item,
      order_id: orderId
    }));

    if (items.length > 0) {
      const { error: itemError } = await supabase.from('order_items').insert(items);
      if (itemError) {
        console.warn(`Warning inserting items for Square order ${orderId}: ${itemError.message}`);
      } else {
        totalItems += items.length;
      }
    }
  }

  console.log(`Inserted ${totalItems} Square order items`);

  // Insert payments with order IDs
  let totalPayments = 0;
  for (let i = 0; i < insertedOrders.length; i++) {
    const orderId = insertedOrders[i].id;
    const payments = paymentInsertGroups[i].map(payment => ({
      ...payment,
      order_id: orderId
    }));

    if (payments.length > 0) {
      const { error: payError } = await supabase.from('payments').insert(payments);
      if (payError) {
        console.warn(`Warning inserting payments for Square order ${orderId}: ${payError.message}`);
      } else {
        totalPayments += payments.length;
      }
    }
  }

  console.log(`Inserted ${totalPayments} Square payments`);

  return {
    orders: insertedOrders.length,
    items: totalItems,
    payments: totalPayments
  };
}

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Run via run-all.ts or ensure locations and products are seeded first');
}
