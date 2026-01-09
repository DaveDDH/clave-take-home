import { readFileSync } from 'fs';
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
} from '../schemas/index.js';
import { initializePatterns } from '../variation-patterns.js';
import { initializeProductGroups } from '../product-groups.js';
import type { EnvConfig, ValidationResult, FileValidation } from './types.js';

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
