import type { NormalizedData } from '../preprocessor/index.js';

export interface EnvConfig {
  LOCATIONS_PATH: string;
  VARIATION_PATTERNS_PATH: string;
  PRODUCT_GROUPS_PATH: string;
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
  stats?: {
    locations: number;
    categories: number;
    products: number;
    product_variations: number;
    product_aliases: number;
    orders: number;
    order_items: number;
    payments: number;
  };
}

export interface PreprocessedData {
  version: string;
  generated_at: string;
  normalized: NormalizedData;
}

export interface FileValidation {
  file: string;
  success: boolean;
  error?: string;
}

export interface DataIntegrityResult {
  success: boolean;
  warnings: string[];
  summary: {
    sourceOrders: { toast: number; doordash: number; square: number; total: number };
    preprocessedOrders: number;
    sourcePayments: { toast: number; doordash: number; square: number; total: number };
    preprocessedPayments: number;
    ordersWithPayments: number;
    ordersWithoutPayments: number;
  };
}

export type LoadProgressCallback = (message: string) => void;
