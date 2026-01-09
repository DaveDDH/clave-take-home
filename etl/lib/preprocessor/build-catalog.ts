import { randomUUID } from 'crypto';
import {
  normalizeCategory,
  extractVariation,
  getNormalizedBaseName,
  normalizeVariationName,
} from '../normalizers.js';
import { levenshtein } from '../levenshtein.js';
import { matchProductToGroup } from '../product-groups.js';
import type { DbCategory, DbProduct, DbProductVariation } from '../types.js';
import type { SourceData, RawProductItem, ProductGroupResult, CatalogResult } from './types.js';

// Helper to pick the "best" canonical name (prefer properly capitalized, no typos)
function pickCanonicalName(names: string[]): string {
  return names.sort((a, b) => {
    const aProper = a[0] === a[0].toUpperCase();
    const bProper = b[0] === b[0].toUpperCase();
    if (aProper && !bProper) return -1;
    if (!aProper && bProper) return 1;
    return b.length - a.length;
  })[0];
}

function collectFromSquare(
  sources: SourceData,
  rawItems: RawProductItem[],
  rawCategories: Map<string, { squareId?: string; name: string }>
): void {
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
}

function collectFromToast(
  sources: SourceData,
  rawItems: RawProductItem[],
  rawCategories: Map<string, { squareId?: string; name: string }>
): void {
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
}

function collectFromDoorDash(
  sources: SourceData,
  rawItems: RawProductItem[],
  rawCategories: Map<string, { squareId?: string; name: string }>
): void {
  const seenDoorDashItems = new Set<string>();
  for (const order of sources.doordash.orders) {
    for (const item of order.order_items) {
      const normalizedKey = item.name.toLowerCase().trim();
      if (seenDoorDashItems.has(normalizedKey)) continue;
      seenDoorDashItems.add(normalizedKey);

      const { baseName, variation, variationType } = extractVariation(item.name);

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
}

function groupProducts(rawItems: RawProductItem[]): ProductGroupResult[] {
  const productGroups: ProductGroupResult[] = [];
  const configuredGroups = new Map<string, ProductGroupResult>();
  const SIMILARITY_THRESHOLD = 3;

  for (const item of rawItems) {
    const groupMatch = matchProductToGroup(item.originalName);

    if (groupMatch) {
      const groupKey = groupMatch.baseName.toLowerCase();

      if (configuredGroups.has(groupKey)) {
        const group = configuredGroups.get(groupKey)!;
        group.items.push(item);

        if (groupMatch.variationName) {
          item.extractedVariation = groupMatch.variationName;
          item.extractedVariationType = 'semantic';
        }

        if (!group.description && item.description) {
          group.description = item.description;
        }
        if (!group.categoryId) {
          if (item.categoryId) {
            group.categoryId = item.categoryId;
          } else if (item.categoryName) {
            group.categoryId = item.categoryName;
          }
        }
      } else {
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

    // Fallback: use Levenshtein grouping
    const normalizedBaseName = getNormalizedBaseName(item.originalName);

    let foundGroup = false;
    for (const group of productGroups) {
      if (configuredGroups.has(group.canonicalName.toLowerCase())) {
        continue;
      }

      const groupNormalizedBase = getNormalizedBaseName(group.canonicalName);
      const distance = levenshtein(normalizedBaseName, groupNormalizedBase, { maxDistance: SIMILARITY_THRESHOLD });

      if (distance <= SIMILARITY_THRESHOLD) {
        group.items.push(item);
        const allBaseNames = group.items.map(i => i.baseName);
        group.canonicalName = pickCanonicalName(allBaseNames);
        if (!group.description && item.description) {
          group.description = item.description;
        }
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

  return productGroups;
}

function buildProductsAndVariations(
  productGroups: ProductGroupResult[],
  categoryMap: Map<string, string>
): {
  products: Array<DbProduct & { id: string }>;
  product_variations: Array<DbProductVariation & { id: string }>;
  productMap: Map<string, string>;
  variationMap: Map<string, string>;
} {
  const products: Array<DbProduct & { id: string }> = [];
  const product_variations: Array<DbProductVariation & { id: string }> = [];
  const productMap = new Map<string, string>();
  const variationMap = new Map<string, string>();
  const seenVariations = new Set<string>();
  const variationNamesByProduct = new Map<string, Map<string, string>>();

  function getCanonicalVariationName(productId: string, variationName: string): string {
    if (!variationNamesByProduct.has(productId)) {
      variationNamesByProduct.set(productId, new Map());
    }
    const productVariations = variationNamesByProduct.get(productId)!;
    const normalizedLower = variationName.toLowerCase();

    if (productVariations.has(normalizedLower)) {
      return productVariations.get(normalizedLower)!;
    }

    for (const [existingLower, existingCanonical] of productVariations) {
      const distance = levenshtein(normalizedLower, existingLower, { maxDistance: 2 });
      if (distance <= 2) {
        const canonical = existingCanonical.length >= variationName.length ? existingCanonical : variationName;
        productVariations.set(normalizedLower, canonical);
        productVariations.set(existingLower, canonical);
        return canonical;
      }
    }

    productVariations.set(normalizedLower, variationName);
    return variationName;
  }

  for (const group of productGroups) {
    const productId = randomUUID();
    const categoryId = group.categoryId ? categoryMap.get(group.categoryId) : undefined;

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

    for (const item of group.items) {
      if (item.sourceId) {
        productMap.set(item.sourceId, productId);
      }
      productMap.set(item.originalName.toLowerCase(), productId);
      productMap.set(item.baseName.toLowerCase(), productId);

      if (item.extractedVariation) {
        const { normalized: normalizedName, variationType: normalizedType } =
          normalizeVariationName(item.extractedVariation);
        const finalType = normalizedType || item.extractedVariationType;
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

      if (item.squareVariations) {
        for (const sqVariation of item.squareVariations) {
          productMap.set(sqVariation.id, productId);

          if (sqVariation.name.toLowerCase() === 'regular') continue;

          const { variation: extractedVar, variationType } = extractVariation(sqVariation.name);
          const rawVarName = extractedVar || sqVariation.name;
          const { normalized: normalizedName, variationType: normalizedType } =
            normalizeVariationName(rawVarName);
          const finalType = normalizedType || variationType;
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

  return { products, product_variations, productMap, variationMap };
}

export function buildUnifiedCatalog(sources: SourceData): CatalogResult {
  const rawItems: RawProductItem[] = [];
  const rawCategories = new Map<string, { squareId?: string; name: string }>();

  // Collect from all sources
  collectFromSquare(sources, rawItems, rawCategories);
  collectFromToast(sources, rawItems, rawCategories);
  collectFromDoorDash(sources, rawItems, rawCategories);

  // Build categories
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

  // Group products
  const productGroups = groupProducts(rawItems);

  // Build products and variations
  const { products, product_variations, productMap, variationMap } =
    buildProductsAndVariations(productGroups, categoryMap);

  return { categories, products, product_variations, productMap, categoryMap, variationMap };
}
