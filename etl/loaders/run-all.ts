import { seedLocations } from './01-seed-locations.js';
import { buildProducts } from './02-build-products.js';
import { loadToast } from './03-load-toast.js';
import { loadDoorDash } from './04-load-doordash.js';
import { loadSquare } from './05-load-square.js';

async function runAllETL() {
  console.log('='.repeat(60));
  console.log('Restaurant Data ETL Pipeline');
  console.log('='.repeat(60));
  console.log();

  const startTime = Date.now();

  try {
    // Step 1: Seed locations
    console.log('[1/5] Seeding locations...');
    const locationMap = await seedLocations();
    console.log();

    // Step 2: Build canonical products
    console.log('[2/5] Building canonical products...');
    const { productMap, products } = await buildProducts();
    console.log();

    // Step 3: Load Toast data
    console.log('[3/5] Loading Toast POS data...');
    const toastResults = await loadToast(locationMap, products);
    console.log();

    // Step 4: Load DoorDash data
    console.log('[4/5] Loading DoorDash data...');
    const doordashResults = await loadDoorDash(locationMap, products);
    console.log();

    // Step 5: Load Square data
    console.log('[5/5] Loading Square data...');
    const squareResults = await loadSquare(locationMap, productMap);
    console.log();

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('='.repeat(60));
    console.log('ETL Complete!');
    console.log('='.repeat(60));
    console.log();
    console.log('Summary:');
    console.log(`  Locations: ${locationMap.size / 4} (with ${locationMap.size} ID mappings)`);
    console.log(`  Products:  ${products.length}`);
    console.log();
    console.log('Orders loaded:');
    console.log(`  Toast:     ${toastResults.orders} orders, ${toastResults.items} items, ${toastResults.payments} payments`);
    console.log(`  DoorDash:  ${doordashResults.orders} orders, ${doordashResults.items} items`);
    console.log(`  Square:    ${squareResults.orders} orders, ${squareResults.items} items, ${squareResults.payments} payments`);
    console.log();
    const totalOrders = toastResults.orders + doordashResults.orders + squareResults.orders;
    const totalItems = toastResults.items + doordashResults.items + squareResults.items;
    const totalPayments = toastResults.payments + squareResults.payments;
    console.log(`  TOTAL:     ${totalOrders} orders, ${totalItems} items, ${totalPayments} payments`);
    console.log();
    console.log(`Time elapsed: ${elapsed}s`);

  } catch (error) {
    console.error('ETL failed:', error);
    process.exit(1);
  }
}

runAllETL();
