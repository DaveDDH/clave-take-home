#!/usr/bin/env tsx
/**
 * Standalone database loading script
 * Usage: npm run load <preprocessed_data_path>
 * Example: npm run load ./preprocessed_data.json
 */

import 'dotenv/config';
import { loadToDatabase } from '../lib/cli-actions/index.js';

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: npm run load <preprocessed_data_path>');
  console.error('Example: npm run load ./preprocessed_data.json');
  process.exit(1);
}

console.log(`Loading preprocessed data from ${inputPath}...\n`);

const result = await loadToDatabase(inputPath);

if (result.success) {
  console.log('✓ Data loaded to database successfully!');
  process.exit(0);
} else {
  console.error(`✗ Failed to load data: ${result.error}`);
  process.exit(1);
}
