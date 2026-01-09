import { z } from 'zod';

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

// Type exports
export type DoorDashData = z.infer<typeof DoorDashDataSchema>;
export type DoorDashOrder = z.infer<typeof DoorDashOrderSchema>;
export type DoorDashOrderItem = z.infer<typeof DoorDashOrderItemSchema>;
export type DoorDashStore = z.infer<typeof DoorDashStoreSchema>;
