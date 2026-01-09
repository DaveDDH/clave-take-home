#!/usr/bin/env tsx
/**
 * Database connection validation script
 * Usage: npm run validate-db
 *
 * Tests the database connection and lists all tables in the public schema.
 */

import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

console.log('Validating database connection...\n');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Error: Missing DATABASE_URL environment variable.');
  console.error('\nPlease add it to your .env file:');
  console.error('DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

try {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Connected successfully!\n');

  console.log('Querying tables in public schema...');
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);

  if (result.rows.length === 0) {
    console.log('\nNo tables found in public schema.');
    console.log('Run the schema.sql to create the required tables.');
  } else {
    console.log(`\nFound ${result.rows.length} table(s):\n`);
    result.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.table_name}`);
    });
  }

  console.log('\n✓ Database connection validated successfully!');
} catch (err) {
  console.error('\n✗ Database connection failed:');
  console.error(`  ${err instanceof Error ? err.message : 'Unknown error'}`);
  process.exit(1);
} finally {
  await client.end();
}
