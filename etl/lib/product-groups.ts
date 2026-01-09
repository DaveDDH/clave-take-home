/**
 * Loads product groups from a configurable JSON file.
 * Groups are used for combining similar products into base product + variations.
 */

import { readFileSync } from 'node:fs';
import { ProductGroupsConfigSchema, type ProductGroupsConfig, type ProductGroup } from './schemas/index.js';
import { levenshtein } from './levenshtein.js';

// Dynamic threshold based on word length to prevent false matches on short words
// Short words (<=5 chars): max distance 1 (catches "Wngs" -> "Wings")
// Longer words (>5 chars): max distance 2 (catches "Sandwhich" -> "Sandwich")
function getSimilarityThreshold(wordLength: number): number {
  return wordLength <= 5 ? 1 : 2;
}

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
      const suffixPattern = new RegExp(String.raw`\b${escapeRegex(group.suffix)}\b`, 'i');
      if (suffixPattern.test(nameLower)) {
        // Extract variation: everything before the suffix
        const variation = extractVariationFromSuffix(productName, group.suffix);
        return {
          group,
          baseName: group.baseName,
          variationName: variation,
        };
      }

      // Fuzzy suffix match for single-word suffixes
      // This catches typos like "Wngs" → "Wings", "Piza" → "Pizza"
      // Uses length-based threshold to prevent false matches on short words
      if (!group.suffix.includes(' ')) {
        const nameWords = nameLower.split(/\s+/);
        for (const word of nameWords) {
          const threshold = getSimilarityThreshold(Math.min(word.length, group.suffix.length));
          const distance = levenshtein(word, group.suffix);

          if (distance <= threshold && distance > 0) {
            // Additional check: reject same-length words with small distance for SHORT words
            // Short words have more "minimal pairs" (different words that differ by 1 char)
            // e.g., "rings" vs "wings" (both 5 chars, distance 1) = different words
            // e.g., "wngs" vs "wings" (4 vs 5 chars, distance 1) = likely typo
            // But for longer words (>6 chars), typos are more common:
            // e.g., "expresso" vs "espresso" (both 8 chars, distance 1) = typo
            const shorterLength = Math.min(word.length, group.suffix.length);
            if (word.length === group.suffix.length && shorterLength <= 6) {
              continue; // Skip - same length short word suggests different word, not typo
            }

            // Extract variation by removing the fuzzy-matched word
            const variation = extractVariationFromFuzzyMatch(productName, word);
            return {
              group,
              baseName: group.baseName,
              variationName: variation,
            };
          }
        }
      }
    }

    // Check keyword match
    if (group.keywords) {
      for (const keyword of group.keywords) {
        // Exact or substring match
        if (nameLower === keyword || nameLower.includes(keyword)) {
          const variation = nameLower === group.baseName.toLowerCase()
            ? null
            : productName.trim();
          return {
            group,
            baseName: group.baseName,
            variationName: variation,
          };
        }

        // Fuzzy match using Levenshtein for single-word keywords
        // This catches typos like "expresso" → "espresso", "coffe" → "coffee"
        // Uses length-based threshold to prevent false matches on short words
        if (!keyword.includes(' ')) {
          const nameWords = nameLower.split(/\s+/);
          for (const word of nameWords) {
            const threshold = getSimilarityThreshold(Math.min(word.length, keyword.length));
            const distance = levenshtein(word, keyword);

            if (distance <= threshold && distance > 0) {
              // Additional check: reject same-length words with small distance for SHORT words
              // But allow for longer words where typos are more common
              const shorterLength = Math.min(word.length, keyword.length);
              if (word.length === keyword.length && shorterLength <= 6) {
                continue; // Skip - same length short word suggests different word, not typo
              }

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
  const suffixPattern = new RegExp(String.raw`\s*\b${escapeRegex(suffix)}\b\s*$`, 'i');
  const variation = productName.replace(suffixPattern, '').trim();

  // If nothing left after removing suffix, it's the base product
  if (!variation || variation.toLowerCase() === suffix.toLowerCase()) {
    return null;
  }

  return variation;
}

/**
 * Extract variation name by removing a fuzzy-matched word from the product name.
 * E.g., "Buffalo Wngs" with matched word "wngs" → "Buffalo"
 */
function extractVariationFromFuzzyMatch(productName: string, matchedWord: string): string | null {
  // Remove the matched word (case-insensitive)
  const wordPattern = new RegExp(String.raw`\s*\b${escapeRegex(matchedWord)}\b\s*`, 'i');
  const variation = productName.replace(wordPattern, ' ').trim();

  // If nothing left, it's the base product
  if (!variation) {
    return null;
  }

  return variation;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
