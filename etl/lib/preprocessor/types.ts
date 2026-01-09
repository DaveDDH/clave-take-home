import type {
  DbLocation,
  DbCategory,
  DbProduct,
  DbProductVariation,
  DbProductAlias,
  DbOrder,
  DbOrderItem,
  DbPayment,
  ToastData,
  DoorDashData,
  SquareCatalogData,
  SquareOrdersData,
  SquarePaymentsData,
  SquareLocationsData,
} from '../types.js';

export interface NormalizedData {
  locations: Array<DbLocation & { id: string }>;
  categories: Array<DbCategory & { id: string }>;
  products: Array<DbProduct & { id: string }>;
  product_variations: Array<DbProductVariation & { id: string }>;
  product_aliases: Array<DbProductAlias & { id: string }>;
  orders: Array<DbOrder & { id: string }>;
  order_items: Array<DbOrderItem & { id: string }>;
  payments: Array<DbPayment & { id: string }>;
}

export interface SourceData {
  toast: ToastData;
  doordash: DoorDashData;
  square: {
    locations: SquareLocationsData;
    catalog: SquareCatalogData;
    orders: SquareOrdersData;
    payments: SquarePaymentsData;
  };
}

// Raw item from any source
export interface RawProductItem {
  source: 'square' | 'toast' | 'doordash';
  sourceId?: string;
  originalName: string;
  baseName: string;
  extractedVariation?: string;
  extractedVariationType?: 'quantity' | 'size' | 'serving' | 'strength' | 'semantic';
  categoryId?: string;
  categoryName?: string;
  description?: string;
  squareVariations?: Array<{ id: string; name: string }>;
}

export interface ProductGroupResult {
  canonicalName: string;
  categoryId?: string;
  description?: string;
  items: RawProductItem[];
}

export interface CatalogResult {
  categories: Array<DbCategory & { id: string }>;
  products: Array<DbProduct & { id: string }>;
  product_variations: Array<DbProductVariation & { id: string }>;
  productMap: Map<string, string>;
  categoryMap: Map<string, string>;
  variationMap: Map<string, string>;
}

export interface OrdersResult {
  orders: Array<DbOrder & { id: string }>;
  items: Array<DbOrderItem & { id: string }>;
  payments: Array<DbPayment & { id: string }>;
}

export type AddAliasFunction = (productId: string, rawName: string, source: string) => void;
