import { supabase } from '../lib/supabase.js';
import type { DbLocation } from '../lib/types.js';

const LOCATIONS: DbLocation[] = [
  {
    name: 'Downtown',
    address: {
      line1: '123 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'US'
    },
    timezone: 'America/New_York',
    toast_id: 'loc_downtown_001',
    doordash_id: 'str_downtown_001',
    square_id: 'LCN001DOWNTOWN'
  },
  {
    name: 'Airport',
    address: {
      line1: '456 Terminal Blvd',
      city: 'Jamaica',
      state: 'NY',
      zip: '11430',
      country: 'US'
    },
    timezone: 'America/New_York',
    toast_id: 'loc_airport_002',
    doordash_id: 'str_airport_002',
    square_id: 'LCN002AIRPORT'
  },
  {
    name: 'Mall Location',
    address: {
      line1: '789 Shopping Center Dr',
      city: 'New York',
      state: 'NY',
      zip: '10019',
      country: 'US'
    },
    timezone: 'America/New_York',
    toast_id: 'loc_mall_003',
    doordash_id: 'str_mall_003',
    square_id: 'LCN003MALL'
  },
  {
    name: 'University',
    address: {
      line1: '321 College Ave',
      city: 'New York',
      state: 'NY',
      zip: '10027',
      country: 'US'
    },
    timezone: 'America/New_York',
    toast_id: 'loc_univ_004',
    doordash_id: 'str_university_004',
    square_id: 'LCN004UNIV'
  }
];

export async function seedLocations(): Promise<Map<string, string>> {
  console.log('Seeding locations...');

  // Upsert locations (insert or update on conflict)
  const { data, error } = await supabase
    .from('locations')
    .upsert(LOCATIONS, { onConflict: 'name' })
    .select();

  if (error) {
    throw new Error(`Failed to seed locations: ${error.message}`);
  }

  // Build lookup maps for all source IDs
  const locationMap = new Map<string, string>();

  for (const loc of data) {
    // Map all source IDs to the unified location ID
    if (loc.toast_id) locationMap.set(loc.toast_id, loc.id);
    if (loc.doordash_id) locationMap.set(loc.doordash_id, loc.id);
    if (loc.square_id) locationMap.set(loc.square_id, loc.id);
    // Also map by name for convenience
    locationMap.set(loc.name, loc.id);
  }

  console.log(`Seeded ${data.length} locations`);
  return locationMap;
}

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  seedLocations()
    .then(map => {
      console.log('Location mappings:');
      for (const [key, value] of map) {
        console.log(`  ${key} -> ${value}`);
      }
    })
    .catch(console.error);
}
