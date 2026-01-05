#!/usr/bin/env tsx
/**
 * Standalone validation script
 * Usage: npm run validate
 */

import 'dotenv/config';
import { runValidation, EnvConfig } from '../lib/cli-actions.js';

const REQUIRED_ENV_VARS = [
  'DOORDASH_ORDERS_PATH',
  'TOAST_POS_PATH',
  'SQUARE_CATALOG_PATH',
  'SQUARE_LOCATIONS_PATH',
  'SQUARE_ORDERS_PATH',
  'SQUARE_PAYMENTS_PATH',
] as const;

async function main() {
  console.log('Validating source data...\n');

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

  const result = await runValidation(config);

  if (result.success) {
    console.log('✓ All files validated successfully!\n');
    console.log('Files validated:');
    console.log('  - Toast POS');
    console.log('  - DoorDash Orders');
    console.log('  - Square Locations');
    console.log('  - Square Catalog');
    console.log('  - Square Orders');
    console.log('  - Square Payments');
    process.exit(0);
  } else {
    console.error('✗ Validation failed:\n');
    result.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
}

main();
