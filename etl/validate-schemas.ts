import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  ToastDataSchema,
  DoorDashDataSchema,
  SquareLocationsDataSchema,
  SquareCatalogDataSchema,
  SquareOrdersDataSchema,
  SquarePaymentsDataSchema,
} from './lib/schemas/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data/sources');

interface ValidationResult {
  file: string;
  success: boolean;
  error?: string;
  details?: unknown;
}

function validateFile(
  filePath: string,
  schema: { safeParse: (data: unknown) => { success: boolean; error?: { issues: unknown[] } } },
  name: string
): ValidationResult {
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    const result = schema.safeParse(data);

    if (result.success) {
      return { file: name, success: true };
    } else {
      return {
        file: name,
        success: false,
        error: 'Schema validation failed',
        details: result.error?.issues,
      };
    }
  } catch (err) {
    return {
      file: name,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Validating source data against Zod schemas');
  console.log('='.repeat(60));
  console.log();

  const results: ValidationResult[] = [];

  // Toast POS
  console.log('Validating Toast POS data...');
  results.push(
    validateFile(
      join(DATA_DIR, 'toast_pos_export.json'),
      ToastDataSchema,
      'toast_pos_export.json'
    )
  );

  // DoorDash
  console.log('Validating DoorDash data...');
  results.push(
    validateFile(
      join(DATA_DIR, 'doordash_orders.json'),
      DoorDashDataSchema,
      'doordash_orders.json'
    )
  );

  // Square Locations
  console.log('Validating Square locations...');
  results.push(
    validateFile(
      join(DATA_DIR, 'square/locations.json'),
      SquareLocationsDataSchema,
      'square/locations.json'
    )
  );

  // Square Catalog
  console.log('Validating Square catalog...');
  results.push(
    validateFile(
      join(DATA_DIR, 'square/catalog.json'),
      SquareCatalogDataSchema,
      'square/catalog.json'
    )
  );

  // Square Orders
  console.log('Validating Square orders...');
  results.push(
    validateFile(
      join(DATA_DIR, 'square/orders.json'),
      SquareOrdersDataSchema,
      'square/orders.json'
    )
  );

  // Square Payments
  console.log('Validating Square payments...');
  results.push(
    validateFile(
      join(DATA_DIR, 'square/payments.json'),
      SquarePaymentsDataSchema,
      'square/payments.json'
    )
  );

  // Summary
  console.log();
  console.log('='.repeat(60));
  console.log('Results');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  for (const result of results) {
    const status = result.success ? '✓' : '✗';
    console.log(`${status} ${result.file}`);
    if (!result.success) {
      console.log(`  Error: ${result.error}`);
      if (result.details) {
        console.log('  Details:');
        for (const issue of result.details as Array<{ path: string[]; message: string }>) {
          console.log(`    - Path: ${issue.path.join('.')} - ${issue.message}`);
        }
      }
    }
  }

  console.log();
  console.log(`Passed: ${passed.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
