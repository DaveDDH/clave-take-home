import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import type { LoadResult, LoadProgressCallback, PreprocessedData } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the schema SQL content
 */
function getSchemaSQL(): string {
  const schemaPath = join(__dirname, '..', '..', 'schema.sql');
  return readFileSync(schemaPath, 'utf-8');
}

/**
 * Get the gold views SQL content
 */
function getGoldViewsSQL(): string {
  const goldViewsPath = join(__dirname, '..', '..', 'gold_views.sql');
  return readFileSync(goldViewsPath, 'utf-8');
}

async function cleanDatabase(client: pg.Client, log: LoadProgressCallback): Promise<void> {
  log('Dropping existing tables and views...');
  await client.query(`
    DROP VIEW IF EXISTS gold_category_performance CASCADE;
    DROP VIEW IF EXISTS gold_hourly_trends CASCADE;
    DROP VIEW IF EXISTS gold_product_performance CASCADE;
    DROP VIEW IF EXISTS gold_daily_sales CASCADE;
    DROP VIEW IF EXISTS gold_order_items CASCADE;
    DROP VIEW IF EXISTS gold_orders CASCADE;
    DROP TABLE IF EXISTS messages CASCADE;
    DROP TABLE IF EXISTS conversations CASCADE;
    DROP TABLE IF EXISTS payments CASCADE;
    DROP TABLE IF EXISTS order_items CASCADE;
    DROP TABLE IF EXISTS orders CASCADE;
    DROP TABLE IF EXISTS product_aliases CASCADE;
    DROP TABLE IF EXISTS product_variations CASCADE;
    DROP TABLE IF EXISTS products CASCADE;
    DROP TABLE IF EXISTS categories CASCADE;
    DROP TABLE IF EXISTS locations CASCADE;
  `);
  log('Database cleaned');
}

async function insertLocations(
  client: pg.Client,
  normalized: PreprocessedData['normalized'],
  stats: LoadResult['stats']
): Promise<void> {
  for (const loc of normalized.locations) {
    await client.query(
      `INSERT INTO locations (id, name, address, timezone, toast_id, doordash_id, square_id, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         address = EXCLUDED.address,
         timezone = EXCLUDED.timezone,
         toast_id = EXCLUDED.toast_id,
         doordash_id = EXCLUDED.doordash_id,
         square_id = EXCLUDED.square_id,
         raw_data = EXCLUDED.raw_data`,
      [loc.id, loc.name, JSON.stringify(loc.address), loc.timezone, loc.toast_id, loc.doordash_id, loc.square_id, loc.raw_data ? JSON.stringify(loc.raw_data) : null]
    );
    stats!.locations++;
  }
}

async function insertCategories(
  client: pg.Client,
  normalized: PreprocessedData['normalized'],
  stats: LoadResult['stats']
): Promise<void> {
  for (const cat of normalized.categories) {
    await client.query(
      `INSERT INTO categories (id, name, raw_data)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, raw_data = EXCLUDED.raw_data`,
      [cat.id, cat.name, cat.raw_data ? JSON.stringify(cat.raw_data) : null]
    );
    stats!.categories++;
  }
}

async function insertProducts(
  client: pg.Client,
  normalized: PreprocessedData['normalized'],
  stats: LoadResult['stats']
): Promise<void> {
  for (const prod of normalized.products) {
    await client.query(
      `INSERT INTO products (id, name, category_id, description, raw_data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         category_id = EXCLUDED.category_id,
         description = EXCLUDED.description,
         raw_data = EXCLUDED.raw_data`,
      [prod.id, prod.name, prod.category_id, prod.description, prod.raw_data ? JSON.stringify(prod.raw_data) : null]
    );
    stats!.products++;
  }
}

async function insertProductVariations(
  client: pg.Client,
  normalized: PreprocessedData['normalized'],
  stats: LoadResult['stats']
): Promise<void> {
  for (const variation of normalized.product_variations) {
    await client.query(
      `INSERT INTO product_variations (id, product_id, name, variation_type, source_raw_name, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         product_id = EXCLUDED.product_id,
         name = EXCLUDED.name,
         variation_type = EXCLUDED.variation_type,
         source_raw_name = EXCLUDED.source_raw_name,
         raw_data = EXCLUDED.raw_data`,
      [variation.id, variation.product_id, variation.name, variation.variation_type, variation.source_raw_name, variation.raw_data ? JSON.stringify(variation.raw_data) : null]
    );
    stats!.product_variations++;
  }
}

async function insertProductAliases(
  client: pg.Client,
  normalized: PreprocessedData['normalized'],
  stats: LoadResult['stats']
): Promise<void> {
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
    stats!.product_aliases++;
  }
}

async function insertOrders(
  client: pg.Client,
  normalized: PreprocessedData['normalized'],
  stats: LoadResult['stats']
): Promise<void> {
  for (const order of normalized.orders) {
    await client.query(
      `INSERT INTO orders (id, source, source_order_id, location_id, order_type, channel, status,
                          created_at, closed_at, subtotal_cents, tax_cents, tip_cents, total_cents,
                          delivery_fee_cents, service_fee_cents, commission_cents, contains_alcohol, is_catering, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
         is_catering = EXCLUDED.is_catering,
         raw_data = EXCLUDED.raw_data`,
      [
        order.id, order.source, order.source_order_id, order.location_id,
        order.order_type, order.channel, order.status,
        order.created_at, order.closed_at,
        order.subtotal_cents, order.tax_cents, order.tip_cents, order.total_cents,
        order.delivery_fee_cents, order.service_fee_cents, order.commission_cents,
        order.contains_alcohol, order.is_catering,
        order.raw_data ? JSON.stringify(order.raw_data) : null,
      ]
    );
    stats!.orders++;
  }
}

async function insertOrderItems(
  client: pg.Client,
  normalized: PreprocessedData['normalized'],
  stats: LoadResult['stats']
): Promise<void> {
  for (const item of normalized.order_items) {
    await client.query(
      `INSERT INTO order_items (id, order_id, product_id, variation_id, original_name, quantity,
                                unit_price_cents, total_price_cents, tax_cents, modifiers, special_instructions, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
         special_instructions = EXCLUDED.special_instructions,
         raw_data = EXCLUDED.raw_data`,
      [
        item.id, item.order_id, item.product_id, item.variation_id,
        item.original_name, item.quantity,
        item.unit_price_cents, item.total_price_cents, item.tax_cents,
        JSON.stringify(item.modifiers), item.special_instructions,
        item.raw_data ? JSON.stringify(item.raw_data) : null,
      ]
    );
    stats!.order_items++;
  }
}

async function insertPayments(
  client: pg.Client,
  normalized: PreprocessedData['normalized'],
  stats: LoadResult['stats']
): Promise<void> {
  for (const payment of normalized.payments) {
    await client.query(
      `INSERT INTO payments (id, order_id, source_payment_id, payment_type, card_brand, last_four,
                            amount_cents, tip_cents, processing_fee_cents, created_at, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         order_id = EXCLUDED.order_id,
         source_payment_id = EXCLUDED.source_payment_id,
         payment_type = EXCLUDED.payment_type,
         card_brand = EXCLUDED.card_brand,
         last_four = EXCLUDED.last_four,
         amount_cents = EXCLUDED.amount_cents,
         tip_cents = EXCLUDED.tip_cents,
         processing_fee_cents = EXCLUDED.processing_fee_cents,
         created_at = EXCLUDED.created_at,
         raw_data = EXCLUDED.raw_data`,
      [
        payment.id, payment.order_id, payment.source_payment_id,
        payment.payment_type, payment.card_brand, payment.last_four,
        payment.amount_cents, payment.tip_cents, payment.processing_fee_cents,
        payment.created_at,
        payment.raw_data ? JSON.stringify(payment.raw_data) : null,
      ]
    );
    stats!.payments++;
  }
}

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

    // If cleanDb, drop all tables and views to recreate schema from scratch
    if (cleanDb) {
      await cleanDatabase(client, log);
    }

    // Create tables (will recreate if cleanDb dropped them)
    log('Creating tables...');
    const schemaSQL = getSchemaSQL();
    await client.query(schemaSQL);
    log('Schema ready');

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

    // Insert data
    log(`Loading ${normalized.locations.length} locations...`);
    await insertLocations(client, normalized, stats);

    log(`Loading ${normalized.categories.length} categories...`);
    await insertCategories(client, normalized, stats);

    log(`Loading ${normalized.products.length} products...`);
    await insertProducts(client, normalized, stats);

    log(`Loading ${normalized.product_variations.length} product variations...`);
    await insertProductVariations(client, normalized, stats);

    log(`Loading ${normalized.product_aliases.length} product aliases...`);
    await insertProductAliases(client, normalized, stats);

    log(`Loading ${normalized.orders.length} orders...`);
    await insertOrders(client, normalized, stats);

    log(`Loading ${normalized.order_items.length} order items...`);
    await insertOrderItems(client, normalized, stats);

    log(`Loading ${normalized.payments.length} payments...`);
    await insertPayments(client, normalized, stats);

    // Create gold views for optimized analytics queries
    log('Creating gold views for analytics...');
    const goldViewsSQL = getGoldViewsSQL();
    await client.query(goldViewsSQL);
    log('Gold views created');

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
