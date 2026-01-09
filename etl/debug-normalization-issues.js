#!/usr/bin/env node
/**
 * Debug script to understand why certain normalization issues occur.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load configs
const productGroupsPath = resolve(__dirname, '../data/product_groups.json');
const productGroups = JSON.parse(readFileSync(productGroupsPath, 'utf-8'));

const variationPatternsPath = resolve(__dirname, '../data/variation_patterns.json');
const variationPatterns = JSON.parse(readFileSync(variationPatternsPath, 'utf-8'));

// Load preprocessed data
const preprocessedPath = resolve(__dirname, 'preprocessed_data.json');
const data = JSON.parse(readFileSync(preprocessedPath, 'utf-8'));

// Levenshtein implementation
function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

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

function getSimilarityThreshold(wordLength) {
  return wordLength <= 5 ? 1 : 2;
}

console.log('='.repeat(70));
console.log('ISSUE 1: Why is "expresso" a separate product instead of Coffee?');
console.log('='.repeat(70));

const coffeeGroup = productGroups.groups.find(g => g.base_name === 'Coffee');
console.log('\nCoffee group config:');
console.log(JSON.stringify(coffeeGroup, null, 2));

const testExpresso = 'expresso - dbl shot';
console.log(`\nTesting: "${testExpresso}"`);
console.log('\nKeyword matching analysis:');
for (const keyword of coffeeGroup.keywords || []) {
  const nameLower = testExpresso.toLowerCase();
  const exactMatch = nameLower === keyword || nameLower.includes(keyword);
  console.log(`  - keyword "${keyword}": exact/substring match = ${exactMatch}`);

  if (!keyword.includes(' ')) {
    const words = nameLower.split(/\s+/);
    for (const word of words) {
      const cleanWord = word.replaceAll(/[^a-z]/g, '');
      const distance = levenshtein(cleanWord, keyword);
      const threshold = getSimilarityThreshold(Math.min(cleanWord.length, keyword.length));
      const sameLength = cleanWord.length === keyword.length;
      console.log(`    word "${cleanWord}" vs "${keyword}": distance=${distance}, threshold=${threshold}, sameLength=${sameLength}`);
      if (distance <= threshold && distance > 0 && sameLength) {
        console.log(`      -> REJECTED: same length, likely different word`);
      } else if (distance <= threshold) {
        console.log(`      -> Would match!`);
      }
    }
  }
}

console.log('\n' + '='.repeat(70));
console.log('ISSUE 2: Why does Wings have duplicate variations?');
console.log('='.repeat(70));

const wingsProduct = data.normalized.products.find(p => p.name === 'Wings');
const wingsVariations = data.normalized.product_variations.filter(v => v.product_id === wingsProduct?.id);
console.log('\nWings variations:');
for (const v of wingsVariations) {
  console.log(`  - "${v.name}" from "${v.source_raw_name}" (type: ${v.variation_type})`);
}

console.log('\nAnalysis:');
console.log('  "12 pcs" - extracted via quantity pattern from "Buffalo Wings - 12 piece"');
console.log('  "Buffalo Wings 12pc" - the full name became a variation (no pattern matched)');
console.log('  "Wings 12pc" - the full name became a variation (no pattern matched)');
console.log('\n  Root cause: "12pc" without space is not matching the quantity pattern');

// Test variation patterns
console.log('\nTesting variation patterns on "Buffalo Wings 12pc":');
for (const pattern of variationPatterns.patterns) {
  const regex = new RegExp(pattern.regex, pattern.flags || '');
  const match = 'Buffalo Wings 12pc'.match(regex);
  console.log(`  Pattern "${pattern.name}" (${pattern.regex}): ${match ? 'MATCH' : 'no match'}`);
}

console.log('\nTesting variation patterns on "Buffalo Wings - 12 piece":');
for (const pattern of variationPatterns.patterns) {
  const regex = new RegExp(pattern.regex, pattern.flags || '');
  const match = 'Buffalo Wings - 12 piece'.match(regex);
  console.log(`  Pattern "${pattern.name}" (${pattern.regex}): ${match ? 'MATCH' : 'no match'}`);
}

console.log('\n' + '='.repeat(70));
console.log('ISSUE 3: Why does Fries have "Large" and "Fries - Large"?');
console.log('='.repeat(70));

const friesProduct = data.normalized.products.find(p => p.name === 'Fries');
const friesVariations = data.normalized.product_variations.filter(v => v.product_id === friesProduct?.id);
console.log('\nFries variations:');
for (const v of friesVariations) {
  console.log(`  - "${v.name}" from "${v.source_raw_name}" (type: ${v.variation_type})`);
}

console.log('\nAnalysis:');
console.log('  "Large" - extracted from "French Fries - Large" via size pattern');
console.log('  "Fries - Large" - the raw name "Fries - Large" matched suffix "Fries"');
console.log('      and the remaining text "- Large" became the variation name');
console.log('\n  Root cause: variation extraction happens AFTER group matching,');
console.log('              so "Fries - Large" gives variation "- Large" → cleaned to "Fries - Large"?');

// Test the extraction logic
const testName = 'Fries - Large';
console.log(`\nTesting extractVariation on "${testName}":`);
for (const pattern of variationPatterns.patterns) {
  const regex = new RegExp(pattern.regex, pattern.flags || '');
  const match = testName.match(regex);
  if (match) {
    const baseName = testName.replace(regex, '').trim();
    console.log(`  Pattern "${pattern.name}": MATCH`);
    console.log(`    baseName = "${baseName}"`);
    console.log(`    variation = match groups: ${JSON.stringify(match.slice(1))}`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('ISSUE 4: Why does Soft Drink have "Large", "lg", "Lg Coke"?');
console.log('='.repeat(70));

const softDrinkProduct = data.normalized.products.find(p => p.name === 'Soft Drink');
const softDrinkVariations = data.normalized.product_variations.filter(v => v.product_id === softDrinkProduct?.id);
console.log('\nSoft Drink variations:');
for (const v of softDrinkVariations) {
  console.log(`  - "${v.name}" from "${v.source_raw_name}" (type: ${v.variation_type})`);
}

console.log('\nAnalysis:');
console.log('  "Large" - extracted from "Coca-Cola - Large" via size pattern');
console.log('  "lg" - extracted from "fountain soda - lg" but "lg" pattern removes it from name');
console.log('       so variation becomes "lg" (the matched group)');
console.log('  "Lg Coke" - matched "coke" keyword, full name becomes variation');
console.log('\n  Root cause: "lg" and "Large" are not being normalized to the same value');

console.log('\n' + '='.repeat(70));
console.log('ISSUE 5: Why are Sandwich typos not deduplicated?');
console.log('='.repeat(70));

const sandwichProduct = data.normalized.products.find(p => p.name === 'Sandwich');
const sandwichVariations = data.normalized.product_variations.filter(v => v.product_id === sandwichProduct?.id);
console.log('\nSandwich variations:');
for (const v of sandwichVariations) {
  console.log(`  - "${v.name}" from "${v.source_raw_name}" (type: ${v.variation_type})`);
}

const chickenVariations = sandwichVariations.filter(v =>
  v.name.toLowerCase().includes('chicken') || v.name.toLowerCase().includes('chiken')
);
console.log('\nChicken sandwich variations:');
for (const v of chickenVariations) {
  console.log(`  - "${v.name}"`);
}

console.log('\nLevenshtein distances between chicken variations:');
const names = chickenVariations.map(v => v.name);
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const dist = levenshtein(names[i].toLowerCase(), names[j].toLowerCase());
    console.log(`  "${names[i]}" vs "${names[j]}": distance = ${dist}`);
  }
}

console.log('\nRoot cause: Variations are stored as-is from source data.');
console.log('            No deduplication/normalization of variation names happens.');
console.log('            Each unique (product_id, name) pair creates a new variation.');

console.log('\n' + '='.repeat(70));
console.log('SUMMARY OF ROOT CAUSES');
console.log('='.repeat(70));
console.log(`
1. "expresso" separate product:
   - "expresso" has same length as "espresso" (8 chars)
   - Our new rule rejects same-length fuzzy matches
   - So "expresso" doesn't match the "espresso" keyword

2. Wings duplicate variations (12 pcs, Buffalo Wings 12pc, Wings 12pc):
   - "12pc" without space doesn't match quantity pattern "\\d+\\s*(pcs?|pieces?)"
   - So "Buffalo Wings 12pc" doesn't extract a quantity variation
   - The entire name becomes the variation

3. Fries duplicate (Large, Fries - Large):
   - "Fries - Large" matches the "Fries" suffix group
   - The variation becomes "- Large" or similar, not normalized with "Large"

4. Soft Drink duplicates (Large, lg, Lg Coke):
   - "lg" is extracted but not normalized to "Large"
   - "Lg Coke" matches keyword, full name becomes variation

5. Sandwich typo variations:
   - No variation name deduplication/normalization
   - "Griled Chicken", "Griled Chiken", "Grilled Chicken" stored separately
`);
