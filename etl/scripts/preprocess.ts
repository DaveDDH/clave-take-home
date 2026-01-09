#!/usr/bin/env tsx
/**
 * Standalone preprocessing script
 * Usage: npm run preprocess <output_path>
 * Example: npm run preprocess ./preprocessed_data.json
 */

import 'dotenv/config';
import {
  runValidation,
  runPreprocess,
  savePreprocessedData,
  getCachedSourceData,
  getCachedPreprocessedData,
  checkDataIntegrity,
  logDataIntegrityReport,
  EnvConfig,
} from '../lib/cli-actions/index.js';

const REQUIRED_ENV_VARS = [
  'LOCATIONS_PATH',
  'VARIATION_PATTERNS_PATH',
  'PRODUCT_GROUPS_PATH',
  'DOORDASH_ORDERS_PATH',
  'TOAST_POS_PATH',
  'SQUARE_CATALOG_PATH',
  'SQUARE_LOCATIONS_PATH',
  'SQUARE_ORDERS_PATH',
  'SQUARE_PAYMENTS_PATH',
] as const;

const outputPath = process.argv[2];

if (!outputPath) {
  console.error('Usage: npm run preprocess <output_path>');
  console.error('Example: npm run preprocess ./preprocessed_data.json');
  process.exit(1);
}

console.log('Preprocessing source data...\n');

// Check env vars
const missing: string[] = [];
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    missing.push(key);
  }
}

if (missing.length > 0) {
  console.error('Error: Missing environment variables:');
  missing.forEach(v => console.error(`  - ${v}`));
  console.error('\nPlease add them to your .env file.');
  process.exit(1);
}

const config: EnvConfig = {
  LOCATIONS_PATH: process.env.LOCATIONS_PATH!,
  VARIATION_PATTERNS_PATH: process.env.VARIATION_PATTERNS_PATH!,
  PRODUCT_GROUPS_PATH: process.env.PRODUCT_GROUPS_PATH!,
  DOORDASH_ORDERS_PATH: process.env.DOORDASH_ORDERS_PATH!,
  TOAST_POS_PATH: process.env.TOAST_POS_PATH!,
  SQUARE_CATALOG_PATH: process.env.SQUARE_CATALOG_PATH!,
  SQUARE_LOCATIONS_PATH: process.env.SQUARE_LOCATIONS_PATH!,
  SQUARE_ORDERS_PATH: process.env.SQUARE_ORDERS_PATH!,
  SQUARE_PAYMENTS_PATH: process.env.SQUARE_PAYMENTS_PATH!,
};

// Validate first
console.log('Step 1: Validating source data...');
const validationResult = await runValidation(config);

if (!validationResult.success) {
  console.error('✗ Validation failed:\n');
  validationResult.errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}
console.log('✓ Validation passed\n');

// Preprocess
console.log('Step 2: Preprocessing data...');
const preprocessResult = await runPreprocess(config);

if (!preprocessResult.success) {
  console.error(`✗ Preprocessing failed: ${preprocessResult.error}`);
  process.exit(1);
}
console.log('✓ Preprocessing completed\n');

// Save
console.log(`Step 3: Saving to ${outputPath}...`);
try {
  await savePreprocessedData(config, outputPath);
  console.log(`✓ Preprocessed data saved to ${outputPath}\n`);
} catch (err) {
  console.error(`✗ Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
  process.exit(1);
}

// Data integrity check
console.log('Step 4: Running data integrity check...');
const sourceData = getCachedSourceData();
const preprocessedData = getCachedPreprocessedData();

if (sourceData && preprocessedData) {
  const integrityResult = checkDataIntegrity(sourceData, preprocessedData);
  logDataIntegrityReport(integrityResult);

  if (!integrityResult.success) {
    console.log('\nNote: Data integrity warnings were found. Review the report above.');
  }
} else {
  console.log('⚠ Could not run integrity check: cached data not available');
}

console.log('\n✓ Preprocessing complete!');
