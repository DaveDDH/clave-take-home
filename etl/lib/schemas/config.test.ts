import { describe, it, expect } from '@jest/globals';
import {
  LocationsConfigSchema,
  VariationPatternsConfigSchema,
  ProductGroupsConfigSchema,
} from './config.js';

describe('LocationsConfigSchema', () => {
  it('validates valid locations config', () => {
    const validConfig = {
      locations: [
        {
          name: 'Downtown',
          toast_id: 'toast-123',
          doordash_id: 'dd-456',
          square_id: 'sq-789',
        },
      ],
    };

    const result = LocationsConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('rejects empty locations array', () => {
    const invalidConfig = { locations: [] };
    const result = LocationsConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const invalidConfig = {
      locations: [{ name: 'Downtown', toast_id: 'toast-123' }],
    };
    const result = LocationsConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('rejects empty string for name', () => {
    const invalidConfig = {
      locations: [
        { name: '', toast_id: 'toast-123', doordash_id: 'dd-456', square_id: 'sq-789' },
      ],
    };
    const result = LocationsConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });
});

describe('VariationPatternsConfigSchema', () => {
  it('validates valid variation patterns config', () => {
    const validConfig = {
      patterns: [
        { name: 'quantity_pcs', regex: '(\\d+)\\s*pcs?', type: 'quantity', format: '{1} pcs' },
      ],
      abbreviations: { lg: 'Large', sm: 'Small' },
    };
    const result = VariationPatternsConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('allows optional flags in patterns', () => {
    const validConfig = {
      patterns: [
        { name: 'size_pattern', regex: '^(lg|sm)\\s+', flags: 'i', type: 'size', format: '{1}' },
      ],
      abbreviations: {},
    };
    const result = VariationPatternsConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('rejects empty patterns array', () => {
    const invalidConfig = { patterns: [], abbreviations: {} };
    const result = VariationPatternsConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('rejects invalid pattern type', () => {
    const invalidConfig = {
      patterns: [{ name: 'test', regex: 'test', type: 'invalid_type', format: '{1}' }],
      abbreviations: {},
    };
    const result = VariationPatternsConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('validates all valid pattern types', () => {
    const types = ['quantity', 'size', 'serving', 'strength'];
    for (const type of types) {
      const config = {
        patterns: [{ name: `${type}_pattern`, regex: 'test', type, format: '{1}' }],
        abbreviations: {},
      };
      const result = VariationPatternsConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    }
  });
});

describe('ProductGroupsConfigSchema', () => {
  it('validates valid product groups with suffix', () => {
    const validConfig = { groups: [{ base_name: 'Wings', suffix: 'wings' }] };
    const result = ProductGroupsConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('validates valid product groups with keywords', () => {
    const validConfig = {
      groups: [{ base_name: 'Coffee', keywords: ['coffee', 'espresso', 'latte'] }],
    };
    const result = ProductGroupsConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('validates product groups with both suffix and keywords', () => {
    const validConfig = {
      groups: [{ base_name: 'Wings', suffix: 'wings', keywords: ['buffalo', 'boneless'] }],
    };
    const result = ProductGroupsConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('allows optional description', () => {
    const validConfig = {
      description: 'Product groupings for the menu',
      groups: [{ base_name: 'Wings', suffix: 'wings' }],
    };
    const result = ProductGroupsConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('rejects groups without suffix or keywords', () => {
    const invalidConfig = { groups: [{ base_name: 'Wings' }] };
    const result = ProductGroupsConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('rejects empty groups array', () => {
    const invalidConfig = { groups: [] };
    const result = ProductGroupsConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('rejects empty keywords array', () => {
    const invalidConfig = { groups: [{ base_name: 'Wings', keywords: [] }] };
    const result = ProductGroupsConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });
});
