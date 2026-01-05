import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../lib/supabase.js';
import {
  findCanonicalProduct,
  mapToastOrderType,
  mapToastChannel,
  normalizePaymentType,
  normalizeCardBrand
} from '../lib/normalizers.js';
import type { ToastData, DbOrder, DbOrderItem, DbPayment, DbProduct, DbProductAlias } from '../lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data/sources');

export async function loadToast(
  locationMap: Map<string, string>,
  products: Array<DbProduct & { id: string }>
): Promise<{ orders: number; items: number; payments: number }> {
  console.log('Loading Toast POS data...');

  // Load Toast data
  const toastPath = join(DATA_DIR, 'toast_pos_export.json');
  const toastData: ToastData = JSON.parse(readFileSync(toastPath, 'utf-8'));

  // Track new aliases to register
  const newAliases: DbProductAlias[] = [];
  const aliasCache = new Set<string>();

  // Process orders
  const orderInserts: DbOrder[] = [];
  const itemInsertGroups: DbOrderItem[][] = [];
  const paymentInsertGroups: DbPayment[][] = [];

  for (const order of toastData.orders) {
    // Skip voided/deleted orders
    if (order.voided || order.deleted) continue;

    // Map location
    const locationId = locationMap.get(order.restaurantGuid);
    if (!locationId) {
      console.warn(`Unknown Toast location: ${order.restaurantGuid}`);
      continue;
    }

    // Each Toast order has checks (tabs), we'll create one unified order
    // Calculate totals across all checks
    let subtotal = 0;
    let tax = 0;
    let tip = 0;
    let total = 0;

    const orderItems: DbOrderItem[] = [];
    const orderPayments: DbPayment[] = [];

    for (const check of order.checks) {
      if (check.voided || check.deleted) continue;

      subtotal += check.amount;
      tax += check.taxAmount;
      tip += check.tipAmount;
      total += check.totalAmount;

      // Process selections (items)
      for (const selection of check.selections) {
        if (selection.voided) continue;

        // Find canonical product
        const canonical = findCanonicalProduct(selection.displayName, products);

        // Register alias if found and not already cached
        if (canonical) {
          const aliasKey = `${selection.displayName.toLowerCase()}:toast`;
          if (!aliasCache.has(aliasKey)) {
            aliasCache.add(aliasKey);
            newAliases.push({
              product_id: canonical.id,
              raw_name: selection.displayName,
              source: 'toast'
            });
          }
        }

        orderItems.push({
          order_id: '', // Will be set after order insert
          product_id: canonical?.id,
          original_name: selection.displayName,
          quantity: selection.quantity,
          unit_price_cents: Math.round(selection.preDiscountPrice / selection.quantity),
          total_price_cents: selection.price,
          tax_cents: selection.tax,
          modifiers: selection.modifiers.map(m => ({
            name: m.displayName,
            price: m.price
          }))
        });
      }

      // Process payments
      for (const payment of check.payments) {
        if (payment.refundStatus === 'FULL_REFUND') continue;

        orderPayments.push({
          order_id: '', // Will be set after order insert
          source_payment_id: payment.guid,
          payment_type: normalizePaymentType(payment.type),
          card_brand: normalizeCardBrand(payment.cardType),
          last_four: payment.last4Digits,
          amount_cents: payment.amount,
          tip_cents: payment.tipAmount,
          processing_fee_cents: payment.originalProcessingFee,
          created_at: payment.paidDate
        });
      }
    }

    // Skip orders with no items
    if (orderItems.length === 0) continue;

    orderInserts.push({
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
      total_cents: total
    });

    itemInsertGroups.push(orderItems);
    paymentInsertGroups.push(orderPayments);
  }

  // Insert orders
  const { data: insertedOrders, error: orderError } = await supabase
    .from('orders')
    .insert(orderInserts)
    .select('id');

  if (orderError) {
    throw new Error(`Failed to insert Toast orders: ${orderError.message}`);
  }

  console.log(`Inserted ${insertedOrders.length} Toast orders`);

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
        console.warn(`Warning inserting items for order ${orderId}: ${itemError.message}`);
      } else {
        totalItems += items.length;
      }
    }
  }

  console.log(`Inserted ${totalItems} Toast order items`);

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
        console.warn(`Warning inserting payments for order ${orderId}: ${payError.message}`);
      } else {
        totalPayments += payments.length;
      }
    }
  }

  console.log(`Inserted ${totalPayments} Toast payments`);

  // Register new aliases
  if (newAliases.length > 0) {
    const { error: aliasError } = await supabase
      .from('product_aliases')
      .upsert(newAliases, { onConflict: 'raw_name,source', ignoreDuplicates: true });

    if (aliasError) {
      console.warn(`Warning inserting Toast aliases: ${aliasError.message}`);
    } else {
      console.log(`Registered ${newAliases.length} new product aliases from Toast`);
    }
  }

  return {
    orders: insertedOrders.length,
    items: totalItems,
    payments: totalPayments
  };
}

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  // Would need to run seed-locations and build-products first
  console.log('Run via run-all.ts or ensure locations and products are seeded first');
}
