#!/usr/bin/env tsx
/**
 * Standalone preprocessing script
 * Usage: npm run preprocess <output_path>
 * Example: npm run preprocess ./preprocessed_data.json
 */

import 'dotenv/config';
import { runValidation, runPreprocess, savePreprocessedData, EnvConfig } from '../lib/cli-actions.js';

const REQUIRED_ENV_VARS = [
  'DOORDASH_ORDERS_PATH',
  'TOAST_POS_PATH',
  'SQUARE_CATALOG_PATH',
  'SQUARE_LOCATIONS_PATH',
  'SQUARE_ORDERS_PATH',
  'SQUARE_PAYMENTS_PATH',
] as const;

async function main() {
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
}

main();
