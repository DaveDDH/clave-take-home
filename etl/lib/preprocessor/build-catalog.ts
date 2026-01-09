import { randomUUID } from 'node:crypto';
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
function isProperCase(str: string): boolean {
  if (str.length === 0) return false;
  const firstChar = str[0];
  return firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
}

function pickCanonicalName(names: string[]): string {
  const sorted = [...names].sort((a: string, b: string) => {
    const aProper = isProperCase(a);
    const bProper = isProperCase(b);
    if (aProper && !bProper) return -1;
    if (!aProper && bProper) return 1;
    return b.length - a.length;
  });
  return sorted[0];
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

// Helper to get all valid selections from Toast orders
function getValidToastSelections(sources: SourceData) {
  return sources.toast.orders
    .filter(order => !order.voided && !order.deleted)
    .flatMap(order => order.checks)
    .filter(check => !check.voided && !check.deleted)
    .flatMap(check => check.selections)
    .filter(selection => !selection.voided);
}

function collectFromToast(
  sources: SourceData,
  rawItems: RawProductItem[],
  rawCategories: Map<string, { squareId?: string; name: string }>
): void {
  const seenToastItems = new Set<string>();
  const selections = getValidToastSelections(sources);

  for (const selection of selections) {
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

// Helper: Update group's optional fields from item
function updateGroupFromItem(group: ProductGroupResult, item: RawProductItem): void {
  if (!group.description && item.description) {
    group.description = item.description;
  }
  if (!group.categoryId) {
    group.categoryId = item.categoryId || item.categoryName;
  }
}

// Helper: Apply variation from group match to item
function applyVariationFromMatch(item: RawProductItem, variationName: string | null | undefined): void {
  if (variationName) {
    item.extractedVariation = variationName;
    item.extractedVariationType = 'semantic';
  }
}

// Helper: Find a group matching by Levenshtein distance
function findSimilarGroup(
  normalizedBaseName: string,
  productGroups: ProductGroupResult[],
  configuredGroups: Map<string, ProductGroupResult>,
  threshold: number
): ProductGroupResult | undefined {
  for (const group of productGroups) {
    if (configuredGroups.has(group.canonicalName.toLowerCase())) continue;

    const groupNormalizedBase = getNormalizedBaseName(group.canonicalName);
    const distance = levenshtein(normalizedBaseName, groupNormalizedBase, { maxDistance: threshold });

    if (distance <= threshold) return group;
  }
  return undefined;
}

function groupProducts(rawItems: RawProductItem[]): ProductGroupResult[] {
  const productGroups: ProductGroupResult[] = [];
  const configuredGroups = new Map<string, ProductGroupResult>();
  const SIMILARITY_THRESHOLD = 3;

  for (const item of rawItems) {
    const groupMatch = matchProductToGroup(item.originalName);

    if (groupMatch) {
      const groupKey = groupMatch.baseName.toLowerCase();
      applyVariationFromMatch(item, groupMatch.variationName);

      if (configuredGroups.has(groupKey)) {
        const group = configuredGroups.get(groupKey)!;
        group.items.push(item);
        updateGroupFromItem(group, item);
      } else {
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
    const similarGroup = findSimilarGroup(normalizedBaseName, productGroups, configuredGroups, SIMILARITY_THRESHOLD);

    if (similarGroup) {
      similarGroup.items.push(item);
      similarGroup.canonicalName = pickCanonicalName(similarGroup.items.map(i => i.baseName));
      updateGroupFromItem(similarGroup, item);
    } else {
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

// Context for building products and variations
interface BuildContext {
  productMap: Map<string, string>;
  variationMap: Map<string, string>;
  seenVariations: Set<string>;
  variationNamesByProduct: Map<string, Map<string, string>>;
  product_variations: Array<DbProductVariation & { id: string }>;
}

// Helper: Get canonical variation name with fuzzy matching
function getCanonicalVariationName(ctx: BuildContext, productId: string, variationName: string): string {
  if (!ctx.variationNamesByProduct.has(productId)) {
    ctx.variationNamesByProduct.set(productId, new Map());
  }
  const productVariations = ctx.variationNamesByProduct.get(productId)!;
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

type VariationType = 'quantity' | 'size' | 'serving' | 'strength' | 'semantic';

// Helper: Add a variation if not already seen
function addVariationIfNew(
  ctx: BuildContext,
  productId: string,
  canonicalName: string,
  finalType: VariationType | undefined,
  sourceRawName: string,
  rawData: Record<string, unknown>
): void {
  const variationKey = `${productId}:${canonicalName.toLowerCase()}`;
  if (ctx.seenVariations.has(variationKey)) return;

  ctx.seenVariations.add(variationKey);
  const variationId = randomUUID();
  ctx.product_variations.push({
    id: variationId,
    product_id: productId,
    name: canonicalName,
    variation_type: finalType,
    source_raw_name: sourceRawName,
    raw_data: rawData,
  });
  ctx.variationMap.set(variationKey, variationId);
}

// Helper: Process extracted variation from item
function processExtractedVariation(ctx: BuildContext, productId: string, item: RawProductItem): void {
  if (!item.extractedVariation) return;

  const { normalized: normalizedName, variationType: normalizedType } = normalizeVariationName(item.extractedVariation);
  const finalType = normalizedType || item.extractedVariationType;
  const canonicalName = getCanonicalVariationName(ctx, productId, normalizedName);

  addVariationIfNew(ctx, productId, canonicalName, finalType, item.originalName, {
    source: item.source, sourceId: item.sourceId, originalName: item.originalName, extractedVariation: item.extractedVariation,
  });
}

// Helper: Process Square variations from item
function processSquareVariations(ctx: BuildContext, productId: string, item: RawProductItem): void {
  if (!item.squareVariations) return;

  for (const sqVariation of item.squareVariations) {
    ctx.productMap.set(sqVariation.id, productId);
    if (sqVariation.name.toLowerCase() === 'regular') continue;

    const { variation: extractedVar, variationType } = extractVariation(sqVariation.name);
    const rawVarName = extractedVar || sqVariation.name;
    const { normalized: normalizedName, variationType: normalizedType } = normalizeVariationName(rawVarName);
    const finalType = normalizedType || variationType;
    const canonicalName = getCanonicalVariationName(ctx, productId, normalizedName);

    addVariationIfNew(ctx, productId, canonicalName, finalType, `${item.originalName} - ${sqVariation.name}`, {
      source: 'square', squareVariationId: sqVariation.id, squareVariationName: sqVariation.name, parentItemName: item.originalName,
    });
  }
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
  const ctx: BuildContext = {
    productMap: new Map(),
    variationMap: new Map(),
    seenVariations: new Set(),
    variationNamesByProduct: new Map(),
    product_variations: [],
  };

  for (const group of productGroups) {
    const productId = randomUUID();
    const categoryId = group.categoryId ? categoryMap.get(group.categoryId) : undefined;

    products.push({
      id: productId,
      name: group.canonicalName,
      category_id: categoryId,
      description: group.description,
      raw_data: { items: group.items.map(i => ({ source: i.source, sourceId: i.sourceId, originalName: i.originalName })) },
    });

    for (const item of group.items) {
      if (item.sourceId) ctx.productMap.set(item.sourceId, productId);
      ctx.productMap.set(item.originalName.toLowerCase(), productId);
      ctx.productMap.set(item.baseName.toLowerCase(), productId);

      processExtractedVariation(ctx, productId, item);
      processSquareVariations(ctx, productId, item);
    }
  }

  return { products, product_variations: ctx.product_variations, productMap: ctx.productMap, variationMap: ctx.variationMap };
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
