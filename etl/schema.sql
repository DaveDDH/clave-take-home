-- Restaurant Analytics Database Schema
-- Generated from preprocessed data analysis

-- ENUM types for reusable constraints
DO $$ BEGIN
  CREATE TYPE source_platform AS ENUM ('toast', 'doordash', 'square');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1. Locations (unified across all sources)
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  address JSONB,
  timezone TEXT DEFAULT 'America/New_York',
  toast_id TEXT,
  doordash_id TEXT,
  square_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  raw_data JSONB -- Original source data for auditing
);

-- 2. Categories (normalized)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  raw_data JSONB -- Original source data for auditing
);

-- 3. Products (canonical product catalog)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  raw_data JSONB -- Original source data for auditing
);

-- 4. Product Variations (sizes, quantities, flavors)
CREATE TABLE IF NOT EXISTS product_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variation_type TEXT CHECK (variation_type IN ('quantity', 'size', 'serving', 'strength', 'semantic')),
  source_raw_name TEXT,
  raw_data JSONB, -- Original source data for auditing
  UNIQUE(product_id, name)
);

-- 5. Product Aliases (map raw names to canonical products)
CREATE TABLE IF NOT EXISTS product_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  raw_name TEXT NOT NULL,
  source source_platform NOT NULL,
  UNIQUE(raw_name, source)
);

-- 6. Orders (unified from all sources)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source source_platform NOT NULL,
  source_order_id TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id),
  order_type TEXT NOT NULL CHECK (order_type IN ('dine_in', 'takeout', 'pickup', 'delivery')),
  channel TEXT NOT NULL CHECK (channel IN ('pos', 'online', 'doordash', 'third_party')),
  status TEXT CHECK (status IN ('completed', 'delivered', 'picked_up', 'cancelled', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  subtotal_cents INT NOT NULL,
  tax_cents INT DEFAULT 0,
  tip_cents INT DEFAULT 0,
  total_cents INT NOT NULL,
  -- DoorDash-specific fields
  delivery_fee_cents INT DEFAULT 0,
  service_fee_cents INT DEFAULT 0,
  commission_cents INT DEFAULT 0,
  contains_alcohol BOOLEAN DEFAULT false,
  is_catering BOOLEAN DEFAULT false,
  -- Raw source data for auditing (not queried, just stored)
  raw_data JSONB,
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
  special_instructions TEXT,
  raw_data JSONB -- Original source data for auditing
);

-- 8. Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  source_payment_id TEXT,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('credit', 'cash', 'wallet', 'doordash', 'other')),
  card_brand TEXT CHECK (card_brand IN ('visa', 'mastercard', 'amex', 'discover', 'apple_pay', 'google_pay')),
  last_four TEXT,
  amount_cents INT NOT NULL,
  tip_cents INT DEFAULT 0,
  processing_fee_cents INT DEFAULT 0,
  created_at TIMESTAMPTZ,
  raw_data JSONB -- Original source data for auditing
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Orders: common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_location ON orders(location_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);

-- Order items: join and filter
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variation ON order_items(variation_id);

-- Products and variations
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_variations_product ON product_variations(product_id);

-- Aliases: lookup by raw name
CREATE INDEX IF NOT EXISTS idx_product_aliases_product ON product_aliases(product_id);
CREATE INDEX IF NOT EXISTS idx_product_aliases_raw ON product_aliases(raw_name, source);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- ============================================================================
-- CONVERSATIONS (for chat persistence)
-- ============================================================================

-- 9. Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  charts JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(conversation_id, created_at);
