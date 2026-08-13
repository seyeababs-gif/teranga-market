-- =====================================================
-- RECONSTRUCTION COMPLÈTE DE LA BASE DE DONNÉES
-- Marketplace Application - Version Propre et Optimisée
-- =====================================================

-- Nettoyer tout d'abord
DROP TABLE IF EXISTS partner_commission_payments CASCADE;
DROP TABLE IF EXISTS partner_referred_clients CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS discount_codes CASCADE;
DROP TABLE IF EXISTS announcement_banners CASCADE;
DROP TABLE IF EXISTS global_premium_mode CASCADE;
DROP TABLE IF EXISTS global_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP FUNCTION IF EXISTS get_active_banners() CASCADE;
DROP FUNCTION IF EXISTS is_global_premium_active() CASCADE;
DROP FUNCTION IF EXISTS get_active_user_partners() CASCADE;
DROP FUNCTION IF EXISTS get_partner_stats(text) CASCADE;
DROP FUNCTION IF EXISTS get_partner_referred_clients(text) CASCADE;
DROP FUNCTION IF EXISTS get_partner_client_details(text, text) CASCADE;
DROP FUNCTION IF EXISTS update_partner_referral_code(text, text) CASCADE;
DROP FUNCTION IF EXISTS exec_sql(text) CASCADE;

-- =====================================================
-- TABLE: users
-- =====================================================
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  avatar TEXT,
  location TEXT,
  type TEXT DEFAULT 'standard' CHECK (type IN ('standard', 'premium')),
  is_admin BOOLEAN DEFAULT false,
  is_super_admin BOOLEAN DEFAULT false,
  is_partner BOOLEAN DEFAULT false,
  partner_referral_code TEXT UNIQUE,
  referred_by_partner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  email TEXT,
  bio TEXT,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  premium_payment_pending BOOLEAN DEFAULT false,
  premium_request_date TIMESTAMP WITH TIME ZONE,
  delivery_address TEXT,
  delivery_city TEXT,
  delivery_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_partner ON users(is_partner) WHERE is_partner = true;
CREATE INDEX idx_users_partner_code ON users(partner_referral_code) WHERE partner_referral_code IS NOT NULL;
CREATE INDEX idx_users_referred_by ON users(referred_by_partner_id) WHERE referred_by_partner_id IS NOT NULL;

-- =====================================================
-- TABLE: global_settings
-- =====================================================
CREATE TABLE global_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  commission_rate DECIMAL(5,2) DEFAULT 15.00,
  discount_reduction DECIMAL(5,2) DEFAULT 5.00,
  partner_commission_rate DECIMAL(5,2) DEFAULT 5.00,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO global_settings (id, commission_rate, discount_reduction, partner_commission_rate)
VALUES ('default', 15.00, 5.00, 5.00)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TABLE: discount_codes
-- =====================================================
CREATE TABLE discount_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  is_active BOOLEAN DEFAULT true,
  usage_limit INTEGER,
  times_used INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  partner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX idx_discount_codes_code ON discount_codes(code) WHERE is_active = true;
CREATE INDEX idx_discount_codes_partner ON discount_codes(partner_user_id) WHERE partner_user_id IS NOT NULL;
CREATE INDEX idx_discount_codes_active ON discount_codes(is_active) WHERE is_active = true;

-- =====================================================
-- TABLE: products
-- =====================================================
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  images TEXT[] DEFAULT '{}',
  category TEXT NOT NULL,
  sub_category TEXT,
  location TEXT,
  seller_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  seller_name TEXT,
  seller_avatar TEXT,
  seller_phone TEXT,
  condition TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending_payment', 'pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  average_rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  listing_type TEXT DEFAULT 'product',
  service_details JSONB,
  stock_quantity INTEGER,
  is_out_of_stock BOOLEAN DEFAULT false,
  has_discount BOOLEAN DEFAULT false,
  discount_percent DECIMAL(5,2),
  original_price DECIMAL(12,2),
  commission_amount DECIMAL(12,2),
  wave_payment_reference TEXT,
  payment_confirmed_at TIMESTAMP WITH TIME ZONE,
  payment_confirmed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  discount_code TEXT,
  discount_code_applied BOOLEAN DEFAULT false,
  partner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  partner_code_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_approved ON products(status, created_at) WHERE status = 'approved';
CREATE INDEX idx_products_partner ON products(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX idx_products_discount_code ON products(discount_code_applied) WHERE discount_code_applied = true;

-- =====================================================
-- TABLE: orders
-- =====================================================
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_phone TEXT,
  total_amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'validated', 'rejected', 'shipped', 'completed')),
  payment_method TEXT DEFAULT 'wave',
  wave_transaction_id TEXT,
  rejection_reason TEXT,
  has_review BOOLEAN DEFAULT false,
  delivery_name TEXT,
  delivery_phone TEXT,
  delivery_address TEXT,
  delivery_city TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  validated_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- =====================================================
-- TABLE: order_items
-- =====================================================
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  product_title TEXT,
  product_price DECIMAL(12,2) NOT NULL,
  product_image TEXT,
  seller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  seller_name TEXT,
  quantity INTEGER DEFAULT 1,
  price_at_purchase DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_seller ON order_items(seller_id);

-- =====================================================
-- TABLE: reviews
-- =====================================================
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  seller_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_avatar TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_seller ON reviews(seller_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_order ON reviews(order_id);

-- =====================================================
-- TABLE: favorites
-- =====================================================
CREATE TABLE favorites (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_product ON favorites(product_id);

-- =====================================================
-- TABLE: notifications
-- =====================================================
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- =====================================================
-- TABLE: announcement_banners
-- =====================================================
CREATE TABLE announcement_banners (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  background_color TEXT DEFAULT '#FF6B35',
  text_color TEXT DEFAULT '#FFFFFF',
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_banners_active ON announcement_banners(is_active, priority) WHERE is_active = true;

-- =====================================================
-- TABLE: global_premium_mode
-- =====================================================
CREATE TABLE global_premium_mode (
  id TEXT PRIMARY KEY,
  is_active BOOLEAN DEFAULT true,
  event_name TEXT,
  event_description TEXT,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_global_premium_active ON global_premium_mode(is_active, ends_at) WHERE is_active = true;

-- =====================================================
-- TABLE: partner_referred_clients
-- =====================================================
CREATE TABLE partner_referred_clients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  partner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  client_seller_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  first_product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  first_product_title TEXT,
  first_product_price DECIMAL(12,2),
  discount_code_used TEXT,
  commission_earned DECIMAL(12,2) DEFAULT 0,
  total_products_count INTEGER DEFAULT 0,
  total_commission_earned DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(partner_user_id, client_seller_id)
);

CREATE INDEX idx_partner_clients_partner ON partner_referred_clients(partner_user_id);
CREATE INDEX idx_partner_clients_seller ON partner_referred_clients(client_seller_id);

-- =====================================================
-- TABLE: partner_commission_payments
-- =====================================================
CREATE TABLE partner_commission_payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  partner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'wave',
  payment_reference TEXT,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  notes TEXT,
  paid_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_partner_payments_partner ON partner_commission_payments(partner_user_id);
CREATE INDEX idx_partner_payments_status ON partner_commission_payments(status);
CREATE INDEX idx_partner_payments_date ON partner_commission_payments(payment_date DESC);

-- =====================================================
-- FONCTIONS POSTGRESQL
-- =====================================================

-- Fonction: get_active_banners
CREATE OR REPLACE FUNCTION get_active_banners()
RETURNS TABLE (
  id TEXT,
  message TEXT,
  priority INTEGER,
  background_color TEXT,
  text_color TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.message,
    b.priority,
    b.background_color,
    b.text_color
  FROM announcement_banners b
  WHERE b.is_active = true
    AND (b.valid_from IS NULL OR b.valid_from <= NOW())
    AND (b.valid_until IS NULL OR b.valid_until >= NOW())
  ORDER BY b.priority DESC, b.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: is_global_premium_active
CREATE OR REPLACE FUNCTION is_global_premium_active()
RETURNS BOOLEAN AS $$
DECLARE
  has_active BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM global_premium_mode
    WHERE is_active = true
      AND starts_at <= NOW()
      AND ends_at >= NOW()
  ) INTO has_active;
  
  RETURN COALESCE(has_active, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: get_active_user_partners
CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS TABLE (
  id TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  avatar TEXT,
  bio TEXT,
  partner_referral_code TEXT,
  total_commission_earned NUMERIC,
  total_sales BIGINT,
  total_referrals BIGINT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.phone,
    u.email,
    u.avatar,
    u.bio,
    u.partner_referral_code,
    COALESCE(SUM(prc.total_commission_earned), 0)::NUMERIC AS total_commission_earned,
    COALESCE(SUM(prc.total_products_count), 0)::BIGINT AS total_sales,
    COUNT(DISTINCT prc.client_seller_id)::BIGINT AS total_referrals,
    u.created_at
  FROM users u
  LEFT JOIN partner_referred_clients prc ON u.id = prc.partner_user_id
  WHERE u.is_partner = true
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.partner_referral_code, u.created_at
  ORDER BY total_commission_earned DESC, u.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: get_partner_stats
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id TEXT)
RETURNS TABLE (
  total_commission NUMERIC,
  total_sales BIGINT,
  total_referrals BIGINT,
  pending_commission NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(prc.total_commission_earned), 0)::NUMERIC AS total_commission,
    COALESCE(SUM(prc.total_products_count), 0)::BIGINT AS total_sales,
    COUNT(DISTINCT prc.client_seller_id)::BIGINT AS total_referrals,
    (
      COALESCE(SUM(prc.total_commission_earned), 0) - 
      COALESCE(
        (SELECT SUM(amount) FROM partner_commission_payments 
         WHERE partner_commission_payments.partner_user_id = get_partner_stats.partner_user_id 
           AND status = 'paid'), 
        0
      )
    )::NUMERIC AS pending_commission
  FROM partner_referred_clients prc
  WHERE prc.partner_user_id = get_partner_stats.partner_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: get_partner_referred_clients
CREATE OR REPLACE FUNCTION get_partner_referred_clients(partner_user_id TEXT)
RETURNS TABLE (
  client_seller_id TEXT,
  client_name TEXT,
  client_phone TEXT,
  client_avatar TEXT,
  first_product_title TEXT,
  first_product_price NUMERIC,
  total_products INTEGER,
  total_commission NUMERIC,
  joined_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    prc.client_seller_id,
    u.name AS client_name,
    u.phone AS client_phone,
    u.avatar AS client_avatar,
    prc.first_product_title,
    prc.first_product_price::NUMERIC,
    prc.total_products_count::INTEGER,
    prc.total_commission_earned::NUMERIC,
    prc.created_at AS joined_at
  FROM partner_referred_clients prc
  JOIN users u ON prc.client_seller_id = u.id
  WHERE prc.partner_user_id = get_partner_referred_clients.partner_user_id
  ORDER BY prc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: get_partner_client_details
CREATE OR REPLACE FUNCTION get_partner_client_details(partner_user_id TEXT, client_seller_id TEXT)
RETURNS TABLE (
  product_id TEXT,
  product_title TEXT,
  product_price NUMERIC,
  commission_earned NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS product_id,
    p.title AS product_title,
    p.price::NUMERIC AS product_price,
    (p.price * (SELECT partner_commission_rate FROM global_settings WHERE id = 'default') / 100)::NUMERIC AS commission_earned,
    p.created_at
  FROM products p
  WHERE p.seller_id = get_partner_client_details.client_seller_id
    AND p.partner_id = get_partner_client_details.partner_user_id
    AND p.discount_code_applied = true
    AND p.status = 'approved'
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: update_partner_referral_code
CREATE OR REPLACE FUNCTION update_partner_referral_code(partner_user_id TEXT, new_code TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
DECLARE
  code_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE partner_referral_code = new_code 
      AND id != partner_user_id
  ) INTO code_exists;
  
  IF code_exists THEN
    RETURN QUERY SELECT false, 'Ce code est déjà utilisé';
    RETURN;
  END IF;
  
  UPDATE users 
  SET partner_referral_code = new_code,
      updated_at = NOW()
  WHERE id = partner_user_id;
  
  RETURN QUERY SELECT true, 'Code mis à jour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: Mettre à jour partner_referred_clients quand un produit est approuvé
CREATE OR REPLACE FUNCTION update_partner_client_on_product_approval()
RETURNS TRIGGER AS $$
DECLARE
  partner_commission NUMERIC;
  settings_commission_rate NUMERIC;
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.partner_id IS NOT NULL AND NEW.discount_code_applied = true THEN
    SELECT partner_commission_rate INTO settings_commission_rate 
    FROM global_settings WHERE id = 'default';
    
    partner_commission := NEW.price * (settings_commission_rate / 100);
    
    INSERT INTO partner_referred_clients (
      partner_user_id,
      client_seller_id,
      first_product_id,
      first_product_title,
      first_product_price,
      discount_code_used,
      commission_earned,
      total_products_count,
      total_commission_earned
    )
    VALUES (
      NEW.partner_id,
      NEW.seller_id,
      NEW.id,
      NEW.title,
      NEW.price,
      NEW.partner_code_used,
      partner_commission,
      1,
      partner_commission
    )
    ON CONFLICT (partner_user_id, client_seller_id) 
    DO UPDATE SET
      total_products_count = partner_referred_clients.total_products_count + 1,
      total_commission_earned = partner_referred_clients.total_commission_earned + partner_commission,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_partner_client
AFTER UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_partner_client_on_product_approval();

-- =====================================================
-- DONNÉES INITIALES
-- =====================================================

-- Créer le super administrateur
INSERT INTO users (
  id, 
  name, 
  phone, 
  password, 
  avatar, 
  location, 
  type, 
  is_admin, 
  is_super_admin,
  created_at
)
VALUES (
  'super-admin-001',
  'Super Admin',
  '+33651104669',
  'Carbabayese',
  'https://ui-avatars.com/api/?name=Super+Admin&background=E31B23&color=fff&size=200',
  'Paris, France',
  'premium',
  true,
  true,
  NOW()
)
ON CONFLICT (phone) 
DO UPDATE SET
  is_super_admin = true,
  is_admin = true,
  type = 'premium',
  password = 'Carbabayese';

-- =====================================================
-- PERMISSIONS RLS (Row Level Security)
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_premium_mode ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_referred_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_commission_payments ENABLE ROW LEVEL SECURITY;

-- Policies publiques pour lecture
CREATE POLICY "Public read access" ON users FOR SELECT USING (true);
CREATE POLICY "Public read access" ON products FOR SELECT USING (true);
CREATE POLICY "Public read access" ON reviews FOR SELECT USING (true);
CREATE POLICY "Public read access" ON discount_codes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON announcement_banners FOR SELECT USING (true);
CREATE POLICY "Public read access" ON global_premium_mode FOR SELECT USING (true);
CREATE POLICY "Public read access" ON global_settings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON orders FOR SELECT USING (true);
CREATE POLICY "Public read access" ON order_items FOR SELECT USING (true);
CREATE POLICY "Public read access" ON favorites FOR SELECT USING (true);
CREATE POLICY "Public read access" ON notifications FOR SELECT USING (true);
CREATE POLICY "Public read access" ON partner_referred_clients FOR SELECT USING (true);
CREATE POLICY "Public read access" ON partner_commission_payments FOR SELECT USING (true);

-- Policies publiques pour écriture
CREATE POLICY "Public write access" ON users FOR ALL USING (true);
CREATE POLICY "Public write access" ON products FOR ALL USING (true);
CREATE POLICY "Public write access" ON reviews FOR ALL USING (true);
CREATE POLICY "Public write access" ON discount_codes FOR ALL USING (true);
CREATE POLICY "Public write access" ON announcement_banners FOR ALL USING (true);
CREATE POLICY "Public write access" ON global_premium_mode FOR ALL USING (true);
CREATE POLICY "Public write access" ON global_settings FOR ALL USING (true);
CREATE POLICY "Public write access" ON orders FOR ALL USING (true);
CREATE POLICY "Public write access" ON order_items FOR ALL USING (true);
CREATE POLICY "Public write access" ON favorites FOR ALL USING (true);
CREATE POLICY "Public write access" ON notifications FOR ALL USING (true);
CREATE POLICY "Public write access" ON partner_referred_clients FOR ALL USING (true);
CREATE POLICY "Public write access" ON partner_commission_payments FOR ALL USING (true);

-- =====================================================
-- OPTIMISATIONS
-- =====================================================

-- Analyser les tables pour optimiser les requêtes
ANALYZE users;
ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
ANALYZE reviews;
ANALYZE favorites;
ANALYZE notifications;
ANALYZE discount_codes;
ANALYZE announcement_banners;
ANALYZE global_premium_mode;
ANALYZE global_settings;
ANALYZE partner_referred_clients;
ANALYZE partner_commission_payments;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================
