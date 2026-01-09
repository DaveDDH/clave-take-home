#!/usr/bin/env node
/**
 * Debug script to analyze product-variation matching from preprocessed data.
 * Shows all products with their variations and highlights potential misclassifications.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load preprocessed data
const preprocessedPath = resolve(__dirname, 'preprocessed_data.json');
const data = JSON.parse(readFileSync(preprocessedPath, 'utf-8'));

const { products, product_variations, categories } = data.normalized;

// Build lookup maps
const categoryMap = new Map(categories.map(c => [c.id, c.name]));
const productMap = new Map(products.map(p => [p.id, p]));

// Group variations by product
const variationsByProduct = new Map();
for (const variation of product_variations) {
  const productId = variation.product_id;
  if (!variationsByProduct.has(productId)) {
    variationsByProduct.set(productId, []);
  }
  variationsByProduct.get(productId).push(variation);
}

// Build the table data
const tableData = [];

for (const product of products) {
  const variations = variationsByProduct.get(product.id) || [];
  const categoryName = categoryMap.get(product.category_id) || 'Uncategorized';

  if (variations.length === 0) {
    // Product with no variations
    tableData.push({
      product_name: product.name,
      category: categoryName,
      variation_name: null,
      variation_type: null,
      source_raw_name: null,
    });
  } else {
    // Product with variations
    for (const v of variations) {
      tableData.push({
        product_name: product.name,
        category: categoryName,
        variation_name: v.name,
        variation_type: v.variation_type,
        source_raw_name: v.source_raw_name,
      });
    }
  }
}

// Sort by product name, then variation name
tableData.sort((a, b) => {
  const prodCompare = a.product_name.localeCompare(b.product_name);
  if (prodCompare !== 0) return prodCompare;
  if (a.variation_name === null) return -1;
  if (b.variation_name === null) return 1;
  return a.variation_name.localeCompare(b.variation_name);
});

// Print as a formatted table
console.log('\n=== PRODUCTS WITH VARIATIONS ===\n');

// Calculate column widths
const cols = {
  product_name: Math.max(12, ...tableData.map(r => r.product_name.length)),
  category: Math.max(10, ...tableData.map(r => r.category.length)),
  variation_name: Math.max(14, ...tableData.map(r => (r.variation_name || 'null').length)),
  variation_type: Math.max(14, ...tableData.map(r => (r.variation_type || 'null').length)),
  source_raw_name: Math.max(15, ...tableData.map(r => (r.source_raw_name || 'null').length)),
};

// Header
const header = `| ${'product_name'.padEnd(cols.product_name)} | ${'category'.padEnd(cols.category)} | ${'variation_name'.padEnd(cols.variation_name)} | ${'variation_type'.padEnd(cols.variation_type)} | ${'source_raw_name'.padEnd(cols.source_raw_name)} |`;
const separator = `|-${'-'.repeat(cols.product_name)}-|-${'-'.repeat(cols.category)}-|-${'-'.repeat(cols.variation_name)}-|-${'-'.repeat(cols.variation_type)}-|-${'-'.repeat(cols.source_raw_name)}-|`;

console.log(header);
console.log(separator);

// Rows
for (const row of tableData) {
  const line = `| ${row.product_name.padEnd(cols.product_name)} | ${row.category.padEnd(cols.category)} | ${(row.variation_name || 'null').padEnd(cols.variation_name)} | ${(row.variation_type || 'null').padEnd(cols.variation_type)} | ${(row.source_raw_name || 'null').padEnd(cols.source_raw_name)} |`;
  console.log(line);
}

// Summary
console.log('\n=== SUMMARY ===\n');
console.log(`Total products: ${products.length}`);
console.log(`Total variations: ${product_variations.length}`);

const productsWithVariations = new Set(product_variations.map(v => v.product_id)).size;
console.log(`Products with variations: ${productsWithVariations}`);
console.log(`Products without variations: ${products.length - productsWithVariations}`);

// Highlight potential misclassifications
console.log('\n=== POTENTIAL MISCLASSIFICATIONS ===\n');

const suspiciousPatterns = [
  // Items that probably shouldn't be under certain products
  { product: 'Steak', badKeywords: ['tea', 'pancake', 'pickle', 'philly', 'cheesesteak'] },
  { product: 'Fries', badKeywords: ['fruit'] },
  { product: 'Wings', badKeywords: ['wine', 'onion', 'rings'] },
  { product: 'Nachos', badKeywords: ['taco', 'fish taco'] },
  { product: 'Wrap', badKeywords: ['crab', 'cakes'] },
];

for (const { product: productName, badKeywords } of suspiciousPatterns) {
  const product = products.find(p => p.name === productName);
  if (!product) continue;

  const variations = variationsByProduct.get(product.id) || [];
  const suspicious = variations.filter(v => {
    const sourceLower = (v.source_raw_name || '').toLowerCase();
    const variationLower = (v.name || '').toLowerCase();
    return badKeywords.some(kw => sourceLower.includes(kw) || variationLower.includes(kw));
  });

  if (suspicious.length > 0) {
    console.log(`\n${productName}:`);
    for (const v of suspicious) {
      console.log(`  - "${v.name}" from "${v.source_raw_name}" (type: ${v.variation_type})`);
    }
  }
}

console.log('\n');
