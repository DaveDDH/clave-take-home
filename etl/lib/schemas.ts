import { z } from 'zod';

// ============================================================================
// TOAST POS SCHEMA
// ============================================================================

const ToastModifierSchema = z.object({
  guid: z.string(),
  entityType: z.string(),
  displayName: z.string(),
  price: z.number(),
});

const ToastSelectionSchema = z.object({
  guid: z.string(),
  entityType: z.string(),
  displayName: z.string(),
  itemGroup: z.object({
    guid: z.string(),
    name: z.string(),
    entityType: z.string(),
  }),
  item: z.object({
    guid: z.string(),
    name: z.string(),
    entityType: z.string(),
  }),
  quantity: z.number(),
  preDiscountPrice: z.number(),
  price: z.number(),
  tax: z.number(),
  voided: z.boolean(),
  modifiers: z.array(ToastModifierSchema),
});

const ToastPaymentSchema = z.object({
  guid: z.string(),
  entityType: z.string(),
  paidDate: z.string(),
  paidBusinessDate: z.string(),
  type: z.string(),
  cardType: z.string().nullable(),
  last4Digits: z.string().nullable(),
  amount: z.number(),
  tipAmount: z.number(),
  originalProcessingFee: z.number(),
  refundStatus: z.string(),
});

const ToastCheckSchema = z.object({
  guid: z.string(),
  entityType: z.string(),
  displayNumber: z.string(),
  openedDate: z.string(),
  closedDate: z.string(),
  paidDate: z.string(),
  voided: z.boolean(),
  deleted: z.boolean(),
  selections: z.array(ToastSelectionSchema),
  payments: z.array(ToastPaymentSchema),
  amount: z.number(),
  taxAmount: z.number(),
  totalAmount: z.number(),
  tipAmount: z.number(),
});

const ToastOrderSchema = z.object({
  guid: z.string(),
  entityType: z.string(),
  externalId: z.string().nullable(),
  revenueCenter: z.object({
    guid: z.string(),
    name: z.string(),
    entityType: z.string(),
  }),
  server: z.object({
    guid: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    entityType: z.string(),
  }),
  restaurantGuid: z.string(),
  businessDate: z.string(),
  openedDate: z.string(),
  closedDate: z.string(),
  paidDate: z.string(),
  voided: z.boolean(),
  deleted: z.boolean(),
  diningOption: z.object({
    guid: z.string(),
    name: z.string(),
    behavior: z.string(),
    entityType: z.string(),
  }),
  checks: z.array(ToastCheckSchema),
  source: z.string(),
  voidDate: z.string().nullable(),
  voidBusinessDate: z.string().nullable(),
});

const ToastLocationSchema = z.object({
  guid: z.string(),
  name: z.string(),
  address: z.object({
    line1: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
  }),
  timezone: z.string(),
});

export const ToastDataSchema = z.object({
  restaurant: z.object({
    guid: z.string(),
    name: z.string(),
    managementGroupGuid: z.string(),
  }),
  locations: z.array(ToastLocationSchema),
  orders: z.array(ToastOrderSchema),
});

// ============================================================================
// DOORDASH SCHEMA
// ============================================================================

const DoorDashOptionSchema = z.object({
  name: z.string(),
  price: z.number(),
});

const DoorDashOrderItemSchema = z.object({
  item_id: z.string(),
  name: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  total_price: z.number(),
  special_instructions: z.string(),
  options: z.array(DoorDashOptionSchema),
  category: z.string(),
});

const DoorDashOrderSchema = z.object({
  external_delivery_id: z.string(),
  store_id: z.string(),
  order_fulfillment_method: z.string(),
  order_status: z.string(),
  created_at: z.string(),
  pickup_time: z.string(),
  delivery_time: z.string().nullable(),
  order_items: z.array(DoorDashOrderItemSchema),
  order_subtotal: z.number(),
  delivery_fee: z.number(),
  service_fee: z.number(),
  dasher_tip: z.number(),
  tax_amount: z.number(),
  total_charged_to_consumer: z.number(),
  commission: z.number(),
  merchant_payout: z.number(),
  contains_alcohol: z.boolean(),
  is_catering: z.boolean(),
});

const DoorDashStoreSchema = z.object({
  store_id: z.string(),
  name: z.string(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip_code: z.string(),
    country: z.string(),
  }),
  timezone: z.string(),
});

export const DoorDashDataSchema = z.object({
  merchant: z.object({
    merchant_id: z.string(),
    business_name: z.string(),
    currency: z.string(),
  }),
  stores: z.array(DoorDashStoreSchema),
  orders: z.array(DoorDashOrderSchema),
});

// ============================================================================
// SQUARE SCHEMAS
// ============================================================================

// Square Locations
const SquareLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.object({
    address_line_1: z.string(),
    locality: z.string(),
    administrative_district_level_1: z.string(),
    postal_code: z.string(),
    country: z.string(),
  }),
  timezone: z.string(),
  status: z.string(),
  type: z.string(),
  merchant_id: z.string(),
});

export const SquareLocationsDataSchema = z.object({
  locations: z.array(SquareLocationSchema),
});

// Square Catalog
const SquareMoneySchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

const SquareItemVariationDataSchema = z.object({
  item_id: z.string(),
  name: z.string(),
  pricing_type: z.string(),
  price_money: SquareMoneySchema,
});

const SquareItemVariationSchema = z.object({
  type: z.literal('ITEM_VARIATION'),
  id: z.string(),
  item_variation_data: SquareItemVariationDataSchema,
});

const SquareItemDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  category_id: z.string().optional(),
  variations: z.array(SquareItemVariationSchema),
});

const SquareCategoryDataSchema = z.object({
  name: z.string(),
});

const SquareModifierDataSchema = z.object({
  name: z.string(),
  price_money: SquareMoneySchema.optional(),
});

const SquareCatalogObjectSchema = z.object({
  type: z.string(),
  id: z.string(),
  present_at_location_ids: z.array(z.string()).optional(),
  item_data: SquareItemDataSchema.optional(),
  category_data: SquareCategoryDataSchema.optional(),
  modifier_data: SquareModifierDataSchema.optional(),
});

export const SquareCatalogDataSchema = z.object({
  objects: z.array(SquareCatalogObjectSchema),
});

// Square Orders
const SquareAppliedModifierSchema = z.object({
  modifier_id: z.string(),
});

const SquareLineItemSchema = z.object({
  uid: z.string(),
  catalog_object_id: z.string(),
  quantity: z.string(),
  item_type: z.string(),
  gross_sales_money: SquareMoneySchema,
  total_money: SquareMoneySchema,
  applied_modifiers: z.array(SquareAppliedModifierSchema).optional(),
});

const SquareFulfillmentSchema = z.object({
  uid: z.string(),
  type: z.string(),
  state: z.string(),
});

const SquareOrderSchema = z.object({
  id: z.string(),
  location_id: z.string(),
  reference_id: z.string(),
  source: z.object({
    name: z.string(),
  }),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string(),
  state: z.string(),
  version: z.number(),
  line_items: z.array(SquareLineItemSchema),
  fulfillments: z.array(SquareFulfillmentSchema),
  total_money: SquareMoneySchema,
  total_tax_money: SquareMoneySchema,
  total_tip_money: SquareMoneySchema,
});

export const SquareOrdersDataSchema = z.object({
  orders: z.array(SquareOrderSchema),
  cursor: z.string().nullable(),
});

// Square Payments
const SquareCardSchema = z.object({
  card_brand: z.string(),
  last_4: z.string(),
  exp_month: z.number().optional(),
  exp_year: z.number().optional(),
});

const SquareCardDetailsSchema = z.object({
  status: z.string(),
  card: SquareCardSchema,
  entry_method: z.string(),
});

const SquareCashDetailsSchema = z.object({
  buyer_supplied_money: SquareMoneySchema,
  change_back_money: SquareMoneySchema,
});

const SquareWalletDetailsSchema = z.object({
  status: z.string(),
  brand: z.string(),
});

const SquarePaymentSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  location_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  amount_money: SquareMoneySchema,
  tip_money: SquareMoneySchema,
  total_money: SquareMoneySchema,
  status: z.string(),
  source_type: z.string(),
  card_details: SquareCardDetailsSchema.optional(),
  cash_details: SquareCashDetailsSchema.optional(),
  wallet_details: SquareWalletDetailsSchema.optional(),
});

export const SquarePaymentsDataSchema = z.object({
  payments: z.array(SquarePaymentSchema),
  cursor: z.string().nullable(),
});

// ============================================================================
// TYPE EXPORTS (inferred from schemas)
// ============================================================================

export type ToastData = z.infer<typeof ToastDataSchema>;
export type ToastOrder = z.infer<typeof ToastOrderSchema>;
export type ToastCheck = z.infer<typeof ToastCheckSchema>;
export type ToastSelection = z.infer<typeof ToastSelectionSchema>;
export type ToastPayment = z.infer<typeof ToastPaymentSchema>;
export type ToastLocation = z.infer<typeof ToastLocationSchema>;

export type DoorDashData = z.infer<typeof DoorDashDataSchema>;
export type DoorDashOrder = z.infer<typeof DoorDashOrderSchema>;
export type DoorDashOrderItem = z.infer<typeof DoorDashOrderItemSchema>;
export type DoorDashStore = z.infer<typeof DoorDashStoreSchema>;

export type SquareLocationsData = z.infer<typeof SquareLocationsDataSchema>;
export type SquareLocation = z.infer<typeof SquareLocationSchema>;
export type SquareCatalogData = z.infer<typeof SquareCatalogDataSchema>;
export type SquareCatalogObject = z.infer<typeof SquareCatalogObjectSchema>;
export type SquareOrdersData = z.infer<typeof SquareOrdersDataSchema>;
export type SquareOrder = z.infer<typeof SquareOrderSchema>;
export type SquarePaymentsData = z.infer<typeof SquarePaymentsDataSchema>;
export type SquarePayment = z.infer<typeof SquarePaymentSchema>;
