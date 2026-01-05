import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../lib/supabase.js';
import { findCanonicalProduct, mapDoorDashOrderType } from '../lib/normalizers.js';
import type { DoorDashData, DbOrder, DbOrderItem, DbProduct, DbProductAlias } from '../lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data/sources');

export async function loadDoorDash(
  locationMap: Map<string, string>,
  products: Array<DbProduct & { id: string }>
): Promise<{ orders: number; items: number }> {
  console.log('Loading DoorDash data...');

  // Load DoorDash data
  const ddPath = join(DATA_DIR, 'doordash_orders.json');
  const ddData: DoorDashData = JSON.parse(readFileSync(ddPath, 'utf-8'));

  // Track new aliases
  const newAliases: DbProductAlias[] = [];
  const aliasCache = new Set<string>();

  // Process orders
  const orderInserts: DbOrder[] = [];
  const itemInsertGroups: DbOrderItem[][] = [];

  for (const order of ddData.orders) {
    // Map location
    const locationId = locationMap.get(order.store_id);
    if (!locationId) {
      console.warn(`Unknown DoorDash store: ${order.store_id}`);
      continue;
    }

    // Process order items
    const orderItems: DbOrderItem[] = [];

    for (const item of order.order_items) {
      // Find canonical product
      const canonical = findCanonicalProduct(item.name, products);

      // Register alias if found
      if (canonical) {
        const aliasKey = `${item.name.toLowerCase()}:doordash`;
        if (!aliasCache.has(aliasKey)) {
          aliasCache.add(aliasKey);
          newAliases.push({
            product_id: canonical.id,
            raw_name: item.name,
            source: 'doordash'
          });
        }
      }

      orderItems.push({
        order_id: '', // Will be set after order insert
        product_id: canonical?.id,
        original_name: item.name,
        quantity: item.quantity,
        unit_price_cents: item.unit_price,
        total_price_cents: item.total_price,
        modifiers: item.options,
        special_instructions: item.special_instructions || undefined
      });
    }

    // Skip orders with no items
    if (orderItems.length === 0) continue;

    orderInserts.push({
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
      is_catering: order.is_catering
    });

    itemInsertGroups.push(orderItems);
  }

  // Insert orders
  const { data: insertedOrders, error: orderError } = await supabase
    .from('orders')
    .insert(orderInserts)
    .select('id');

  if (orderError) {
    throw new Error(`Failed to insert DoorDash orders: ${orderError.message}`);
  }

  console.log(`Inserted ${insertedOrders.length} DoorDash orders`);

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
        console.warn(`Warning inserting items for DoorDash order ${orderId}: ${itemError.message}`);
      } else {
        totalItems += items.length;
      }
    }
  }

  console.log(`Inserted ${totalItems} DoorDash order items`);

  // DoorDash payments are handled differently (through DoorDash platform)
  // We don't have individual payment records, just order totals

  // Register new aliases
  if (newAliases.length > 0) {
    const { error: aliasError } = await supabase
      .from('product_aliases')
      .upsert(newAliases, { onConflict: 'raw_name,source', ignoreDuplicates: true });

    if (aliasError) {
      console.warn(`Warning inserting DoorDash aliases: ${aliasError.message}`);
    } else {
      console.log(`Registered ${newAliases.length} new product aliases from DoorDash`);
    }
  }

  return {
    orders: insertedOrders.length,
    items: totalItems
  };
}

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Run via run-all.ts or ensure locations and products are seeded first');
}
