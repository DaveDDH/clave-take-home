-- Restaurant Analytics Database Schema

-- 1. Locations (unified across all sources)
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  address JSONB,
  timezone TEXT DEFAULT 'America/New_York',
  toast_id TEXT,
  doordash_id TEXT,
  square_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Categories (normalized, emoji-free)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

-- 3. Products (canonical product catalog)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Product Variations (sizes, quantities, etc.)
CREATE TABLE IF NOT EXISTS product_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variation_type TEXT, -- 'quantity', 'size', 'serving', 'strength'
  source_raw_name TEXT,
  UNIQUE(product_id, name)
);

-- 5. Product Aliases (map raw names to canonical products)
CREATE TABLE IF NOT EXISTS product_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  raw_name TEXT NOT NULL,
  source TEXT NOT NULL,
  UNIQUE(raw_name, source)
);

-- 6. Orders (unified from all sources)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_order_id TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id),
  order_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  subtotal_cents INT NOT NULL,
  tax_cents INT DEFAULT 0,
  tip_cents INT DEFAULT 0,
  total_cents INT NOT NULL,
  delivery_fee_cents INT DEFAULT 0,
  service_fee_cents INT DEFAULT 0,
  commission_cents INT DEFAULT 0,
  contains_alcohol BOOLEAN DEFAULT false,
  is_catering BOOLEAN DEFAULT false,
  UNIQUE(source, source_order_id)
);

-- 7. Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  variation_id UUID REFERENCES product_variations(id),
  original_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price_cents INT NOT NULL,
  total_price_cents INT NOT NULL,
  tax_cents INT DEFAULT 0,
  modifiers JSONB DEFAULT '[]',
  special_instructions TEXT
);

-- 8. Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  source_payment_id TEXT,
  payment_type TEXT NOT NULL,
  card_brand TEXT,
  last_four TEXT,
  amount_cents INT NOT NULL,
  tip_cents INT DEFAULT 0,
  processing_fee_cents INT DEFAULT 0,
  created_at TIMESTAMPTZ
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_location ON orders(location_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variation ON order_items(variation_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_product_variations_product ON product_variations(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_product_aliases_product ON product_aliases(product_id);
CREATE INDEX IF NOT EXISTS idx_product_aliases_raw ON product_aliases(raw_name, source);
