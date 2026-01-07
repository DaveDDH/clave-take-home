import { levenshtein } from './levenshtein.js';
import { getVariationPatterns, getAbbreviationMap } from './variation-patterns.js';
import type { DbProduct } from './types.js';

/**
 * Result of extracting a variation from a product name
 */
export interface VariationExtractionResult {
  baseName: string;
  variation?: string;
  variationType?: 'quantity' | 'size' | 'serving' | 'strength';
}

/**
 * Size abbreviation map for normalizing variation names
 */
const SIZE_ABBREVIATIONS: Record<string, string> = {
  'lg': 'Large',
  'sm': 'Small',
  'med': 'Medium',
  'xl': 'XL',
  'xxl': 'XXL',
};

/**
 * Extract variation info from a product name.
 * e.g., "Churros 12pcs" → { baseName: "Churros", variation: "12 pcs", variationType: "quantity" }
 * e.g., "Fries - Large" → { baseName: "Fries", variation: "Large", variationType: "size" }
 * e.g., "Lg Coke" → { baseName: "Coke", variation: "Large", variationType: "size" }
 */
export function extractVariation(name: string): VariationExtractionResult {
  const trimmed = name.trim();
  const patterns = getVariationPatterns();

  for (const pattern of patterns) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      const baseName = trimmed.replace(pattern.regex, '').trim();
      return {
        baseName,
        variation: pattern.format(match),
        variationType: pattern.type,
      };
    }
  }

  return { baseName: trimmed };
}

/**
 * Normalize a variation name:
 * - Extract any embedded variation info (e.g., "Buffalo Wings 12pc" → "12 pcs")
 * - Normalize size abbreviations (lg → Large, sm → Small)
 * - Clean up formatting
 */
export function normalizeVariationName(variationName: string): {
  normalized: string;
  variationType?: 'quantity' | 'size' | 'serving' | 'strength';
} {
  if (!variationName) return { normalized: variationName };

  let name = variationName.trim();

  // Try to extract variation info from the name itself
  // e.g., "Buffalo Wings 12pc" → extract "12 pcs"
  const extracted = extractVariation(name);
  if (extracted.variation) {
    return {
      normalized: extracted.variation,
      variationType: extracted.variationType
    };
  }

  // Normalize standalone size abbreviations
  const lowerName = name.toLowerCase();
  if (SIZE_ABBREVIATIONS[lowerName]) {
    return { normalized: SIZE_ABBREVIATIONS[lowerName], variationType: 'size' };
  }

  // Clean up names like "- Large" → "Large"
  name = name.replace(/^[-–—]\s*/, '').trim();

  // Capitalize first letter of each word for consistency
  if (name && name === name.toLowerCase()) {
    name = name.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return { normalized: name };
}

/**
 * Expand abbreviations in a name for better Levenshtein matching.
 * e.g., "Coke" → "coca-cola"
 * e.g., "Fries" → "french fries"
 */
export function expandAbbreviation(name: string): string {
  const lower = name.toLowerCase().trim();
  const abbreviationMap = getAbbreviationMap();

  // Check for exact match in abbreviation map
  if (abbreviationMap[lower]) {
    return abbreviationMap[lower];
  }

  return lower;
}

/**
 * Get the normalized base name for Levenshtein comparison.
 * Applies abbreviation expansion after extracting variation.
 */
export function getNormalizedBaseName(name: string): string {
  const { baseName } = extractVariation(name);
  return expandAbbreviation(baseName);
}

/**
 * Strip emojis and normalize category names
 * "🍔 Burgers" → "Burgers"
 * "🍟 Sides & Appetizers" → "Sides & Appetizers"
 */
export function normalizeCategory(raw: string): string {
  return raw
    // Remove emojis (covers most emoji ranges)
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalize product name for comparison
 * Strips extra whitespace, lowercases
 */
export function normalizeProductName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Find the best matching canonical product for a raw name
 * Uses variation extraction and abbreviation expansion for better matching
 * Returns null if no match within threshold
 */
export function findCanonicalProduct(
  rawName: string,
  products: Array<DbProduct & { id: string }>,
  threshold: number = 3
): (DbProduct & { id: string }) | null {
  // Extract base name (without variation) and expand abbreviations
  const normalizedBaseName = getNormalizedBaseName(rawName);

  // Exact match first (using normalized base name)
  const exact = products.find(p =>
    getNormalizedBaseName(p.name) === normalizedBaseName
  );
  if (exact) return exact;

  // Fuzzy match with Levenshtein on normalized base names
  let bestMatch: (DbProduct & { id: string }) | null = null;
  let bestDistance = Infinity;

  for (const product of products) {
    const productNormalizedBase = getNormalizedBaseName(product.name);
    const dist = levenshtein(normalizedBaseName, productNormalizedBase, {
      maxDistance: threshold
    });

    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = product;
    }
  }

  // Also try ratio-based threshold for longer names
  // For names > 10 chars, allow distance up to 20% of length
  if (bestMatch && bestDistance <= threshold) {
    return bestMatch;
  }

  const maxRatioDist = Math.floor(normalizedBaseName.length * 0.25);
  if (bestMatch && bestDistance <= maxRatioDist && bestDistance <= 5) {
    return bestMatch;
  }

  return null;
}

/**
 * Map Toast dining option behavior to normalized order type
 */
export function mapToastOrderType(behavior: string): string {
  switch (behavior) {
    case 'DINE_IN':
      return 'dine_in';
    case 'TAKE_OUT':
      return 'takeout';
    case 'DELIVERY':
      return 'delivery';
    default:
      return behavior.toLowerCase();
  }
}

/**
 * Map Toast source to channel
 */
export function mapToastChannel(source: string): string {
  switch (source) {
    case 'POS':
      return 'pos';
    case 'ONLINE':
      return 'online';
    case 'THIRD_PARTY':
      return 'third_party';
    default:
      return source.toLowerCase();
  }
}

/**
 * Map DoorDash fulfillment method to order type
 */
export function mapDoorDashOrderType(method: string): string {
  switch (method) {
    case 'MERCHANT_DELIVERY':
      return 'delivery';
    case 'PICKUP':
      return 'pickup';
    default:
      return method.toLowerCase();
  }
}

/**
 * Map Square fulfillment type to order type
 */
export function mapSquareOrderType(type: string): string {
  switch (type) {
    case 'DINE_IN':
      return 'dine_in';
    case 'PICKUP':
      return 'pickup';
    case 'DELIVERY':
      return 'delivery';
    default:
      return type.toLowerCase();
  }
}

/**
 * Map Square source to channel
 */
export function mapSquareChannel(sourceName: string): string {
  if (sourceName.toLowerCase().includes('online')) {
    return 'online';
  }
  return 'pos';
}

/**
 * Normalize payment type
 */
export function normalizePaymentType(type: string): string {
  const upper = type.toUpperCase();
  if (upper === 'CREDIT' || upper === 'CARD') return 'credit';
  if (upper === 'CASH') return 'cash';
  if (upper === 'WALLET') return 'wallet';
  if (upper === 'OTHER') return 'other';
  return type.toLowerCase();
}

/**
 * Normalize card brand
 */
export function normalizeCardBrand(brand?: string | null): string | undefined {
  if (!brand) return undefined;
  const upper = brand.toUpperCase();
  if (upper === 'VISA') return 'visa';
  if (upper === 'MASTERCARD') return 'mastercard';
  if (upper === 'AMEX' || upper === 'AMERICAN_EXPRESS') return 'amex';
  if (upper === 'DISCOVER') return 'discover';
  if (upper === 'APPLE_PAY') return 'apple_pay';
  if (upper === 'GOOGLE_PAY') return 'google_pay';
  return brand.toLowerCase();
}
