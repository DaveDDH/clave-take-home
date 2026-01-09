import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preprocessData, SourceData } from '../preprocessor/index.js';
import type {
  ToastData,
  DoorDashData,
  SquareLocationsData,
  SquareCatalogData,
  SquareOrdersData,
  SquarePaymentsData,
  LocationsConfig,
} from '../types.js';
import type { EnvConfig, PreprocessResult, PreprocessedData } from './types.js';

// In-memory cache for preprocessed data between steps
let cachedPreprocessedData: PreprocessedData | null = null;

// Cached source data for integrity checks
let cachedSourceData: SourceData | null = null;

/**
 * Get cached source data (available after runPreprocess)
 */
export function getCachedSourceData(): SourceData | null {
  return cachedSourceData;
}

/**
 * Get cached preprocessed data (available after runPreprocess)
 */
export function getCachedPreprocessedData(): PreprocessedData | null {
  return cachedPreprocessedData;
}

export async function runPreprocess(config: EnvConfig): Promise<PreprocessResult> {
  try {
    // Load locations config
    const locationsConfig: LocationsConfig = JSON.parse(readFileSync(config.LOCATIONS_PATH, 'utf-8'));

    // Load all source data
    const toastData: ToastData = JSON.parse(readFileSync(config.TOAST_POS_PATH, 'utf-8'));
    const doordashData: DoorDashData = JSON.parse(readFileSync(config.DOORDASH_ORDERS_PATH, 'utf-8'));
    const squareLocations: SquareLocationsData = JSON.parse(readFileSync(config.SQUARE_LOCATIONS_PATH, 'utf-8'));
    const squareCatalog: SquareCatalogData = JSON.parse(readFileSync(config.SQUARE_CATALOG_PATH, 'utf-8'));
    const squareOrders: SquareOrdersData = JSON.parse(readFileSync(config.SQUARE_ORDERS_PATH, 'utf-8'));
    const squarePayments: SquarePaymentsData = JSON.parse(readFileSync(config.SQUARE_PAYMENTS_PATH, 'utf-8'));

    // Build source data structure
    const sources: SourceData = {
      toast: toastData,
      doordash: doordashData,
      square: {
        locations: squareLocations,
        catalog: squareCatalog,
        orders: squareOrders,
        payments: squarePayments,
      },
    };

    // Cache source data for integrity checks
    cachedSourceData = sources;

    // Run normalization with configurable locations
    const normalized = preprocessData(sources, locationsConfig.locations);

    // Create preprocessed data structure (normalized only, no raw sources)
    const preprocessedData: PreprocessedData = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      normalized,
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
