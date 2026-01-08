import { randomUUID } from 'crypto';
import {
  normalizeCategory,
  findCanonicalProduct,
  mapToastOrderType,
  mapToastChannel,
  mapDoorDashOrderType,
  mapSquareOrderType,
  mapSquareChannel,
  normalizePaymentType,
  normalizeCardBrand,
  extractVariation,
  getNormalizedBaseName,
  normalizeVariationName,
} from './normalizers.js';
import { levenshtein } from './levenshtein.js';
import { matchProductToGroup } from './product-groups.js';
import type {
  DbLocation,
  DbCategory,
  DbProduct,
  DbProductVariation,
  DbProductAlias,
  DbOrder,
  DbOrderItem,
  DbPayment,
  ToastData,
  DoorDashData,
  SquareCatalogData,
  SquareOrdersData,
  SquarePaymentsData,
  SquareLocationsData,
  LocationConfig,
} from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface NormalizedData {
  locations: Array<DbLocation & { id: string }>;
  categories: Array<DbCategory & { id: string }>;
  products: Array<DbProduct & { id: string }>;
  product_variations: Array<DbProductVariation & { id: string }>;
  product_aliases: Array<DbProductAlias & { id: string }>;
  orders: Array<DbOrder & { id: string }>;
  order_items: Array<DbOrderItem & { id: string }>;
  payments: Array<DbPayment & { id: string }>;
}

export interface SourceData {
  toast: ToastData;
  doordash: DoorDashData;
  square: {
    locations: SquareLocationsData;
    catalog: SquareCatalogData;
    orders: SquareOrdersData;
    payments: SquarePaymentsData;
  };
}

// ============================================================================
// MAIN PREPROCESSOR
// ============================================================================

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

// ============================================================================
// BUILD LOCATIONS
// ============================================================================

function buildLocations(
  sources: SourceData,
  locationConfigs: LocationConfig[]
): {
  locations: Array<DbLocation & { id: string }>;
  locationMap: Map<string, string>;
} {
  const locations: Array<DbLocation & { id: string }> = [];
  const locationMap = new Map<string, string>();

  // Get address info from Square locations (most complete)
  const squareLocMap = new Map(
    sources.square.locations.locations.map(l => [l.id, l])
  );

  for (const config of locationConfigs) {
    const id = randomUUID();
    const squareLoc = squareLocMap.get(config.square_id);

    locations.push({
      id,
      name: config.name,
      address: squareLoc
        ? {
            line1: squareLoc.address.address_line_1,
            city: squareLoc.address.locality,
            state: squareLoc.address.administrative_district_level_1,
            zip: squareLoc.address.postal_code,
            country: squareLoc.address.country,
          }
        : undefined,
      timezone: squareLoc?.timezone ?? 'America/New_York',
      toast_id: config.toast_id,
      doordash_id: config.doordash_id,
      square_id: config.square_id,
      raw_data: { config, square_location: squareLoc },
    });

    // Map all source IDs to unified ID
    locationMap.set(config.toast_id, id);
    locationMap.set(config.doordash_id, id);
    locationMap.set(config.square_id, id);
    locationMap.set(config.name, id);
  }

  return { locations, locationMap };
}

// ============================================================================
// BUILD CATALOG (Categories + Products from ALL sources)
// ============================================================================

// Helper to pick the "best" canonical name (prefer properly capitalized, no typos)
function pickCanonicalName(names: string[]): string {
  // Sort by: proper capitalization first, then longer names
  return names.sort((a, b) => {
    // Prefer names that start with uppercase
    const aProper = a[0] === a[0].toUpperCase();
    const bProper = b[0] === b[0].toUpperCase();
    if (aProper && !bProper) return -1;
    if (!aProper && bProper) return 1;
    // Then prefer longer names (usually more complete)
    return b.length - a.length;
  })[0];
}

// Raw item from any source
interface RawProductItem {
  source: 'square' | 'toast' | 'doordash';
  sourceId?: string; // Square item ID or variation ID
  originalName: string;
  baseName: string;
  extractedVariation?: string;
  extractedVariationType?: 'quantity' | 'size' | 'serving' | 'strength' | 'semantic';
  categoryId?: string;
  categoryName?: string;
  description?: string;
  squareVariations?: Array<{ id: string; name: string }>;
}

function buildUnifiedCatalog(sources: SourceData): {
  categories: Array<DbCategory & { id: string }>;
  products: Array<DbProduct & { id: string }>;
  product_variations: Array<DbProductVariation & { id: string }>;
  productMap: Map<string, string>;
  categoryMap: Map<string, string>;
  variationMap: Map<string, string>;
} {
  const rawItems: RawProductItem[] = [];
  const rawCategories = new Map<string, { squareId?: string; name: string }>();

  // ========================================
  // 1. Collect from Square catalog
  // ========================================
  for (const obj of sources.square.catalog.objects) {
    if (obj.type === 'CATEGORY' && obj.category_data) {
      const normalized = normalizeCategory(obj.category_data.name);
      if (!rawCategories.has(normalized)) {
        rawCategories.set(normalized, { squareId: obj.id, name: normalized });
      }
    }
  }

  for (const obj of sources.square.catalog.objects) {
    if (obj.type === 'ITEM' && obj.item_data) {
      const { baseName, variation, variationType } = extractVariation(obj.item_data.name);

      rawItems.push({
        source: 'square',
        sourceId: obj.id,
        originalName: obj.item_data.name,
        baseName,
        extractedVariation: variation,
        extractedVariationType: variationType,
        categoryId: obj.item_data.category_id,
        description: obj.item_data.description,
        squareVariations: (obj.item_data.variations || []).map(v => ({
          id: v.id,
          name: v.item_variation_data.name,
        })),
      });
    }
  }

  // ========================================
  // 2. Collect from Toast orders
  // ========================================
  const seenToastItems = new Set<string>();
  for (const order of sources.toast.orders) {
    if (order.voided || order.deleted) continue;
    for (const check of order.checks) {
      if (check.voided || check.deleted) continue;
      for (const selection of check.selections) {
        if (selection.voided) continue;

        const normalizedKey = selection.displayName.toLowerCase().trim();
        if (seenToastItems.has(normalizedKey)) continue;
        seenToastItems.add(normalizedKey);

        const { baseName, variation, variationType } = extractVariation(selection.displayName);

        // Get category from item group if available
        let categoryName: string | undefined;
        if (selection.itemGroup?.name) {
          categoryName = normalizeCategory(selection.itemGroup.name);
          if (!rawCategories.has(categoryName)) {
            rawCategories.set(categoryName, { name: categoryName });
          }
        }

        rawItems.push({
          source: 'toast',
          sourceId: selection.guid,
          originalName: selection.displayName,
          baseName,
          extractedVariation: variation,
          extractedVariationType: variationType,
          categoryName,
        });
      }
    }
  }

  // ========================================
  // 3. Collect from DoorDash orders
  // ========================================
  const seenDoorDashItems = new Set<string>();
  for (const order of sources.doordash.orders) {
    for (const item of order.order_items) {
      const normalizedKey = item.name.toLowerCase().trim();
      if (seenDoorDashItems.has(normalizedKey)) continue;
      seenDoorDashItems.add(normalizedKey);

      const { baseName, variation, variationType } = extractVariation(item.name);

      // Get category if available
      let categoryName: string | undefined;
      if (item.category) {
        categoryName = normalizeCategory(item.category);
        if (!rawCategories.has(categoryName)) {
          rawCategories.set(categoryName, { name: categoryName });
        }
      }

      rawItems.push({
        source: 'doordash',
        sourceId: item.item_id,
        originalName: item.name,
        baseName,
        extractedVariation: variation,
        extractedVariationType: variationType,
        categoryName,
      });
    }
  }

  // ========================================
  // 4. Build categories
  // ========================================
  const categoryMap = new Map<string, string>();
  const categories: Array<DbCategory & { id: string }> = [];

  for (const [name, info] of rawCategories) {
    const id = randomUUID();
    categories.push({ id, name, raw_data: info });
    categoryMap.set(name, id);
    if (info.squareId) {
      categoryMap.set(info.squareId, id);
    }
  }

  // ========================================
  // 5. Group products using configured groups + Levenshtein fallback
  // ========================================
  interface ProductGroupResult {
    canonicalName: string;
    categoryId?: string;
    description?: string;
    items: RawProductItem[];
  }

  const productGroups: ProductGroupResult[] = [];
  const configuredGroups = new Map<string, ProductGroupResult>(); // baseName -> group
  const SIMILARITY_THRESHOLD = 3;

  for (const item of rawItems) {
    // First: check if item matches a configured product group
    const groupMatch = matchProductToGroup(item.originalName);

    if (groupMatch) {
      // Item matches a configured group - use the group's base name
      const groupKey = groupMatch.baseName.toLowerCase();

      if (configuredGroups.has(groupKey)) {
        // Add to existing configured group
        const group = configuredGroups.get(groupKey)!;
        group.items.push(item);

        // Override item's extracted variation with the group match
        if (groupMatch.variationName) {
          item.extractedVariation = groupMatch.variationName;
          item.extractedVariationType = 'semantic'; // Mark as semantic variation
        }

        // Keep description if we have one
        if (!group.description && item.description) {
          group.description = item.description;
        }
        // Keep category if we have one
        if (!group.categoryId) {
          if (item.categoryId) {
            group.categoryId = item.categoryId;
          } else if (item.categoryName) {
            group.categoryId = item.categoryName;
          }
        }
      } else {
        // Create new configured group
        if (groupMatch.variationName) {
          item.extractedVariation = groupMatch.variationName;
          item.extractedVariationType = 'semantic';
        }

        const newGroup: ProductGroupResult = {
          canonicalName: groupMatch.baseName,
          categoryId: item.categoryId || item.categoryName,
          description: item.description,
          items: [item],
        };
        configuredGroups.set(groupKey, newGroup);
        productGroups.push(newGroup);
      }
      continue;
    }

    // Fallback: use Levenshtein grouping for items that don't match any configured group
    const normalizedBaseName = getNormalizedBaseName(item.originalName);

    let foundGroup = false;
    for (const group of productGroups) {
      // Skip configured groups for Levenshtein matching
      if (configuredGroups.has(group.canonicalName.toLowerCase())) {
        continue;
      }

      const groupNormalizedBase = getNormalizedBaseName(group.canonicalName);
      const distance = levenshtein(normalizedBaseName, groupNormalizedBase, { maxDistance: SIMILARITY_THRESHOLD });

      if (distance <= SIMILARITY_THRESHOLD) {
        group.items.push(item);
        // Update canonical name from all base names
        const allBaseNames = group.items.map(i => i.baseName);
        group.canonicalName = pickCanonicalName(allBaseNames);
        // Keep description if we have one (prefer Square descriptions)
        if (!group.description && item.description) {
          group.description = item.description;
        }
        // Keep category if we have one
        if (!group.categoryId) {
          if (item.categoryId) {
            group.categoryId = item.categoryId;
          } else if (item.categoryName) {
            group.categoryId = item.categoryName;
          }
        }
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      productGroups.push({
        canonicalName: item.baseName,
        categoryId: item.categoryId || item.categoryName,
        description: item.description,
        items: [item],
      });
    }
  }

  // ========================================
  // 6. Build products and variations
  // ========================================
  const products: Array<DbProduct & { id: string }> = [];
  const product_variations: Array<DbProductVariation & { id: string }> = [];
  const productMap = new Map<string, string>();
  const variationMap = new Map<string, string>();
  const seenVariations = new Set<string>();

  // Track variation names per product for deduplication
  const variationNamesByProduct = new Map<string, Map<string, string>>(); // productId -> (normalizedName -> canonicalName)

  /**
   * Find or create a canonical variation name for a product.
   * Handles deduplication of similar names (e.g., "Griled Chicken" vs "Grilled Chicken")
   */
  function getCanonicalVariationName(productId: string, variationName: string): string {
    if (!variationNamesByProduct.has(productId)) {
      variationNamesByProduct.set(productId, new Map());
    }
    const productVariations = variationNamesByProduct.get(productId)!;

    const normalizedLower = variationName.toLowerCase();

    // Check for exact match first
    if (productVariations.has(normalizedLower)) {
      return productVariations.get(normalizedLower)!;
    }

    // Check for similar names (Levenshtein distance <= 2)
    for (const [existingLower, existingCanonical] of productVariations) {
      const distance = levenshtein(normalizedLower, existingLower, { maxDistance: 2 });
      if (distance <= 2) {
        // Found similar name - use the longer/better one as canonical
        const canonical = existingCanonical.length >= variationName.length ? existingCanonical : variationName;
        productVariations.set(normalizedLower, canonical);
        productVariations.set(existingLower, canonical);
        return canonical;
      }
    }

    // No similar name found - this is a new canonical name
    productVariations.set(normalizedLower, variationName);
    return variationName;
  }

  for (const group of productGroups) {
    const productId = randomUUID();
    const categoryId = group.categoryId
      ? categoryMap.get(group.categoryId)
      : undefined;

    // Collect raw data from all items that formed this product
    const rawItems = group.items.map(item => ({
      source: item.source,
      sourceId: item.sourceId,
      originalName: item.originalName,
    }));

    products.push({
      id: productId,
      name: group.canonicalName,
      category_id: categoryId,
      description: group.description,
      raw_data: { items: rawItems },
    });

    // Map all item IDs and names to this product
    for (const item of group.items) {
      if (item.sourceId) {
        productMap.set(item.sourceId, productId);
      }
      productMap.set(item.originalName.toLowerCase(), productId);
      productMap.set(item.baseName.toLowerCase(), productId);

      // Add extracted variation
      if (item.extractedVariation) {
        // Normalize the variation name (handle "lg" → "Large", "12pc" → "12 pcs", etc.)
        const { normalized: normalizedName, variationType: normalizedType } =
          normalizeVariationName(item.extractedVariation);
        const finalType = normalizedType || item.extractedVariationType;

        // Deduplicate similar variation names
        const canonicalName = getCanonicalVariationName(productId, normalizedName);
        const variationKey = `${productId}:${canonicalName.toLowerCase()}`;

        if (!seenVariations.has(variationKey)) {
          seenVariations.add(variationKey);
          const variationId = randomUUID();
          product_variations.push({
            id: variationId,
            product_id: productId,
            name: canonicalName,
            variation_type: finalType,
            source_raw_name: item.originalName,
            raw_data: { source: item.source, sourceId: item.sourceId, originalName: item.originalName, extractedVariation: item.extractedVariation },
          });
          variationMap.set(variationKey, variationId);
        }
      }

      // Add Square catalog variations
      if (item.squareVariations) {
        for (const sqVariation of item.squareVariations) {
          productMap.set(sqVariation.id, productId);

          if (sqVariation.name.toLowerCase() === 'regular') continue;

          const { variation: extractedVar, variationType } = extractVariation(sqVariation.name);
          const rawVarName = extractedVar || sqVariation.name;

          // Normalize the variation name
          const { normalized: normalizedName, variationType: normalizedType } =
            normalizeVariationName(rawVarName);
          const finalType = normalizedType || variationType;

          // Deduplicate similar variation names
          const canonicalName = getCanonicalVariationName(productId, normalizedName);
          const variationKey = `${productId}:${canonicalName.toLowerCase()}`;

          if (!seenVariations.has(variationKey)) {
            seenVariations.add(variationKey);
            const variationId = randomUUID();
            product_variations.push({
              id: variationId,
              product_id: productId,
              name: canonicalName,
              variation_type: finalType,
              source_raw_name: `${item.originalName} - ${sqVariation.name}`,
              raw_data: { source: 'square', squareVariationId: sqVariation.id, squareVariationName: sqVariation.name, parentItemName: item.originalName },
            });
            variationMap.set(variationKey, variationId);
          }
        }
      }
    }
  }

  return { categories, products, product_variations, productMap, categoryMap, variationMap };
}

// ============================================================================
// PROCESS TOAST ORDERS
// ============================================================================

function processToastOrders(
  data: ToastData,
  locationMap: Map<string, string>,
  products: Array<DbProduct & { id: string }>,
  _variations: Array<DbProductVariation & { id: string }>,
  variationMap: Map<string, string>,
  addAlias: (productId: string, rawName: string, source: string) => void
): {
  orders: Array<DbOrder & { id: string }>;
  items: Array<DbOrderItem & { id: string }>;
  payments: Array<DbPayment & { id: string }>;
} {
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
      raw_data: order, // Store original Toast order for auditing
    });
  }

  return { orders, items, payments };
}

// ============================================================================
// PROCESS DOORDASH ORDERS
// ============================================================================

function processDoorDashOrders(
  data: DoorDashData,
  locationMap: Map<string, string>,
  products: Array<DbProduct & { id: string }>,
  _variations: Array<DbProductVariation & { id: string }>,
  variationMap: Map<string, string>,
  addAlias: (productId: string, rawName: string, source: string) => void
): {
  orders: Array<DbOrder & { id: string }>;
  items: Array<DbOrderItem & { id: string }>;
  payments: Array<DbPayment & { id: string }>;
} {
  const orders: Array<DbOrder & { id: string }> = [];
  const items: Array<DbOrderItem & { id: string }> = [];
  const payments: Array<DbPayment & { id: string }> = [];

  for (const order of data.orders) {
    const locationId = locationMap.get(order.store_id);
    if (!locationId) continue;

    const orderId = randomUUID();

    // Process items
    for (const item of order.order_items) {
      const canonical = findCanonicalProduct(item.name, products);
      if (canonical) {
        addAlias(canonical.id, item.name, 'doordash');
      }

      // Try to find variation for this item
      let variationId: string | undefined;
      if (canonical) {
        const { variation } = extractVariation(item.name);
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
        original_name: item.name,
        quantity: item.quantity,
        unit_price_cents: item.unit_price,
        total_price_cents: item.total_price,
        modifiers: item.options,
        special_instructions: item.special_instructions || undefined,
        raw_data: item,
      });
    }

    // Skip if no items
    const orderItems = items.filter(i => i.order_id === orderId);
    if (orderItems.length === 0) continue;

    orders.push({
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
      raw_data: order, // Store original DoorDash order for auditing
    });

    // Create payment for DoorDash order (payment handled by DoorDash platform)
    payments.push({
      id: randomUUID(),
      order_id: orderId,
      source_payment_id: `dd_pay_${order.external_delivery_id}`,
      payment_type: 'doordash',
      amount_cents: order.merchant_payout,
      tip_cents: order.dasher_tip,
      processing_fee_cents: order.commission,
      created_at: order.delivery_time || order.pickup_time || order.created_at,
      raw_data: { source: 'doordash', order_id: order.external_delivery_id, merchant_payout: order.merchant_payout, commission: order.commission },
    });
  }

  return { orders, items, payments };
}

// ============================================================================
// PROCESS SQUARE ORDERS
// ============================================================================

function processSquareOrders(
  data: SourceData['square'],
  locationMap: Map<string, string>,
  productMap: Map<string, string>,
  variationMap: Map<string, string>,
  _categoryMap: Map<string, string>
): {
  orders: Array<DbOrder & { id: string }>;
  items: Array<DbOrderItem & { id: string }>;
  payments: Array<DbPayment & { id: string }>;
} {
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
        // Normalize the Square variation name
        const { variation: normalizedVar } = extractVariation(catalogInfo.varName);
        const varName = normalizedVar || catalogInfo.varName;
        const variationKey = `${productId}:${varName.toLowerCase()}`;
        variationId = variationMap.get(variationKey);
      }

      const quantity = parseInt(lineItem.quantity, 10);
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
      raw_data: order, // Store original Square order for auditing
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
