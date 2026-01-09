#!/usr/bin/env node
/**
 * Debug script to trace the product-group matching logic.
 * Shows WHY each raw item name gets matched to a specific product.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load product groups config
const productGroupsPath = resolve(__dirname, '../data/product_groups.json');
const productGroups = JSON.parse(readFileSync(productGroupsPath, 'utf-8'));

// Levenshtein implementation (same as in the ETL)
function levenshtein(a, b, options = {}) {
  const maxDistance = options.maxDistance || Infinity;

  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Dynamic threshold based on word length (same as product-groups.ts)
function getSimilarityThreshold(wordLength) {
  return wordLength <= 5 ? 1 : 2;
}

function escapeRegex(str) {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Simulate matchProductToGroup logic
function matchProductToGroup(productName, verbose = false) {
  const nameLower = productName.toLowerCase().trim();
  const logs = [];

  for (const group of productGroups.groups) {
    const suffix = group.suffix?.toLowerCase();
    const keywords = group.keywords?.map(k => k.toLowerCase());
    const baseName = group.base_name;

    // Check suffix match
    if (suffix) {
      const suffixPattern = new RegExp(`\\b${escapeRegex(suffix)}\\b`, 'i');
      if (suffixPattern.test(nameLower)) {
        logs.push(`  MATCH (suffix exact): "${productName}" contains word "${suffix}" -> ${baseName}`);
        return { match: baseName, reason: `suffix exact match: "${suffix}"`, logs };
      }

      // Fuzzy suffix match
      if (!suffix.includes(' ')) {
        const nameWords = nameLower.split(/\s+/);
        for (const word of nameWords) {
          const distance = levenshtein(word, suffix);
          const threshold = getSimilarityThreshold(Math.min(word.length, suffix.length));
          if (distance <= threshold) {
            logs.push(`  MATCH (suffix fuzzy): word "${word}" ~ "${suffix}" (distance=${distance}, threshold=${threshold}) -> ${baseName}`);
            return { match: baseName, reason: `suffix fuzzy match: "${word}" ~ "${suffix}" (distance=${distance}, threshold=${threshold})`, logs };
          }
        }
      }
    }

    // Check keyword match
    if (keywords) {
      for (const keyword of keywords) {
        // Exact or substring match
        if (nameLower === keyword || nameLower.includes(keyword)) {
          logs.push(`  MATCH (keyword exact): "${productName}" contains "${keyword}" -> ${baseName}`);
          return { match: baseName, reason: `keyword exact match: "${keyword}"`, logs };
        }

        // Fuzzy match for single-word keywords
        if (!keyword.includes(' ')) {
          const nameWords = nameLower.split(/\s+/);
          for (const word of nameWords) {
            const distance = levenshtein(word, keyword);
            const threshold = getSimilarityThreshold(Math.min(word.length, keyword.length));
            if (distance <= threshold) {
              logs.push(`  MATCH (keyword fuzzy): word "${word}" ~ "${keyword}" (distance=${distance}, threshold=${threshold}) -> ${baseName}`);
              return { match: baseName, reason: `keyword fuzzy match: "${word}" ~ "${keyword}" (distance=${distance}, threshold=${threshold})`, logs };
            }
          }
        }
      }
    }
  }

  return { match: null, reason: 'no match', logs };
}

// Test problematic items
const problematicItems = [
  // Wine items getting matched to Wings
  'House Red Wine',
  'House Red Wine - Glass',
  'House Red Wine - Bottle',
  'House Wine',

  // Fruit items getting matched to Fries
  'Fresh Fruit',
  'Fresh Fruit Cup',

  // Items getting matched to Steak
  'Iced Tea',
  'Pancake Stack',
  'Pickle Spear',
  'Philly Cheesesteak',
  'Ribeye Steak',
  'Filet Mignon',
  'Prime Rib',

  // Items getting matched to Nachos
  'Fish Tacos',
  'Nachos Grande',

  // Items getting matched to Wrap
  'Crab Cakes',
  'Buffalo Chicken Wrap',

  // Onion Rings -> Wings
  'Onion Rings',

  // Correct matches for comparison
  'Buffalo Wings',
  'French Fries',
  'Caesar Salad',
  'Margherita Pizza',
];

console.log('\n=== MATCHING TRACE FOR PROBLEMATIC ITEMS ===\n');

for (const item of problematicItems) {
  const result = matchProductToGroup(item, true);
  console.log(`"${item}"`);
  console.log(`  -> Matched to: ${result.match || 'NONE'}`);
  console.log(`  -> Reason: ${result.reason}`);
  console.log('');
}

// Show Levenshtein distances for key comparisons
console.log('\n=== LEVENSHTEIN DISTANCE ANALYSIS ===\n');

const comparisons = [
  ['wine', 'wings'],
  ['fruit', 'fries'],
  ['rings', 'wings'],
  ['tea', 'steak'],
  ['stack', 'steak'],
  ['spear', 'steak'],
  ['tacos', 'nachos'],
  ['cakes', 'wrap'],
  // Correct matches
  ['wings', 'wings'],
  ['fries', 'fries'],
  ['salad', 'salad'],
  ['pizza', 'pizza'],
];

console.log('| Word 1     | Word 2     | Distance | Threshold | Would Match? |');
console.log('|------------|------------|----------|-----------|--------------|');

for (const [w1, w2] of comparisons) {
  const dist = levenshtein(w1, w2);
  const threshold = getSimilarityThreshold(Math.min(w1.length, w2.length));
  const wouldMatch = dist <= threshold ? 'YES' : 'NO';
  console.log(`| ${w1.padEnd(10)} | ${w2.padEnd(10)} | ${String(dist).padEnd(8)} | ${String(threshold).padEnd(9)} | ${wouldMatch.padEnd(12)} |`);
}

console.log('\n=== ROOT CAUSE ANALYSIS ===\n');
console.log('The SIMILARITY_THRESHOLD is set to 2, which causes false matches:');
console.log('');
console.log('1. "Wine" matches "Wings" suffix (distance=2)');
console.log('   - "House Red Wine" -> Wings (because "Wine" ~ "Wings")');
console.log('   - "House Wine" -> Wings');
console.log('');
console.log('2. "Fruit" matches "Fries" suffix (distance=2)');
console.log('   - "Fresh Fruit" -> Fries (because "Fruit" ~ "Fries")');
console.log('');
console.log('3. "Rings" matches "Wings" suffix (distance=2)');
console.log('   - "Onion Rings" -> Wings (because "Rings" ~ "Wings")');
console.log('');
console.log('4. Steak keywords match unrelated items:');
console.log('   - "Iced Tea" contains "tea" which fuzzy-matches "steak" keywords');
console.log('   - "Pancake Stack" contains "stack" which fuzzy-matches "steak"');
console.log('');
console.log('5. Wrap/Nachos suffix issues:');
console.log('   - "Crab Cakes" -> the word "Cakes" might be fuzzy-matching');
console.log('   - "Fish Tacos" -> "Tacos" fuzzy-matches "Nachos" (distance=2)');
console.log('');
