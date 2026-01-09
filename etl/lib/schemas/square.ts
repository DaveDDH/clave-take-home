import { z } from 'zod';

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

// Type exports
export type SquareLocationsData = z.infer<typeof SquareLocationsDataSchema>;
export type SquareLocation = z.infer<typeof SquareLocationSchema>;
export type SquareCatalogData = z.infer<typeof SquareCatalogDataSchema>;
export type SquareCatalogObject = z.infer<typeof SquareCatalogObjectSchema>;
export type SquareOrdersData = z.infer<typeof SquareOrdersDataSchema>;
export type SquareOrder = z.infer<typeof SquareOrderSchema>;
export type SquarePaymentsData = z.infer<typeof SquarePaymentsDataSchema>;
export type SquarePayment = z.infer<typeof SquarePaymentSchema>;
