// Locations config type
export interface LocationConfig {
  name: string;
  toast_id: string;
  doordash_id: string;
  square_id: string;
}

export interface LocationsConfig {
  locations: LocationConfig[];
}

// Database types (matching schema.sql)
export interface DbLocation {
  id?: string;
  name: string;
  address?: Record<string, unknown>;
  timezone?: string;
  toast_id?: string;
  doordash_id?: string;
  square_id?: string;
}

export interface DbCategory {
  id?: string;
  name: string;
}

export interface DbProduct {
  id?: string;
  name: string;
  category_id?: string;
  description?: string;
}

export interface DbProductVariation {
  id?: string;
  product_id: string;
  name: string;
  variation_type?: 'quantity' | 'size' | 'serving' | 'strength';
  source_raw_name?: string;
}

export interface DbProductAlias {
  id?: string;
  product_id: string;
  raw_name: string;
  source: string;
}

export interface DbOrder {
  id?: string;
  source: string;
  source_order_id: string;
  location_id: string;
  order_type: string;
  channel: string;
  status?: string;
  created_at: string;
  closed_at?: string;
  subtotal_cents: number;
  tax_cents?: number;
  tip_cents?: number;
  total_cents: number;
  delivery_fee_cents?: number;
  service_fee_cents?: number;
  commission_cents?: number;
  contains_alcohol?: boolean;
  is_catering?: boolean;
}

export interface DbOrderItem {
  id?: string;
  order_id: string;
  product_id?: string;
  variation_id?: string;
  original_name: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  tax_cents?: number;
  modifiers?: unknown[];
  special_instructions?: string;
}

export interface DbPayment {
  id?: string;
  order_id: string;
  source_payment_id?: string;
  payment_type: string;
  card_brand?: string;
  last_four?: string;
  amount_cents: number;
  tip_cents?: number;
  processing_fee_cents?: number;
  created_at?: string;
}

// Toast POS types
export interface ToastLocation {
  guid: string;
  name: string;
  address: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  timezone: string;
}

export interface ToastSelection {
  guid: string;
  displayName: string;
  itemGroup?: {
    guid: string;
    name: string;
  };
  item?: {
    guid: string;
    name: string;
  };
  quantity: number;
  preDiscountPrice: number;
  price: number;
  tax: number;
  voided: boolean;
  modifiers: Array<{
    guid: string;
    displayName: string;
    price: number;
  }>;
}

export interface ToastPayment {
  guid: string;
  paidDate: string;
  type: string;
  cardType?: string;
  last4Digits?: string;
  amount: number;
  tipAmount: number;
  originalProcessingFee: number;
  refundStatus: string;
}

export interface ToastCheck {
  guid: string;
  displayNumber: string;
  openedDate: string;
  closedDate: string;
  paidDate: string;
  voided: boolean;
  deleted: boolean;
  selections: ToastSelection[];
  payments: ToastPayment[];
  amount: number;
  taxAmount: number;
  totalAmount: number;
  tipAmount: number;
}

export interface ToastOrder {
  guid: string;
  restaurantGuid: string;
  businessDate: string;
  openedDate: string;
  closedDate: string;
  paidDate: string;
  voided: boolean;
  deleted: boolean;
  diningOption: {
    guid: string;
    name: string;
    behavior: string;
  };
  checks: ToastCheck[];
  source: string;
}

export interface ToastData {
  restaurant: {
    guid: string;
    name: string;
  };
  locations: ToastLocation[];
  orders: ToastOrder[];
}

// DoorDash types
export interface DoorDashStore {
  store_id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
  };
  timezone: string;
}

export interface DoorDashOrderItem {
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions: string;
  options: Array<{ name: string; price: number }>;
  category: string;
}

export interface DoorDashOrder {
  external_delivery_id: string;
  store_id: string;
  order_fulfillment_method: string;
  order_status: string;
  created_at: string;
  pickup_time: string;
  delivery_time?: string | null;
  order_items: DoorDashOrderItem[];
  order_subtotal: number;
  delivery_fee: number;
  service_fee: number;
  dasher_tip: number;
  tax_amount: number;
  total_charged_to_consumer: number;
  commission: number;
  merchant_payout: number;
  contains_alcohol: boolean;
  is_catering: boolean;
}

export interface DoorDashData {
  merchant: {
    merchant_id: string;
    business_name: string;
    currency: string;
  };
  stores: DoorDashStore[];
  orders: DoorDashOrder[];
}

// Square types
export interface SquareLocation {
  id: string;
  name: string;
  address: {
    address_line_1: string;
    locality: string;
    administrative_district_level_1: string;
    postal_code: string;
    country: string;
  };
  timezone: string;
  status: string;
  type: string;
  merchant_id: string;
}

export interface SquareItemVariation {
  type: string;
  id: string;
  item_variation_data: {
    item_id: string;
    name: string;
    pricing_type: string;
    price_money: { amount: number; currency: string };
  };
}

export interface SquareCatalogItem {
  type: string;
  id: string;
  present_at_location_ids?: string[];
  item_data?: {
    name: string;
    description?: string;
    category_id?: string;
    variations: SquareItemVariation[];
  };
  category_data?: {
    name: string;
  };
}

export interface SquareCatalogData {
  objects: SquareCatalogItem[];
}

export interface SquareLineItem {
  uid: string;
  catalog_object_id: string;
  quantity: string;
  item_type: string;
  gross_sales_money: { amount: number; currency: string };
  total_money: { amount: number; currency: string };
  applied_modifiers?: Array<{ modifier_id: string }>;
}

export interface SquareOrder {
  id: string;
  location_id: string;
  reference_id: string;
  source: { name: string };
  created_at: string;
  updated_at: string;
  closed_at: string;
  state: string;
  line_items: SquareLineItem[];
  fulfillments: Array<{ uid: string; type: string; state: string }>;
  total_money: { amount: number; currency: string };
  total_tax_money: { amount: number; currency: string };
  total_tip_money: { amount: number; currency: string };
}

export interface SquareOrdersData {
  orders: SquareOrder[];
}

export interface SquarePayment {
  id: string;
  order_id: string;
  location_id: string;
  created_at: string;
  amount_money: { amount: number; currency: string };
  tip_money: { amount: number; currency: string };
  total_money: { amount: number; currency: string };
  status: string;
  source_type: string;
  card_details?: {
    status: string;
    card: {
      card_brand: string;
      last_4: string;
    };
    entry_method: string;
  };
  cash_details?: {
    buyer_supplied_money: { amount: number; currency: string };
    change_back_money: { amount: number; currency: string };
  };
  wallet_details?: {
    status: string;
    brand: string;
  };
}

export interface SquarePaymentsData {
  payments: SquarePayment[];
}

export interface SquareLocationsData {
  locations: SquareLocation[];
}
