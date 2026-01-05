import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  ToastDataSchema,
  DoorDashDataSchema,
  SquareLocationsDataSchema,
  SquareCatalogDataSchema,
  SquareOrdersDataSchema,
  SquarePaymentsDataSchema,
} from './schemas.js';

// ============================================================================
// TYPES
// ============================================================================

export interface EnvConfig {
  DOORDASH_ORDERS_PATH: string;
  TOAST_POS_PATH: string;
  SQUARE_CATALOG_PATH: string;
  SQUARE_LOCATIONS_PATH: string;
  SQUARE_ORDERS_PATH: string;
  SQUARE_PAYMENTS_PATH: string;
}

export interface ValidationResult {
  success: boolean;
  errors: string[];
}

export interface PreprocessResult {
  success: boolean;
  error?: string;
  data?: PreprocessedData;
}

export interface LoadResult {
  success: boolean;
  error?: string;
}

export interface PreprocessedData {
  version: string;
  generated_at: string;
  sources: {
    toast: unknown;
    doordash: unknown;
    square: {
      locations: unknown;
      catalog: unknown;
      orders: unknown;
      payments: unknown;
    };
  };
  // Normalized/cleaned data will be added here
  normalized?: {
    locations: unknown[];
    categories: unknown[];
    products: unknown[];
    orders: unknown[];
    order_items: unknown[];
    payments: unknown[];
  };
}

// In-memory cache for preprocessed data between steps
let cachedPreprocessedData: PreprocessedData | null = null;

// ============================================================================
// VALIDATION
// ============================================================================

interface FileValidation {
  file: string;
  success: boolean;
  error?: string;
}

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

  return { success: true, errors: [] };
}

// ============================================================================
// PREPROCESSING
// ============================================================================

export async function runPreprocess(config: EnvConfig): Promise<PreprocessResult> {
  try {
    // Load all source data
    const toastData = JSON.parse(readFileSync(config.TOAST_POS_PATH, 'utf-8'));
    const doordashData = JSON.parse(readFileSync(config.DOORDASH_ORDERS_PATH, 'utf-8'));
    const squareLocations = JSON.parse(readFileSync(config.SQUARE_LOCATIONS_PATH, 'utf-8'));
    const squareCatalog = JSON.parse(readFileSync(config.SQUARE_CATALOG_PATH, 'utf-8'));
    const squareOrders = JSON.parse(readFileSync(config.SQUARE_ORDERS_PATH, 'utf-8'));
    const squarePayments = JSON.parse(readFileSync(config.SQUARE_PAYMENTS_PATH, 'utf-8'));

    // Create preprocessed data structure
    const preprocessedData: PreprocessedData = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      sources: {
        toast: toastData,
        doordash: doordashData,
        square: {
          locations: squareLocations,
          catalog: squareCatalog,
          orders: squareOrders,
          payments: squarePayments,
        },
      },
      // TODO: Add normalized data here
      // This is where we'll:
      // - Normalize product names (fix typos with Levenshtein)
      // - Strip emojis from categories
      // - Build canonical product list
      // - Map locations across sources
      // - Unify order formats
    };

    // Cache for later use
    cachedPreprocessedData = preprocessedData;

    return { success: true, data: preprocessedData };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during preprocessing',
    };
  }
}

// ============================================================================
// SAVE PREPROCESSED DATA
// ============================================================================

export async function savePreprocessedData(config: EnvConfig, outputPath: string): Promise<void> {
  if (!cachedPreprocessedData) {
    // If no cached data, run preprocessing first
    const result = await runPreprocess(config);
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to preprocess data');
    }
    cachedPreprocessedData = result.data;
  }

  const resolvedPath = resolve(outputPath);
  writeFileSync(resolvedPath, JSON.stringify(cachedPreprocessedData, null, 2));
}

// ============================================================================
// LOAD TO DATABASE
// ============================================================================

export async function loadToDatabase(preprocessedDataPath: string): Promise<LoadResult> {
  try {
    const resolvedPath = resolve(preprocessedDataPath);

    // Check if file exists
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
    if (!data.version || !data.sources) {
      return {
        success: false,
        error: 'Invalid preprocessed data file format',
      };
    }

    // Check for Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const connectionStr = process.env.SUPABASE_DB_CONNECTION_STR;

    if (!connectionStr && (!supabaseUrl || !supabaseKey)) {
      return {
        success: false,
        error: 'Missing database credentials. Set SUPABASE_DB_CONNECTION_STR or both SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file.',
      };
    }

    // TODO: Implement actual database loading
    // This will:
    // 1. Connect to Supabase
    // 2. Seed locations
    // 3. Load categories and products
    // 4. Load orders from all sources
    // 5. Load order items
    // 6. Load payments

    return {
      success: false,
      error: 'Database loading not yet implemented. Schema and connection ready.',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error loading to database',
    };
  }
}
