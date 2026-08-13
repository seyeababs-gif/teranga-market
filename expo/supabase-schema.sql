-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  phone TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  location TEXT,
  type TEXT DEFAULT 'standard' CHECK (type IN ('standard', 'premium')),
  is_admin BOOLEAN DEFAULT FALSE,
  email TEXT,
  bio TEXT,
  rating DECIMAL(2,1),
  review_count INTEGER DEFAULT 0,
  joined_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  premium_payment_pending BOOLEAN DEFAULT FALSE,
  premium_request_date TIMESTAMP WITH TIME ZONE,
  delivery_address TEXT,
  delivery_city TEXT,
  delivery_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  images TEXT[] NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT,
  location TEXT NOT NULL,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_name TEXT NOT NULL,
  seller_avatar TEXT,
  seller_phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  condition TEXT CHECK (condition IN ('new', 'used', 'refurbished')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT,
  average_rating DECIMAL(2,1),
  review_count INTEGER DEFAULT 0,
  listing_type TEXT DEFAULT 'product' CHECK (listing_type IN ('product', 'service')),
  service_details JSONB,
  stock_quantity INTEGER,
  is_out_of_stock BOOLEAN DEFAULT FALSE,
  has_discount BOOLEAN DEFAULT FALSE,
  discount_percent INTEGER,
  original_price DECIMAL(10,2),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table (using user_id, not buyer_id)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'validated', 'rejected', 'shipped', 'completed')),
  payment_method TEXT DEFAULT 'wave',
  wave_transaction_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  validated_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  shipped_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  has_review BOOLEAN DEFAULT FALSE,
  delivery_name TEXT NOT NULL,
  delivery_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_city TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_product_id ON messages(product_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Anyone can create user" ON users;
DROP POLICY IF EXISTS "Anyone can view approved products" ON products;
DROP POLICY IF EXISTS "Users can create products" ON products;
DROP POLICY IF EXISTS "Users can update own products" ON products;
DROP POLICY IF EXISTS "Users can delete own products" ON products;
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Users can update orders" ON orders;
DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
DROP POLICY IF EXISTS "Users can create reviews for own orders" ON reviews;
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can create messages" ON messages;
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can manage own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can delete own favorites" ON favorites;

-- RLS Policies for users
CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (
  auth.uid()::text = id OR 
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true
);
CREATE POLICY "Anyone can create user" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can delete users" ON users FOR DELETE USING (
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true
);

-- RLS Policies for products
CREATE POLICY "Users can view products" ON products FOR SELECT USING (
  status = 'approved' OR 
  seller_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true
);
CREATE POLICY "Users can create products" ON products FOR INSERT WITH CHECK (seller_id = auth.uid()::text);
CREATE POLICY "Users can update products" ON products FOR UPDATE USING (
  seller_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true
);
CREATE POLICY "Users can delete products" ON products FOR DELETE USING (
  seller_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true
);

-- RLS Policies for orders
CREATE POLICY "Users can view related orders" ON orders FOR SELECT USING (
  user_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true
);
CREATE POLICY "Users can create orders" ON orders FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "Users and admins can update orders" ON orders FOR UPDATE USING (
  user_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true
);

-- RLS Policies for reviews
CREATE POLICY "Anyone can view reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews for own orders" ON reviews FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- RLS Policies for messages
CREATE POLICY "Users can view own messages" ON messages FOR SELECT USING (sender_id = auth.uid()::text OR receiver_id = auth.uid()::text);
CREATE POLICY "Users can create messages" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid()::text);

-- RLS Policies for favorites
CREATE POLICY "Users can view own favorites" ON favorites FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "Users can manage own favorites" ON favorites FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "Users can delete own favorites" ON favorites FOR DELETE USING (user_id = auth.uid()::text);
