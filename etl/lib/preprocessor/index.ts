import { randomUUID } from 'node:crypto';
import type { LocationConfig, DbProductAlias } from '../types.js';
import type { NormalizedData, SourceData } from './types.js';
import { buildLocations } from './build-locations.js';
import { buildUnifiedCatalog } from './build-catalog.js';
import { processToastOrders } from './process-toast.js';
import { processDoorDashOrders } from './process-doordash.js';
import { processSquareOrders } from './process-square.js';

// Re-export types
export type { NormalizedData, SourceData } from './types.js';

export function preprocessData(sources: SourceData, locationConfigs: LocationConfig[]): NormalizedData {
  // Step 1: Build locations
  const { locations, locationMap } = buildLocations(sources, locationConfigs);

  // Step 2: Build unified catalog from ALL sources (Square, Toast, DoorDash)
  const { categories, products, product_variations, productMap, categoryMap, variationMap } = buildUnifiedCatalog(sources);

  // Step 3: Process orders and collect aliases
  const aliasCache = new Set<string>();
  const aliases: Array<DbProductAlias & { id: string }> = [];

  // Helper to add alias
  const addAlias = (productId: string, rawName: string, source: string) => {
    const key = `${rawName.toLowerCase()}:${source}`;
    if (!aliasCache.has(key)) {
      aliasCache.add(key);
      aliases.push({
        id: randomUUID(),
        product_id: productId,
        raw_name: rawName,
        source,
      });
    }
  };

  // Add Square catalog aliases
  for (const obj of sources.square.catalog.objects) {
    if (obj.type === 'ITEM' && obj.item_data) {
      const productId = productMap.get(obj.id);
      if (productId) {
        addAlias(productId, obj.item_data.name, 'square');
      }
    }
  }

  // Step 4: Process Toast orders
  const { orders: toastOrders, items: toastItems, payments: toastPayments } = processToastOrders(
    sources.toast,
    locationMap,
    products,
    product_variations,
    variationMap,
    addAlias
  );

  // Step 5: Process DoorDash orders
  const { orders: ddOrders, items: ddItems, payments: ddPayments } = processDoorDashOrders(
    sources.doordash,
    locationMap,
    products,
    product_variations,
    variationMap,
    addAlias
  );

  // Step 6: Process Square orders
  const { orders: sqOrders, items: sqItems, payments: sqPayments } = processSquareOrders(
    sources.square,
    locationMap,
    productMap,
    variationMap,
    categoryMap
  );

  return {
    locations,
    categories,
    products,
    product_variations,
    product_aliases: aliases,
    orders: [...toastOrders, ...ddOrders, ...sqOrders],
    order_items: [...toastItems, ...ddItems, ...sqItems],
    payments: [...toastPayments, ...ddPayments, ...sqPayments],
  };
}
