import { z } from 'zod';

// Locations Config
const LocationConfigSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  toast_id: z.string().min(1, 'Toast ID is required'),
  doordash_id: z.string().min(1, 'DoorDash ID is required'),
  square_id: z.string().min(1, 'Square ID is required'),
});

export const LocationsConfigSchema = z.object({
  locations: z.array(LocationConfigSchema).min(1, 'At least one location is required'),
});

// Variation Patterns Config
const VariationPatternSchema = z.object({
  name: z.string().min(1, 'Pattern name is required'),
  regex: z.string().min(1, 'Regex pattern is required'),
  flags: z.string().optional(),
  type: z.enum(['quantity', 'size', 'serving', 'strength']),
  format: z.string().min(1, 'Format template is required'),
});

export const VariationPatternsConfigSchema = z.object({
  patterns: z.array(VariationPatternSchema).min(1, 'At least one pattern is required'),
  abbreviations: z.record(z.string(), z.string()),
});

// Product Groups Config
const ProductGroupSchema = z.object({
  base_name: z.string().min(1, 'base_name is required'),
  suffix: z.string().optional(),
  keywords: z.array(z.string()).optional(),
}).refine(
  (data) => data.suffix || (data.keywords && data.keywords.length > 0),
  { message: 'At least one of suffix or keywords must be provided' }
);

export const ProductGroupsConfigSchema = z.object({
  description: z.string().optional(),
  groups: z.array(ProductGroupSchema).min(1, 'At least one group is required'),
});

// Type exports
export type ProductGroup = z.infer<typeof ProductGroupSchema>;
export type ProductGroupsConfig = z.infer<typeof ProductGroupsConfigSchema>;
export type LocationConfig = z.infer<typeof LocationConfigSchema>;
export type LocationsConfig = z.infer<typeof LocationsConfigSchema>;
export type VariationPattern = z.infer<typeof VariationPatternSchema>;
export type VariationPatternsConfig = z.infer<typeof VariationPatternsConfigSchema>;
