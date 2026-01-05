export const FULL_SCHEMA = `
# locations (id, name, address, timezone, toast_id, doordash_id, square_id, created_at)
# categories (id, name)
# products (id, name, category_id, description, created_at)
# product_variations (id, product_id, name, variation_type, source_raw_name)
# product_aliases (id, product_id, raw_name, source)
# orders (id, source, source_order_id, location_id, order_type, channel, status, created_at, closed_at, subtotal_cents, tax_cents, tip_cents, total_cents, delivery_fee_cents, service_fee_cents, commission_cents, contains_alcohol, is_catering)
# order_items (id, order_id, product_id, variation_id, original_name, quantity, unit_price_cents, total_price_cents, tax_cents, modifiers, special_instructions)
# payments (id, order_id, source_payment_id, payment_type, card_brand, last_four, amount_cents, tip_cents, processing_fee_cents, created_at)

Foreign keys:
# orders.location_id = locations.id
# order_items.order_id = orders.id
# order_items.product_id = products.id
# order_items.variation_id = product_variations.id
# products.category_id = categories.id
# product_variations.product_id = products.id
# payments.order_id = orders.id
`;

export const TABLE_DESCRIPTIONS: Record<string, string> = {
  locations: "Restaurant locations (Downtown, Airport, Mall, University)",
  categories: "Product categories (Burgers, Drinks, Desserts, Salads, etc.)",
  products: "Menu items/products with canonical names",
  product_variations: "Size/quantity variations of products (Small, Large, 10 pcs, etc.)",
  product_aliases: "Maps raw product names from each source to canonical products",
  orders: "Customer orders from all sources (toast, doordash, square)",
  order_items: "Individual line items within orders",
  payments: "Payment records for orders (credit, cash, wallet, etc.)",
};

export const COLUMN_INFO = {
  moneyColumns: [
    "subtotal_cents",
    "tax_cents",
    "tip_cents",
    "total_cents",
    "delivery_fee_cents",
    "service_fee_cents",
    "commission_cents",
    "unit_price_cents",
    "total_price_cents",
    "amount_cents",
    "processing_fee_cents",
  ],
  orderTypes: ["dine_in", "takeout", "pickup", "delivery"],
  channels: ["pos", "online", "doordash", "third_party"],
  sources: ["toast", "doordash", "square"],
  paymentTypes: ["credit", "cash", "wallet", "doordash", "other"],
};
