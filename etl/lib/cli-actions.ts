import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  ToastDataSchema,
  DoorDashDataSchema,
  SquareLocationsDataSchema,
  SquareCatalogDataSchema,
  SquareOrdersDataSchema,
  SquarePaymentsDataSchema,
  LocationsConfigSchema,
  VariationPatternsConfigSchema,
} from './schemas.js';
import { preprocessData, NormalizedData, SourceData } from './preprocessor.js';
import { initializePatterns } from './variation-patterns.js';
import type {
  ToastData,
  DoorDashData,
  SquareLocationsData,
  SquareCatalogData,
  SquareOrdersData,
  SquarePaymentsData,
  LocationsConfig,
} from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface EnvConfig {
  LOCATIONS_PATH: string;
  VARIATION_PATTERNS_PATH: string;
  DOORDASH_ORDERS_PATH: string;
  TOAST_POS_PATH: string;
  SQUARE_CATALOG_PATH: string;
  SQUARE_LOCATIONS_PATH: string;
  SQUARE_ORDERS_PATH: string;
  SQUARE_PAYMENTS_PATH: string;
}

export interface ValidationResult {
  success: boolean;
  errors: string[];
}

export interface PreprocessResult {
  success: boolean;
  error?: string;
  data?: PreprocessedData;
}

export interface LoadResult {
  success: boolean;
  error?: string;
}

export interface PreprocessedData {
  version: string;
  generated_at: string;
  normalized: NormalizedData;
}

// In-memory cache for preprocessed data between steps
let cachedPreprocessedData: PreprocessedData | null = null;

// ============================================================================
// VALIDATION
// ============================================================================

interface FileValidation {
  file: string;
  success: boolean;
  error?: string;
}

function validateFile(
  filePath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: { safeParse: (data: unknown) => any },
  name: string
): FileValidation {
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    const result = schema.safeParse(data);

    if (result.success) {
      return { file: name, success: true };
    } else {
      const issues = result.error?.issues || [];
      const firstError = issues[0];
      const errorMsg = firstError
        ? `${(firstError.path || []).join('.')}: ${firstError.message}`
        : 'Unknown schema error';
      return {
        file: name,
        success: false,
        error: errorMsg,
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

export async function runValidation(config: EnvConfig): Promise<ValidationResult> {
  const results: FileValidation[] = [];

  // Validate config files
  results.push(validateFile(config.LOCATIONS_PATH, LocationsConfigSchema, 'Locations Config'));
  results.push(validateFile(config.VARIATION_PATTERNS_PATH, VariationPatternsConfigSchema, 'Variation Patterns'));

  // Validate source data files
  results.push(validateFile(config.TOAST_POS_PATH, ToastDataSchema, 'Toast POS'));
  results.push(validateFile(config.DOORDASH_ORDERS_PATH, DoorDashDataSchema, 'DoorDash Orders'));
  results.push(validateFile(config.SQUARE_LOCATIONS_PATH, SquareLocationsDataSchema, 'Square Locations'));
  results.push(validateFile(config.SQUARE_CATALOG_PATH, SquareCatalogDataSchema, 'Square Catalog'));
  results.push(validateFile(config.SQUARE_ORDERS_PATH, SquareOrdersDataSchema, 'Square Orders'));
  results.push(validateFile(config.SQUARE_PAYMENTS_PATH, SquarePaymentsDataSchema, 'Square Payments'));

  const failed = results.filter(r => !r.success);

  if (failed.length > 0) {
    return {
      success: false,
      errors: failed.map(f => `${f.file}: ${f.error}`),
    };
  }

  // Initialize variation patterns after validation passes
  try {
    initializePatterns(config.VARIATION_PATTERNS_PATH);
  } catch (err) {
    return {
      success: false,
      errors: [`Variation Patterns: ${err instanceof Error ? err.message : 'Failed to initialize'}`],
    };
  }

  return { success: true, errors: [] };
}

// ============================================================================
// DATA INTEGRITY CHECK
// ============================================================================

export interface DataIntegrityResult {
  success: boolean;
  warnings: string[];
  summary: {
    sourceOrders: { toast: number; doordash: number; square: number; total: number };
    preprocessedOrders: number;
    sourcePayments: { toast: number; doordash: number; square: number; total: number };
    preprocessedPayments: number;
    ordersWithPayments: number;
    ordersWithoutPayments: number;
  };
}

export function checkDataIntegrity(
  sources: SourceData,
  preprocessedData: PreprocessedData
): DataIntegrityResult {
  const warnings: string[] = [];

  // Count source orders (excluding voided/deleted)
  const toastOrders = sources.toast.orders.filter(o => !o.voided && !o.deleted).length;
  const doordashOrders = sources.doordash.orders.length;
  const squareOrders = sources.square.orders.orders.length;
  const totalSourceOrders = toastOrders + doordashOrders + squareOrders;

  // Count preprocessed orders
  const preprocessedOrders = preprocessedData.normalized.orders.length;

  // Count source payments
  const toastPayments = sources.toast.orders
    .filter(o => !o.voided && !o.deleted)
    .reduce((sum, order) => {
      return sum + order.checks
        .filter(c => !c.voided && !c.deleted)
        .reduce((checkSum, check) => {
          return checkSum + check.payments.filter(p => p.refundStatus !== 'FULL_REFUND').length;
        }, 0);
    }, 0);
  // DoorDash payments: 1 per order (handled by DoorDash platform)
  const doordashPayments = doordashOrders;
  const squarePayments = sources.square.payments.payments.length;
  const totalSourcePayments = toastPayments + doordashPayments + squarePayments;

  // Count preprocessed payments
  const preprocessedPayments = preprocessedData.normalized.payments.length;

  // Count orders with/without payments
  const orderIdsWithPayments = new Set(
    preprocessedData.normalized.payments.map(p => p.order_id)
  );
  const ordersWithPayments = orderIdsWithPayments.size;
  const ordersWithoutPayments = preprocessedOrders - ordersWithPayments;

  // Check for discrepancies
  if (preprocessedOrders !== totalSourceOrders) {
    warnings.push(
      `Order count mismatch: ${totalSourceOrders} source orders → ${preprocessedOrders} preprocessed ` +
      `(Toast: ${toastOrders}, DoorDash: ${doordashOrders}, Square: ${squareOrders})`
    );
  }

  if (preprocessedPayments !== totalSourcePayments) {
    warnings.push(
      `Payment count mismatch: ${totalSourcePayments} source payments → ${preprocessedPayments} preprocessed ` +
      `(Toast: ${toastPayments}, DoorDash: ${doordashPayments}, Square: ${squarePayments})`
    );
  }

  // All orders should have payments now (including DoorDash)
  if (ordersWithoutPayments > 0) {
    warnings.push(
      `${ordersWithoutPayments} orders have no payments (expected 0)`
    );
  }

  return {
    success: warnings.length === 0,
    warnings,
    summary: {
      sourceOrders: { toast: toastOrders, doordash: doordashOrders, square: squareOrders, total: totalSourceOrders },
      preprocessedOrders,
      sourcePayments: { toast: toastPayments, doordash: doordashPayments, square: squarePayments, total: totalSourcePayments },
      preprocessedPayments,
      ordersWithPayments,
      ordersWithoutPayments,
    },
  };
}

export function logDataIntegrityReport(result: DataIntegrityResult): void {
  const { summary } = result;
  const W = 41; // inner width
  const line = (s: string) => `│${s.padEnd(W)}│`;
  const sep = `├${'─'.repeat(W)}┤`;

  console.log(`\n┌${'─'.repeat(W)}┐`);
  console.log(line('         Data Integrity Report           '));
  console.log(sep);

  console.log(line(' Orders:'));
  console.log(line(`   Toast:      ${String(summary.sourceOrders.toast).padStart(4)} orders`));
  console.log(line(`   DoorDash:   ${String(summary.sourceOrders.doordash).padStart(4)} orders`));
  console.log(line(`   Square:     ${String(summary.sourceOrders.square).padStart(4)} orders`));
  console.log(line('   ───────────────────────'));
  console.log(line(`   Total:      ${String(summary.sourceOrders.total).padStart(4)} → ${String(summary.preprocessedOrders).padStart(4)} preprocessed`));

  console.log(sep);
  console.log(line(' Payments:'));
  console.log(line(`   Toast:      ${String(summary.sourcePayments.toast).padStart(4)} payments`));
  console.log(line(`   DoorDash:   ${String(summary.sourcePayments.doordash).padStart(4)} payments`));
  console.log(line(`   Square:     ${String(summary.sourcePayments.square).padStart(4)} payments`));
  console.log(line('   ───────────────────────'));
  console.log(line(`   Total:      ${String(summary.sourcePayments.total).padStart(4)} → ${String(summary.preprocessedPayments).padStart(4)} preprocessed`));

  console.log(sep);
  console.log(line(' Payment Coverage:'));
  console.log(line(`   Orders with payments:     ${String(summary.ordersWithPayments).padStart(4)}`));
  console.log(line(`   Orders without payments:  ${String(summary.ordersWithoutPayments).padStart(4)}`));
  console.log(`└${'─'.repeat(W)}┘`);

  if (result.success) {
    console.log('\n✓ Data integrity check passed!');
  } else {
    console.log('\n⚠ Data integrity warnings:');
    result.warnings.forEach(w => console.log(`  - ${w}`));
  }
}

// ============================================================================
// PREPROCESSING
// ============================================================================

// Cached source data for integrity checks
let cachedSourceData: SourceData | null = null;

/**
 * Get cached source data (available after runPreprocess)
 */
export function getCachedSourceData(): SourceData | null {
  return cachedSourceData;
}

/**
 * Get cached preprocessed data (available after runPreprocess)
 */
export function getCachedPreprocessedData(): PreprocessedData | null {
  return cachedPreprocessedData;
}

export async function runPreprocess(config: EnvConfig): Promise<PreprocessResult> {
  try {
    // Load locations config
    const locationsConfig: LocationsConfig = JSON.parse(readFileSync(config.LOCATIONS_PATH, 'utf-8'));

    // Load all source data
    const toastData: ToastData = JSON.parse(readFileSync(config.TOAST_POS_PATH, 'utf-8'));
    const doordashData: DoorDashData = JSON.parse(readFileSync(config.DOORDASH_ORDERS_PATH, 'utf-8'));
    const squareLocations: SquareLocationsData = JSON.parse(readFileSync(config.SQUARE_LOCATIONS_PATH, 'utf-8'));
    const squareCatalog: SquareCatalogData = JSON.parse(readFileSync(config.SQUARE_CATALOG_PATH, 'utf-8'));
    const squareOrders: SquareOrdersData = JSON.parse(readFileSync(config.SQUARE_ORDERS_PATH, 'utf-8'));
    const squarePayments: SquarePaymentsData = JSON.parse(readFileSync(config.SQUARE_PAYMENTS_PATH, 'utf-8'));

    // Build source data structure
    const sources: SourceData = {
      toast: toastData,
      doordash: doordashData,
      square: {
        locations: squareLocations,
        catalog: squareCatalog,
        orders: squareOrders,
        payments: squarePayments,
      },
    };

    // Cache source data for integrity checks
    cachedSourceData = sources;

    // Run normalization with configurable locations
    const normalized = preprocessData(sources, locationsConfig.locations);

    // Create preprocessed data structure (normalized only, no raw sources)
    const preprocessedData: PreprocessedData = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      normalized,
    };

    // Cache for later use
    cachedPreprocessedData = preprocessedData;

    return { success: true, data: preprocessedData };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during preprocessing',
    };
  }
}

// ============================================================================
// SAVE PREPROCESSED DATA
// ============================================================================

export async function savePreprocessedData(config: EnvConfig, outputPath: string): Promise<void> {
  if (!cachedPreprocessedData) {
    // If no cached data, run preprocessing first
    const result = await runPreprocess(config);
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to preprocess data');
    }
    cachedPreprocessedData = result.data;
  }

  const resolvedPath = resolve(outputPath);
  writeFileSync(resolvedPath, JSON.stringify(cachedPreprocessedData, null, 2));
}

// ============================================================================
// LOAD TO DATABASE
// ============================================================================

export async function loadToDatabase(preprocessedDataPath: string): Promise<LoadResult> {
  try {
    const resolvedPath = resolve(preprocessedDataPath);

    // Check if file exists
    let data: PreprocessedData;
    try {
      data = JSON.parse(readFileSync(resolvedPath, 'utf-8'));
    } catch {
      return {
        success: false,
        error: `Could not read file: ${resolvedPath}`,
      };
    }

    // Validate it's a preprocessed data file
    if (!data.version || !data.normalized) {
      return {
        success: false,
        error: 'Invalid preprocessed data file format',
      };
    }

    // Check for database connection string
    const connectionStr = process.env.DATABASE_URL;

    if (!connectionStr) {
      return {
        success: false,
        error: 'Missing DATABASE_URL environment variable. Add it to your .env file.',
      };
    }

    // TODO: Implement actual database loading
    // This will:
    // 1. Connect to PostgreSQL
    // 2. Load locations
    // 3. Load categories and products
    // 4. Load orders from all sources
    // 5. Load order items
    // 6. Load payments

    return {
      success: false,
      error: 'Database loading not yet implemented. Schema and connection ready.',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error loading to database',
    };
  }
}
