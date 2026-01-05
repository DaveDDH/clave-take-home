import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../lib/supabase.js';
import { normalizeCategory } from '../lib/normalizers.js';
import type { SquareCatalogData, DbCategory, DbProduct, DbProductAlias } from '../lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data/sources');

export async function buildProducts(): Promise<{
  categoryMap: Map<string, string>;
  productMap: Map<string, string>;
  products: Array<DbProduct & { id: string }>;
}> {
  console.log('Building canonical products from Square catalog...');

  // Load Square catalog
  const catalogPath = join(DATA_DIR, 'square/catalog.json');
  const catalogData: SquareCatalogData = JSON.parse(readFileSync(catalogPath, 'utf-8'));

  // Extract and normalize categories
  const rawCategories = catalogData.objects
    .filter(obj => obj.type === 'CATEGORY')
    .map(obj => ({
      square_id: obj.id,
      name: normalizeCategory(obj.category_data?.name ?? 'Uncategorized')
    }));

  // Deduplicate categories by normalized name
  const uniqueCategories = new Map<string, { square_id: string; name: string }>();
  for (const cat of rawCategories) {
    if (!uniqueCategories.has(cat.name)) {
      uniqueCategories.set(cat.name, cat);
    }
  }

  // Insert categories
  const categoryInserts: DbCategory[] = Array.from(uniqueCategories.values()).map(c => ({
    name: c.name
  }));

  const { data: insertedCategories, error: catError } = await supabase
    .from('categories')
    .upsert(categoryInserts, { onConflict: 'name' })
    .select();

  if (catError) {
    throw new Error(`Failed to insert categories: ${catError.message}`);
  }

  console.log(`Inserted ${insertedCategories.length} categories`);

  // Build category map: square_id -> db_id and name -> db_id
  const categoryMap = new Map<string, string>();
  for (const cat of insertedCategories) {
    categoryMap.set(cat.name, cat.id);
  }
  // Map square_id to db_id through name
  for (const [name, info] of uniqueCategories) {
    const dbId = categoryMap.get(name);
    if (dbId) {
      categoryMap.set(info.square_id, dbId);
    }
  }

  // Extract items and their variations
  const items = catalogData.objects.filter(obj => obj.type === 'ITEM');

  // Build canonical products (use the "cleanest" name for each item)
  const productInserts: DbProduct[] = [];
  const squareIdToProduct = new Map<string, number>(); // track index for aliases

  for (const item of items) {
    if (!item.item_data) continue;

    const categoryId = item.item_data.category_id
      ? categoryMap.get(item.item_data.category_id)
      : undefined;

    productInserts.push({
      name: item.item_data.name,
      category_id: categoryId,
      description: item.item_data.description
    });

    squareIdToProduct.set(item.id, productInserts.length - 1);
  }

  // Insert products
  const { data: insertedProducts, error: prodError } = await supabase
    .from('products')
    .insert(productInserts)
    .select();

  if (prodError) {
    throw new Error(`Failed to insert products: ${prodError.message}`);
  }

  console.log(`Inserted ${insertedProducts.length} products`);

  // Build product map and create aliases
  const productMap = new Map<string, string>();
  const aliasInserts: DbProductAlias[] = [];

  for (const [squareId, idx] of squareIdToProduct) {
    const dbProduct = insertedProducts[idx];
    productMap.set(squareId, dbProduct.id);
    productMap.set(dbProduct.name.toLowerCase(), dbProduct.id);

    // Add alias for the main item name
    aliasInserts.push({
      product_id: dbProduct.id,
      raw_name: items.find(i => i.id === squareId)?.item_data?.name ?? dbProduct.name,
      source: 'square'
    });

    // Add aliases for each variation
    const item = items.find(i => i.id === squareId);
    if (item?.item_data?.variations) {
      for (const variation of item.item_data.variations) {
        productMap.set(variation.id, dbProduct.id);

        // If variation name is different from item name, add as alias
        const varName = variation.item_variation_data.name;
        if (varName.toLowerCase() !== dbProduct.name.toLowerCase()) {
          const fullName = `${dbProduct.name} - ${varName}`;
          productMap.set(fullName.toLowerCase(), dbProduct.id);
        }
      }
    }
  }

  // Insert aliases (ignore duplicates)
  if (aliasInserts.length > 0) {
    const { error: aliasError } = await supabase
      .from('product_aliases')
      .upsert(aliasInserts, { onConflict: 'raw_name,source', ignoreDuplicates: true });

    if (aliasError) {
      console.warn(`Warning inserting aliases: ${aliasError.message}`);
    } else {
      console.log(`Inserted ${aliasInserts.length} product aliases`);
    }
  }

  return {
    categoryMap,
    productMap,
    products: insertedProducts
  };
}

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  buildProducts()
    .then(({ products }) => {
      console.log('Sample products:');
      for (const p of products.slice(0, 5)) {
        console.log(`  - ${p.name}`);
      }
    })
    .catch(console.error);
}
