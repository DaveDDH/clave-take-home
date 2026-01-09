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

interface MatchResult {
  group: CompiledProductGroup;
  baseName: string;
  variationName: string | null;
}

function isFuzzyMatchValidForTypo(word: string, target: string, distance: number): boolean {
  if (distance === 0) return false;
  // Reject same-length words with small distance for SHORT words (<=6 chars)
  // Short words have more "minimal pairs" (different words that differ by 1 char)
  const shorterLength = Math.min(word.length, target.length);
  if (word.length === target.length && shorterLength <= 6) {
    return false;
  }
  return true;
}

function tryExactSuffixMatch(
  nameLower: string,
  productName: string,
  group: CompiledProductGroup
): MatchResult | null {
  if (!group.suffix) return null;

  const suffixPattern = new RegExp(String.raw`\b${escapeRegex(group.suffix)}\b`, 'i');
  if (!suffixPattern.test(nameLower)) return null;

  return {
    group,
    baseName: group.baseName,
    variationName: extractVariationFromSuffix(productName, group.suffix),
  };
}

function tryFuzzySuffixMatch(
  nameLower: string,
  productName: string,
  group: CompiledProductGroup
): MatchResult | null {
  if (!group.suffix || group.suffix.includes(' ')) return null;

  const nameWords = nameLower.split(/\s+/);
  for (const word of nameWords) {
    const threshold = getSimilarityThreshold(Math.min(word.length, group.suffix.length));
    const distance = levenshtein(word, group.suffix);

    if (distance <= threshold && isFuzzyMatchValidForTypo(word, group.suffix, distance)) {
      return {
        group,
        baseName: group.baseName,
        variationName: extractVariationFromFuzzyMatch(productName, word),
      };
    }
  }
  return null;
}

function tryExactKeywordMatch(
  nameLower: string,
  productName: string,
  group: CompiledProductGroup,
  keyword: string
): MatchResult | null {
  if (nameLower !== keyword && !nameLower.includes(keyword)) return null;

  return {
    group,
    baseName: group.baseName,
    variationName: nameLower === group.baseName.toLowerCase() ? null : productName.trim(),
  };
}

function tryFuzzyKeywordMatch(
  nameLower: string,
  productName: string,
  group: CompiledProductGroup,
  keyword: string
): MatchResult | null {
  if (keyword.includes(' ')) return null;

  const nameWords = nameLower.split(/\s+/);
  for (const word of nameWords) {
    const threshold = getSimilarityThreshold(Math.min(word.length, keyword.length));
    const distance = levenshtein(word, keyword);

    if (distance <= threshold && isFuzzyMatchValidForTypo(word, keyword, distance)) {
      return {
        group,
        baseName: group.baseName,
        variationName: nameLower === group.baseName.toLowerCase() ? null : productName.trim(),
      };
    }
  }
  return null;
}

function tryKeywordMatch(
  nameLower: string,
  productName: string,
  group: CompiledProductGroup
): MatchResult | null {
  if (!group.keywords) return null;

  for (const keyword of group.keywords) {
    const exactMatch = tryExactKeywordMatch(nameLower, productName, group, keyword);
    if (exactMatch) return exactMatch;

    const fuzzyMatch = tryFuzzyKeywordMatch(nameLower, productName, group, keyword);
    if (fuzzyMatch) return fuzzyMatch;
  }
  return null;
}

function matchGroupToProduct(
  nameLower: string,
  productName: string,
  group: CompiledProductGroup
): MatchResult | null {
  // Try suffix matches first
  const exactSuffix = tryExactSuffixMatch(nameLower, productName, group);
  if (exactSuffix) return exactSuffix;

  const fuzzySuffix = tryFuzzySuffixMatch(nameLower, productName, group);
  if (fuzzySuffix) return fuzzySuffix;

  // Try keyword matches
  return tryKeywordMatch(nameLower, productName, group);
}

/**
 * Match a product name to a group.
 * Returns the group and extracted variation name, or null if no match.
 */
export function matchProductToGroup(productName: string): MatchResult | null {
  if (!cachedGroups) {
    throw new Error('Product groups not initialized. Call initializeProductGroups() first.');
  }

  const nameLower = productName.toLowerCase().trim();

  for (const group of cachedGroups) {
    const match = matchGroupToProduct(nameLower, productName, group);
    if (match) return match;
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
