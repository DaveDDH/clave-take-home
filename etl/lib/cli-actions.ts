import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import {
  ToastDataSchema,
  DoorDashDataSchema,
  SquareLocationsDataSchema,
  SquareCatalogDataSchema,
  SquareOrdersDataSchema,
  SquarePaymentsDataSchema,
  LocationsConfigSchema,
  VariationPatternsConfigSchema,
  ProductGroupsConfigSchema,
} from './schemas.js';
import { preprocessData, NormalizedData, SourceData } from './preprocessor.js';
import { initializePatterns } from './variation-patterns.js';
import { initializeProductGroups } from './product-groups.js';
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
  PRODUCT_GROUPS_PATH: string;
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
  stats?: {
    locations: number;
    categories: number;
    products: number;
    product_variations: number;
    product_aliases: number;
    orders: number;
    order_items: number;
    payments: number;
  };
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
  results.push(validateFile(config.PRODUCT_GROUPS_PATH, ProductGroupsConfigSchema, 'Product Groups'));

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

  // Initialize product groups after validation passes
  try {
    initializeProductGroups(config.PRODUCT_GROUPS_PATH);
  } catch (err) {
    return {
      success: false,
      errors: [`Product Groups: ${err instanceof Error ? err.message : 'Failed to initialize'}`],
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the schema SQL content
 */
function getSchemaSQL(): string {
  const schemaPath = join(__dirname, '..', 'schema.sql');
  return readFileSync(schemaPath, 'utf-8');
}

export type LoadProgressCallback = (message: string) => void;

/**
 * Load preprocessed data to database
 * @param preprocessedDataPath - Path to the preprocessed JSON file
 * @param cleanDb - If true, truncate all tables before loading; if false, just insert
 * @param onProgress - Optional callback for progress updates
 */
export async function loadToDatabase(
  preprocessedDataPath: string,
  cleanDb: boolean = false,
  onProgress?: LoadProgressCallback
): Promise<LoadResult> {
  const log = onProgress || (() => {});
  const { Client } = pg;
  let client: pg.Client | null = null;

  try {
    const resolvedPath = resolve(preprocessedDataPath);

    // Check if file exists and load it
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

    // Connect to database
    log('Connecting to database...');
    client = new Client({
      connectionString: connectionStr,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    log('Connected to database');

    // Create tables if they don't exist
    log('Creating tables if needed...');
    const schemaSQL = getSchemaSQL();
    await client.query(schemaSQL);
    log('Schema ready');

    // If cleanDb, truncate all tables in reverse order (respect foreign keys)
    if (cleanDb) {
      log('Cleaning existing data...');
      await client.query(`
        TRUNCATE TABLE payments, order_items, orders,
                       product_aliases, product_variations, products,
                       categories, locations CASCADE
      `);
      log('Database cleaned');
    }

    const { normalized } = data;
    const stats = {
      locations: 0,
      categories: 0,
      products: 0,
      product_variations: 0,
      product_aliases: 0,
      orders: 0,
      order_items: 0,
      payments: 0,
    };

    // 1. Insert locations
    log(`Loading ${normalized.locations.length} locations...`);
    for (const loc of normalized.locations) {
      await client.query(
        `INSERT INTO locations (id, name, address, timezone, toast_id, doordash_id, square_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           address = EXCLUDED.address,
           timezone = EXCLUDED.timezone,
           toast_id = EXCLUDED.toast_id,
           doordash_id = EXCLUDED.doordash_id,
           square_id = EXCLUDED.square_id`,
        [loc.id, loc.name, JSON.stringify(loc.address), loc.timezone, loc.toast_id, loc.doordash_id, loc.square_id]
      );
      stats.locations++;
    }

    // 2. Insert categories
    log(`Loading ${normalized.categories.length} categories...`);
    for (const cat of normalized.categories) {
      await client.query(
        `INSERT INTO categories (id, name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [cat.id, cat.name]
      );
      stats.categories++;
    }

    // 3. Insert products
    log(`Loading ${normalized.products.length} products...`);
    for (const prod of normalized.products) {
      await client.query(
        `INSERT INTO products (id, name, category_id, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           category_id = EXCLUDED.category_id,
           description = EXCLUDED.description`,
        [prod.id, prod.name, prod.category_id, prod.description]
      );
      stats.products++;
    }

    // 4. Insert product variations
    log(`Loading ${normalized.product_variations.length} product variations...`);
    for (const variation of normalized.product_variations) {
      await client.query(
        `INSERT INTO product_variations (id, product_id, name, variation_type, source_raw_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           name = EXCLUDED.name,
           variation_type = EXCLUDED.variation_type,
           source_raw_name = EXCLUDED.source_raw_name`,
        [variation.id, variation.product_id, variation.name, variation.variation_type, variation.source_raw_name]
      );
      stats.product_variations++;
    }

    // 5. Insert product aliases
    log(`Loading ${normalized.product_aliases.length} product aliases...`);
    for (const alias of normalized.product_aliases) {
      await client.query(
        `INSERT INTO product_aliases (id, product_id, raw_name, source)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           raw_name = EXCLUDED.raw_name,
           source = EXCLUDED.source`,
        [alias.id, alias.product_id, alias.raw_name, alias.source]
      );
      stats.product_aliases++;
    }

    // 6. Insert orders
    log(`Loading ${normalized.orders.length} orders...`);
    for (const order of normalized.orders) {
      await client.query(
        `INSERT INTO orders (id, source, source_order_id, location_id, order_type, channel, status,
                            created_at, closed_at, subtotal_cents, tax_cents, tip_cents, total_cents,
                            delivery_fee_cents, service_fee_cents, commission_cents, contains_alcohol, is_catering)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (id) DO UPDATE SET
           source = EXCLUDED.source,
           source_order_id = EXCLUDED.source_order_id,
           location_id = EXCLUDED.location_id,
           order_type = EXCLUDED.order_type,
           channel = EXCLUDED.channel,
           status = EXCLUDED.status,
           created_at = EXCLUDED.created_at,
           closed_at = EXCLUDED.closed_at,
           subtotal_cents = EXCLUDED.subtotal_cents,
           tax_cents = EXCLUDED.tax_cents,
           tip_cents = EXCLUDED.tip_cents,
           total_cents = EXCLUDED.total_cents,
           delivery_fee_cents = EXCLUDED.delivery_fee_cents,
           service_fee_cents = EXCLUDED.service_fee_cents,
           commission_cents = EXCLUDED.commission_cents,
           contains_alcohol = EXCLUDED.contains_alcohol,
           is_catering = EXCLUDED.is_catering`,
        [
          order.id, order.source, order.source_order_id, order.location_id,
          order.order_type, order.channel, order.status,
          order.created_at, order.closed_at,
          order.subtotal_cents, order.tax_cents, order.tip_cents, order.total_cents,
          order.delivery_fee_cents, order.service_fee_cents, order.commission_cents,
          order.contains_alcohol, order.is_catering,
        ]
      );
      stats.orders++;
    }

    // 7. Insert order items
    log(`Loading ${normalized.order_items.length} order items...`);
    for (const item of normalized.order_items) {
      await client.query(
        `INSERT INTO order_items (id, order_id, product_id, variation_id, original_name, quantity,
                                  unit_price_cents, total_price_cents, tax_cents, modifiers, special_instructions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           order_id = EXCLUDED.order_id,
           product_id = EXCLUDED.product_id,
           variation_id = EXCLUDED.variation_id,
           original_name = EXCLUDED.original_name,
           quantity = EXCLUDED.quantity,
           unit_price_cents = EXCLUDED.unit_price_cents,
           total_price_cents = EXCLUDED.total_price_cents,
           tax_cents = EXCLUDED.tax_cents,
           modifiers = EXCLUDED.modifiers,
           special_instructions = EXCLUDED.special_instructions`,
        [
          item.id, item.order_id, item.product_id, item.variation_id,
          item.original_name, item.quantity,
          item.unit_price_cents, item.total_price_cents, item.tax_cents,
          JSON.stringify(item.modifiers), item.special_instructions,
        ]
      );
      stats.order_items++;
    }

    // 8. Insert payments
    log(`Loading ${normalized.payments.length} payments...`);
    for (const payment of normalized.payments) {
      await client.query(
        `INSERT INTO payments (id, order_id, source_payment_id, payment_type, card_brand, last_four,
                              amount_cents, tip_cents, processing_fee_cents, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           order_id = EXCLUDED.order_id,
           source_payment_id = EXCLUDED.source_payment_id,
           payment_type = EXCLUDED.payment_type,
           card_brand = EXCLUDED.card_brand,
           last_four = EXCLUDED.last_four,
           amount_cents = EXCLUDED.amount_cents,
           tip_cents = EXCLUDED.tip_cents,
           processing_fee_cents = EXCLUDED.processing_fee_cents,
           created_at = EXCLUDED.created_at`,
        [
          payment.id, payment.order_id, payment.source_payment_id,
          payment.payment_type, payment.card_brand, payment.last_four,
          payment.amount_cents, payment.tip_cents, payment.processing_fee_cents,
          payment.created_at,
        ]
      );
      stats.payments++;
    }

    log('Closing connection...');
    await client.end();
    log('Done!');

    return { success: true, stats };
  } catch (err) {
    if (client) {
      try {
        await client.end();
      } catch {
        // Ignore close errors
      }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error loading to database',
    };
  }
}
