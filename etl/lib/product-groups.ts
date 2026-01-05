/**
 * Loads product groups from a configurable JSON file.
 * Groups are used for combining similar products into base product + variations.
 */

import { readFileSync } from 'fs';
import { ProductGroupsConfigSchema, type ProductGroupsConfig, type ProductGroup } from './schemas.js';

export interface CompiledProductGroup {
  suffix?: string;
  keywords?: string[];
  baseName: string;
}

// Cached compiled groups
let cachedGroups: CompiledProductGroup[] | null = null;

/**
 * Load and validate product groups from JSON file
 */
export function loadProductGroups(filePath: string): ProductGroupsConfig {
  const rawData = readFileSync(filePath, 'utf-8');
  const jsonData = JSON.parse(rawData);

  const result = ProductGroupsConfigSchema.safeParse(jsonData);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${String(e.path.join('.'))}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid product groups config:\n${errors}`);
  }

  return result.data;
}

/**
 * Compile a group from config into a usable format
 */
function compileGroup(group: ProductGroup): CompiledProductGroup {
  return {
    suffix: group.suffix?.toLowerCase(),
    keywords: group.keywords?.map(k => k.toLowerCase()),
    baseName: group.base_name,
  };
}

/**
 * Initialize product groups from the config file
 */
export function initializeProductGroups(filePath: string): void {
  const config = loadProductGroups(filePath);
  cachedGroups = config.groups.map(compileGroup);
}

/**
 * Get compiled product groups (must call initializeProductGroups first)
 */
export function getProductGroups(): CompiledProductGroup[] {
  if (!cachedGroups) {
    throw new Error('Product groups not initialized. Call initializeProductGroups() first.');
  }
  return cachedGroups;
}

/**
 * Match a product name to a group.
 * Returns the group and extracted variation name, or null if no match.
 */
export function matchProductToGroup(productName: string): {
  group: CompiledProductGroup;
  baseName: string;
  variationName: string | null;
} | null {
  if (!cachedGroups) {
    throw new Error('Product groups not initialized. Call initializeProductGroups() first.');
  }

  const nameLower = productName.toLowerCase().trim();

  for (const group of cachedGroups) {
    // Check suffix match (product contains the suffix word)
    if (group.suffix) {
      const suffixPattern = new RegExp(`\\b${escapeRegex(group.suffix)}\\b`, 'i');
      if (suffixPattern.test(nameLower)) {
        // Extract variation: everything before the suffix
        const variation = extractVariationFromSuffix(productName, group.suffix);
        return {
          group,
          baseName: group.baseName,
          variationName: variation,
        };
      }
    }

    // Check keyword match
    if (group.keywords) {
      for (const keyword of group.keywords) {
        if (nameLower === keyword || nameLower.includes(keyword)) {
          // For keyword matches, the whole name becomes the variation
          // unless it exactly matches the base name
          const variation = nameLower === group.baseName.toLowerCase()
            ? null
            : productName.trim();
          return {
            group,
            baseName: group.baseName,
            variationName: variation,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Extract variation name from a product name given the suffix.
 * E.g., "Buffalo Wings" with suffix "Wings" → "Buffalo"
 *       "Wings" with suffix "Wings" → null (it IS the base)
 */
function extractVariationFromSuffix(productName: string, suffix: string): string | null {
  const suffixPattern = new RegExp(`\\s*\\b${escapeRegex(suffix)}\\b\\s*$`, 'i');
  const variation = productName.replace(suffixPattern, '').trim();

  // If nothing left after removing suffix, it's the base product
  if (!variation || variation.toLowerCase() === suffix.toLowerCase()) {
    return null;
  }

  return variation;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
