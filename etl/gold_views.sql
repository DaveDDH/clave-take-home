-- Gold Layer Views for Restaurant Analytics
-- Pre-joined, pre-aggregated views optimized for LLM SQL generation
-- Run after schema.sql

-- ============================================================================
-- VIEW 1: gold.orders - Complete order data with location context
-- ============================================================================
-- Use for: Revenue analysis, order volume, location comparisons, time trends
-- Benefits: No JOINs needed, money in dollars, time dimensions pre-extracted

CREATE OR REPLACE VIEW gold_orders AS
SELECT
  -- Identifiers
  o.id AS order_id,
  o.source,
  o.source_order_id,
  o.channel,
  o.order_type,
  o.status,

  -- Timestamps
  o.created_at,
  o.closed_at,
  DATE(o.created_at) AS order_date,
  EXTRACT(HOUR FROM o.created_at)::INT AS order_hour,
  EXTRACT(DOW FROM o.created_at)::INT AS day_of_week,
  TO_CHAR(o.created_at, 'Day') AS day_name,

  -- Location (pre-joined)
  l.id AS location_id,
  l.name AS location_name,
  l.timezone,

  -- Money (converted to dollars)
  o.subtotal_cents / 100.0 AS subtotal,
  o.tax_cents / 100.0 AS tax,
  o.tip_cents / 100.0 AS tip,
  o.total_cents / 100.0 AS total,
  COALESCE(o.delivery_fee_cents, 0) / 100.0 AS delivery_fee,
  COALESCE(o.service_fee_cents, 0) / 100.0 AS service_fee,
  COALESCE(o.commission_cents, 0) / 100.0 AS commission,

  -- Calculated fields
  (o.total_cents - COALESCE(o.tax_cents, 0) - COALESCE(o.tip_cents, 0)) / 100.0 AS pretax_total,

  -- Flags
  o.contains_alcohol,
  o.is_catering

FROM orders o
LEFT JOIN locations l ON o.location_id = l.id
WHERE o.status IN ('completed', 'delivered', 'picked_up');

COMMENT ON VIEW gold_orders IS
'Pre-joined orders with locations. Money in dollars. Only completed orders. Use for revenue/volume analysis.';


-- ============================================================================
-- VIEW 2: gold.order_items - Items with full product hierarchy
-- ============================================================================
-- Use for: Product sales, category analysis, bestsellers, item rankings
-- Benefits: Products, categories, variations, and order context pre-joined

CREATE OR REPLACE VIEW gold_order_items AS
SELECT
  -- Item identifiers
  oi.id AS order_item_id,
  oi.order_id,
  oi.original_name AS raw_item_name,

  -- Product hierarchy
  p.id AS product_id,
  p.name AS product_name,
  c.name AS category_name,

  -- Variation
  pv.id AS variation_id,
  pv.name AS variation_name,
  pv.variation_type,

  -- Quantities and prices (dollars)
  oi.quantity,
  oi.unit_price_cents / 100.0 AS unit_price,
  oi.total_price_cents / 100.0 AS total_price,
  oi.tax_cents / 100.0 AS item_tax,

  -- Modifiers
  oi.modifiers,
  oi.special_instructions,

  -- Order context (from orders table)
  o.created_at AS order_created_at,
  DATE(o.created_at) AS order_date,
  EXTRACT(HOUR FROM o.created_at)::INT AS order_hour,
  o.source,
  o.channel,
  o.order_type,
  l.name AS location_name

FROM order_items oi
LEFT JOIN products p ON oi.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN product_variations pv ON oi.variation_id = pv.id
LEFT JOIN orders o ON oi.order_id = o.id
LEFT JOIN locations l ON o.location_id = l.id
WHERE o.status IN ('completed', 'delivered', 'picked_up');

COMMENT ON VIEW gold_order_items IS
'Order items with products, categories, variations, and order context. Money in dollars.';


-- ============================================================================
-- VIEW 3: gold.daily_sales - Daily aggregates by location
-- ============================================================================
-- Use for: Daily summaries, location comparisons, dashboard widgets
-- Benefits: Pre-aggregated, no GROUP BY needed for common queries

CREATE OR REPLACE VIEW gold_daily_sales AS
SELECT
  location_name,
  order_date,

  -- Volume
  COUNT(DISTINCT order_id) AS order_count,

  -- Revenue
  SUM(total) AS revenue,
  AVG(total) AS avg_order_value,

  -- By order type
  COUNT(DISTINCT CASE WHEN order_type = 'dine_in' THEN order_id END) AS dine_in_orders,
  COUNT(DISTINCT CASE WHEN order_type = 'delivery' THEN order_id END) AS delivery_orders,
  COUNT(DISTINCT CASE WHEN order_type IN ('takeout', 'pickup') THEN order_id END) AS takeout_orders,

  -- Revenue by type
  SUM(CASE WHEN order_type = 'dine_in' THEN total ELSE 0 END) AS dine_in_revenue,
  SUM(CASE WHEN order_type = 'delivery' THEN total ELSE 0 END) AS delivery_revenue,
  SUM(CASE WHEN order_type IN ('takeout', 'pickup') THEN total ELSE 0 END) AS takeout_revenue,

  -- By source (counts)
  COUNT(DISTINCT CASE WHEN source = 'toast' THEN order_id END) AS toast_orders,
  COUNT(DISTINCT CASE WHEN source = 'doordash' THEN order_id END) AS doordash_orders,
  COUNT(DISTINCT CASE WHEN source = 'square' THEN order_id END) AS square_orders,

  -- By source (revenue)
  SUM(CASE WHEN source = 'toast' THEN total ELSE 0 END) AS toast_revenue,
  SUM(CASE WHEN source = 'doordash' THEN total ELSE 0 END) AS doordash_revenue,
  SUM(CASE WHEN source = 'square' THEN total ELSE 0 END) AS square_revenue,

  -- Tips and fees
  SUM(tip) AS total_tips,
  SUM(delivery_fee) AS total_delivery_fees,
  SUM(commission) AS total_commission,
  SUM(tax) AS total_tax

FROM gold_orders
GROUP BY location_name, order_date;

COMMENT ON VIEW gold_daily_sales IS
'Daily aggregated metrics by location. Pre-computed for dashboard performance.';


-- ============================================================================
-- VIEW 4: gold.product_performance - Product-level analytics
-- ============================================================================
-- Use for: Top products, bestsellers, product rankings, category performance
-- Benefits: Pre-aggregated across all orders

CREATE OR REPLACE VIEW gold_product_performance AS
SELECT
  product_name,
  category_name,

  -- Sales metrics
  COUNT(DISTINCT order_id) AS orders_containing,
  SUM(quantity) AS total_units_sold,
  SUM(total_price) AS total_revenue,
  AVG(unit_price) AS avg_unit_price,

  -- Location spread
  COUNT(DISTINCT location_name) AS locations_sold_at,

  -- By order type
  SUM(CASE WHEN order_type = 'dine_in' THEN quantity ELSE 0 END) AS dine_in_units,
  SUM(CASE WHEN order_type = 'delivery' THEN quantity ELSE 0 END) AS delivery_units,
  SUM(CASE WHEN order_type IN ('takeout', 'pickup') THEN quantity ELSE 0 END) AS takeout_units,

  -- Time range
  MIN(order_created_at) AS first_sale,
  MAX(order_created_at) AS last_sale

FROM gold_order_items
WHERE product_name IS NOT NULL
GROUP BY product_name, category_name;

COMMENT ON VIEW gold_product_performance IS
'Product-level analytics aggregated across all orders. Use for rankings and bestsellers.';


-- ============================================================================
-- VIEW 5: gold.hourly_trends - Time-series by hour
-- ============================================================================
-- Use for: Hourly trends, peak hour analysis, day-of-week comparisons
-- Benefits: Pre-aggregated for time-series charts

CREATE OR REPLACE VIEW gold_hourly_trends AS
SELECT
  location_name,
  order_date,
  order_hour,
  day_of_week,
  day_name,

  -- Metrics
  COUNT(DISTINCT order_id) AS orders,
  SUM(total) AS revenue,
  AVG(total) AS avg_order_value,
  SUM(tip) AS tips,

  -- By channel
  COUNT(DISTINCT CASE WHEN channel = 'pos' THEN order_id END) AS pos_orders,
  COUNT(DISTINCT CASE WHEN channel = 'online' THEN order_id END) AS online_orders,
  COUNT(DISTINCT CASE WHEN channel = 'delivery_app' THEN order_id END) AS delivery_app_orders

FROM gold_orders
GROUP BY location_name, order_date, order_hour, day_of_week, day_name;

COMMENT ON VIEW gold_hourly_trends IS
'Hourly sales trends by location. Use for time-series analysis and peak hour detection.';


-- ============================================================================
-- VIEW 6: gold.category_performance - Category-level analytics by location
-- ============================================================================
-- Use for: Category rankings, menu analysis, category sales by location
-- Benefits: Pre-aggregated by category and location

CREATE OR REPLACE VIEW gold_category_performance AS
SELECT
  category_name,
  location_name,

  -- Product count
  COUNT(DISTINCT product_name) AS products_in_category,

  -- Sales metrics
  COUNT(DISTINCT order_id) AS orders_containing,
  SUM(quantity) AS total_units_sold,
  SUM(total_price) AS total_revenue,
  AVG(unit_price) AS avg_item_price,

  -- By source
  SUM(CASE WHEN source = 'toast' THEN total_price ELSE 0 END) AS toast_revenue,
  SUM(CASE WHEN source = 'doordash' THEN total_price ELSE 0 END) AS doordash_revenue,
  SUM(CASE WHEN source = 'square' THEN total_price ELSE 0 END) AS square_revenue

FROM gold_order_items
WHERE category_name IS NOT NULL
GROUP BY category_name, location_name;

COMMENT ON VIEW gold_category_performance IS
'Category-level analytics by location. Use for menu performance and category comparison across locations.';


-- ============================================================================
-- VIEW 7: gold.product_by_location - Product performance per location
-- ============================================================================
-- Use for: Top products at specific locations, location-specific bestsellers
-- Benefits: Pre-aggregated by product and location

CREATE OR REPLACE VIEW gold_product_by_location AS
SELECT
  product_name,
  category_name,
  location_name,

  -- Sales metrics
  COUNT(DISTINCT order_id) AS orders_containing,
  SUM(quantity) AS total_units_sold,
  SUM(total_price) AS total_revenue,
  AVG(unit_price) AS avg_unit_price,

  -- By order type
  SUM(CASE WHEN order_type = 'dine_in' THEN quantity ELSE 0 END) AS dine_in_units,
  SUM(CASE WHEN order_type = 'delivery' THEN quantity ELSE 0 END) AS delivery_units,
  SUM(CASE WHEN order_type IN ('takeout', 'pickup') THEN quantity ELSE 0 END) AS takeout_units

FROM gold_order_items
WHERE product_name IS NOT NULL
GROUP BY product_name, category_name, location_name;

COMMENT ON VIEW gold_product_by_location IS
'Product performance by location. Use for location-specific bestsellers and product rankings.';


-- ============================================================================
-- VIEW 8: gold.payments - Payment method analytics
-- ============================================================================
-- Use for: Payment method popularity, payment trends, card brand analysis
-- Benefits: Pre-aggregated payment data with location context

CREATE OR REPLACE VIEW gold_payments AS
SELECT
  p.payment_type,
  p.card_brand,
  l.name AS location_name,
  DATE(p.created_at) AS payment_date,

  -- Metrics
  COUNT(*) AS payment_count,
  SUM(p.amount_cents) / 100.0 AS total_amount,
  SUM(p.tip_cents) / 100.0 AS total_tips,
  AVG(p.amount_cents) / 100.0 AS avg_payment_amount,
  SUM(p.processing_fee_cents) / 100.0 AS total_processing_fees

FROM payments p
JOIN orders o ON p.order_id = o.id
JOIN locations l ON o.location_id = l.id
WHERE o.status IN ('completed', 'delivered', 'picked_up')
GROUP BY p.payment_type, p.card_brand, l.name, DATE(p.created_at);

COMMENT ON VIEW gold_payments IS
'Payment analytics by type, card brand, and location. Use for payment method analysis.';
