import { randomUUID } from 'node:crypto';
import type { DbLocation, LocationConfig } from '../types.js';
import type { SourceData } from './types.js';

export function buildLocations(
  sources: SourceData,
  locationConfigs: LocationConfig[]
): {
  locations: Array<DbLocation & { id: string }>;
  locationMap: Map<string, string>;
} {
  const locations: Array<DbLocation & { id: string }> = [];
  const locationMap = new Map<string, string>();

  // Get address info from Square locations (most complete)
  const squareLocMap = new Map(
    sources.square.locations.locations.map(l => [l.id, l])
  );

  for (const config of locationConfigs) {
    const id = randomUUID();
    const squareLoc = squareLocMap.get(config.square_id);

    locations.push({
      id,
      name: config.name,
      address: squareLoc
        ? {
            line1: squareLoc.address.address_line_1,
            city: squareLoc.address.locality,
            state: squareLoc.address.administrative_district_level_1,
            zip: squareLoc.address.postal_code,
            country: squareLoc.address.country,
          }
        : undefined,
      timezone: squareLoc?.timezone ?? 'America/New_York',
      toast_id: config.toast_id,
      doordash_id: config.doordash_id,
      square_id: config.square_id,
      raw_data: { config, square_location: squareLoc },
    });

    // Map all source IDs to unified ID
    locationMap.set(config.toast_id, id);
    locationMap.set(config.doordash_id, id);
    locationMap.set(config.square_id, id);
    locationMap.set(config.name, id);
  }

  return { locations, locationMap };
}
