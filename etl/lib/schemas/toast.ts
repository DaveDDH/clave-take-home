import { z } from 'zod';

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

// Type exports
export type ToastData = z.infer<typeof ToastDataSchema>;
export type ToastOrder = z.infer<typeof ToastOrderSchema>;
export type ToastCheck = z.infer<typeof ToastCheckSchema>;
export type ToastSelection = z.infer<typeof ToastSelectionSchema>;
export type ToastPayment = z.infer<typeof ToastPaymentSchema>;
export type ToastLocation = z.infer<typeof ToastLocationSchema>;
