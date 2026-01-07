export const FULL_SCHEMA = `
=== GOLD LAYER (USE THESE FIRST - Pre-joined, optimized for analytics) ===

# gold_orders (order_id, source, source_order_id, channel, order_type, status, created_at, closed_at, order_date, order_hour, day_of_week, day_name, location_id, location_name, timezone, subtotal, tax, tip, total, delivery_fee, service_fee, commission, pretax_total, contains_alcohol, is_catering)
  → Pre-joined orders + locations. Money already in DOLLARS. Only completed orders. Use for revenue/volume analysis.

# gold_order_items (order_item_id, order_id, raw_item_name, product_id, product_name, category_name, variation_id, variation_name, variation_type, quantity, unit_price, total_price, item_tax, modifiers, special_instructions, order_created_at, order_date, order_hour, source, channel, order_type, location_name)
  → Pre-joined items + products + categories + variations + orders. Money in DOLLARS. Use for product/category analysis.

# gold_daily_sales (location_name, order_date, order_count, revenue, avg_order_value, dine_in_orders, delivery_orders, takeout_orders, dine_in_revenue, delivery_revenue, takeout_revenue, toast_orders, doordash_orders, square_orders, toast_revenue, doordash_revenue, square_revenue, total_tips, total_delivery_fees, total_commission, total_tax)
  → Pre-aggregated daily metrics by location. Use for dashboards, daily summaries, and revenue by source (DoorDash, Toast, Square).

# gold_product_performance (product_name, category_name, orders_containing, total_units_sold, total_revenue, avg_unit_price, locations_sold_at, dine_in_units, delivery_units, takeout_units, first_sale, last_sale)
  → Pre-aggregated product analytics. Use for top products, bestsellers, rankings.

# gold_hourly_trends (location_name, order_date, order_hour, day_of_week, day_name, orders, revenue, avg_order_value, tips, pos_orders, online_orders, doordash_orders)
  → Pre-aggregated hourly data. Use for time-series, peak hours, day comparisons.

# gold_category_performance (category_name, location_name, products_in_category, orders_containing, total_units_sold, total_revenue, avg_item_price, toast_revenue, doordash_revenue, square_revenue)
  → Pre-aggregated category analytics by location. Use for menu performance and category comparison across locations.

# gold_product_by_location (product_name, category_name, location_name, orders_containing, total_units_sold, total_revenue, avg_unit_price, dine_in_units, delivery_units, takeout_units)
  → Product performance by location. Use for "top selling items at X location" queries.

# gold_payments (payment_type, card_brand, location_name, payment_date, payment_count, total_amount, total_tips, avg_payment_amount, total_processing_fees)
  → Payment analytics by type, card brand, and location. Use for "which payment methods are most popular" queries.

=== SILVER LAYER (Use only when Gold views don't have needed fields) ===

# locations (id, name, address, timezone, toast_id, doordash_id, square_id, created_at)
# categories (id, name)
# products (id, name, category_id, description, created_at)
# product_variations (id, product_id, name, variation_type, source_raw_name)
# product_aliases (id, product_id, raw_name, source)
# orders (id, source, source_order_id, location_id, order_type, channel, status, created_at, closed_at, subtotal_cents, tax_cents, tip_cents, total_cents, delivery_fee_cents, service_fee_cents, commission_cents, contains_alcohol, is_catering)
# order_items (id, order_id, product_id, variation_id, original_name, quantity, unit_price_cents, total_price_cents, tax_cents, modifiers, special_instructions)
# payments (id, order_id, source_payment_id, payment_type, card_brand, last_four, amount_cents, tip_cents, processing_fee_cents, created_at)

Foreign keys (Silver layer):
# orders.location_id = locations.id
# order_items.order_id = orders.id
# order_items.product_id = products.id
# order_items.variation_id = product_variations.id
# products.category_id = categories.id
# product_variations.product_id = products.id
# payments.order_id = orders.id
`;

export const TABLE_DESCRIPTIONS: Record<string, string> = {
  locations: "Restaurant locations. Exact names: 'Downtown', 'Airport', 'Mall Location', 'University'",
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
