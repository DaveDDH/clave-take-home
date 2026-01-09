import { describe, it, expect } from '@jest/globals';
import { buildLocations } from './build-locations.js';
import type { SourceData } from './types.js';
import type { LocationConfig } from '../types.js';

describe('buildLocations', () => {
  const createMockSources = (squareLocations: SourceData['square']['locations']['locations'] = []): SourceData => ({
    toast: { restaurant: { guid: 'r1', name: 'Test' }, locations: [], orders: [] },
    doordash: { merchant: { merchant_id: 'm1', business_name: 'Test', currency: 'USD' }, stores: [], orders: [] },
    square: {
      locations: { locations: squareLocations },
      catalog: { objects: [] },
      orders: { orders: [] },
      payments: { payments: [] },
    },
  });

  const locationConfigs: LocationConfig[] = [
    { name: 'Downtown', toast_id: 'toast-1', doordash_id: 'dd-1', square_id: 'sq-1' },
    { name: 'Uptown', toast_id: 'toast-2', doordash_id: 'dd-2', square_id: 'sq-2' },
  ];

  it('creates locations from config', () => {
    const sources = createMockSources();
    const { locations } = buildLocations(sources, locationConfigs);

    expect(locations).toHaveLength(2);
    expect(locations[0].name).toBe('Downtown');
    expect(locations[1].name).toBe('Uptown');
  });

  it('generates unique IDs for each location', () => {
    const sources = createMockSources();
    const { locations } = buildLocations(sources, locationConfigs);

    expect(locations[0].id).toBeDefined();
    expect(locations[1].id).toBeDefined();
    expect(locations[0].id).not.toBe(locations[1].id);
  });

  it('maps all source IDs to unified ID', () => {
    const sources = createMockSources();
    const { locations, locationMap } = buildLocations(sources, locationConfigs);

    const downtownId = locations[0].id;
    expect(locationMap.get('toast-1')).toBe(downtownId);
    expect(locationMap.get('dd-1')).toBe(downtownId);
    expect(locationMap.get('sq-1')).toBe(downtownId);
    expect(locationMap.get('Downtown')).toBe(downtownId);
  });

  it('pulls address from Square locations', () => {
    const squareLocations = [{
      id: 'sq-1',
      name: 'Downtown',
      timezone: 'America/New_York',
      status: 'ACTIVE',
      type: 'PHYSICAL',
      merchant_id: 'm1',
      address: {
        address_line_1: '123 Main St',
        locality: 'New York',
        administrative_district_level_1: 'NY',
        postal_code: '10001',
        country: 'US',
      },
    }];
    const sources = createMockSources(squareLocations);
    const { locations } = buildLocations(sources, [locationConfigs[0]]);

    expect(locations[0].address).toEqual({
      line1: '123 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'US',
    });
    expect(locations[0].timezone).toBe('America/New_York');
  });

  it('uses default timezone when Square location not found', () => {
    const sources = createMockSources();
    const { locations } = buildLocations(sources, locationConfigs);

    expect(locations[0].timezone).toBe('America/New_York');
    expect(locations[0].address).toBeUndefined();
  });

  it('stores source IDs in location record', () => {
    const sources = createMockSources();
    const { locations } = buildLocations(sources, locationConfigs);

    expect(locations[0].toast_id).toBe('toast-1');
    expect(locations[0].doordash_id).toBe('dd-1');
    expect(locations[0].square_id).toBe('sq-1');
  });

  it('stores raw data for auditing', () => {
    const squareLocations = [{
      id: 'sq-1', name: 'Downtown', timezone: 'America/New_York',
      status: 'ACTIVE', type: 'PHYSICAL', merchant_id: 'm1',
      address: {
        address_line_1: '123 Main St', locality: 'New York',
        administrative_district_level_1: 'NY', postal_code: '10001', country: 'US',
      },
    }];
    const sources = createMockSources(squareLocations);
    const { locations } = buildLocations(sources, [locationConfigs[0]]);

    expect(locations[0].raw_data).toBeDefined();
    expect(locations[0].raw_data).toHaveProperty('config');
    expect(locations[0].raw_data).toHaveProperty('square_location');
  });

  it('handles empty location configs', () => {
    const sources = createMockSources();
    const { locations, locationMap } = buildLocations(sources, []);

    expect(locations).toHaveLength(0);
    expect(locationMap.size).toBe(0);
  });
});
