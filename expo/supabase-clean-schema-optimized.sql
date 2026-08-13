-- =====================================================
-- MARKETPLACE - SCHÉMA OPTIMISÉ ET PROPRE
-- Base de données ultra rapide avec indexes optimisés
-- =====================================================

-- Suppression des anciennes tables pour recommencer proprement
DROP TABLE IF EXISTS commission_payments CASCADE;
DROP TABLE IF EXISTS partner_referrals CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS discount_codes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS global_settings CASCADE;

-- =====================================================
-- TABLE: users
-- =====================================================
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  avatar TEXT NOT NULL,
  bio TEXT,
  location TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'standard' CHECK (type IN ('standard', 'premium')),
  is_admin BOOLEAN DEFAULT FALSE,
  is_super_admin BOOLEAN DEFAULT FALSE,
  is_partner BOOLEAN DEFAULT FALSE,
  partner_referral_code TEXT UNIQUE,
  rating NUMERIC(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  delivery_address TEXT,
  delivery_city TEXT,
  delivery_phone TEXT,
  premium_payment_pending BOOLEAN DEFAULT FALSE,
  premium_request_date TIMESTAMPTZ,
  joined_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes pour performance
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_type ON users(type);
CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
CREATE INDEX idx_users_is_partner ON users(is_partner) WHERE is_partner = TRUE;
CREATE INDEX idx_users_partner_code ON users(partner_referral_code) WHERE partner_referral_code IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- =====================================================
-- TABLE: products
-- =====================================================
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  original_price NUMERIC(12,2),
  images TEXT[] NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT,
  location TEXT NOT NULL,
  condition TEXT CHECK (condition IN ('new', 'used', 'refurbished')),
  listing_type TEXT DEFAULT 'product' CHECK (listing_type IN ('product', 'service')),
  service_details JSONB,
  stock_quantity INTEGER,
  is_out_of_stock BOOLEAN DEFAULT FALSE,
  has_discount BOOLEAN DEFAULT FALSE,
  discount_percent INTEGER,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  commission_amount NUMERIC(12,2),
  discount_code TEXT,
  discount_code_applied BOOLEAN DEFAULT FALSE,
  partner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  partner_code_used TEXT,
  wave_payment_reference TEXT,
  payment_confirmed_at TIMESTAMPTZ,
  payment_confirmed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  average_rating NUMERIC(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  seller_name TEXT NOT NULL,
  seller_avatar TEXT NOT NULL,
  seller_phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes ultra optimisés pour recherche rapide
CREATE INDEX idx_products_seller_id ON products(seller_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_approved ON products(status) WHERE status = 'approved';
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_partner_id ON products(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX idx_products_title_search ON products USING gin(to_tsvector('french', title));
CREATE INDEX idx_products_description_search ON products USING gin(to_tsvector('french', description));
CREATE INDEX idx_products_price ON products(price);

-- =====================================================
-- TABLE: favorites
-- =====================================================
CREATE TABLE favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_product_id ON favorites(product_id);

-- =====================================================
-- TABLE: orders
-- =====================================================
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'validated', 'rejected', 'shipped', 'completed')),
  payment_method TEXT DEFAULT 'wave',
  wave_transaction_id TEXT,
  rejection_reason TEXT,
  has_review BOOLEAN DEFAULT FALSE,
  delivery_name TEXT NOT NULL,
  delivery_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_city TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- =====================================================
-- TABLE: order_items
-- =====================================================
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price_at_purchase NUMERIC(12,2) NOT NULL,
  product_title TEXT NOT NULL,
  product_image TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_seller_id ON order_items(seller_id);

-- =====================================================
-- TABLE: reviews
-- =====================================================
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_seller_id ON reviews(seller_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

-- =====================================================
-- TABLE: discount_codes
-- =====================================================
CREATE TABLE discount_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  partner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  discount_percent INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  usage_limit INTEGER,
  times_used INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discount_codes_code ON discount_codes(code) WHERE is_active = TRUE;
CREATE INDEX idx_discount_codes_partner ON discount_codes(partner_user_id);

-- =====================================================
-- TABLE: notifications
-- =====================================================
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =====================================================
-- TABLE: global_settings
-- =====================================================
CREATE TABLE global_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  discount_reduction NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  partner_commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  is_global_premium_active BOOLEAN DEFAULT FALSE,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les paramètres globaux par défaut
INSERT INTO global_settings (id, commission_rate, discount_reduction, partner_commission_rate, is_global_premium_active)
VALUES ('global', 15.00, 5.00, 10.00, FALSE)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TABLE: partner_referrals
-- Suivi des clients référés par les partenaires
-- =====================================================
CREATE TABLE partner_referrals (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  commission_amount NUMERIC(12,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  product_price NUMERIC(12,2) NOT NULL,
  partner_code_used TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  UNIQUE(partner_id, product_id)
);

CREATE INDEX idx_partner_referrals_partner ON partner_referrals(partner_id);
CREATE INDEX idx_partner_referrals_user ON partner_referrals(referred_user_id);
CREATE INDEX idx_partner_referrals_status ON partner_referrals(status);
CREATE INDEX idx_partner_referrals_created_at ON partner_referrals(created_at DESC);

-- =====================================================
-- TABLE: commission_payments
-- Suivi des paiements de commissions aux partenaires
-- =====================================================
CREATE TABLE commission_payments (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'wave',
  payment_reference TEXT,
  paid_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commission_payments_partner ON commission_payments(partner_id);
CREATE INDEX idx_commission_payments_created_at ON commission_payments(created_at DESC);

-- =====================================================
-- FONCTIONS UTILITAIRES
-- =====================================================

-- Fonction pour vérifier si le premium global est actif
CREATE OR REPLACE FUNCTION is_global_premium_active()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT is_global_premium_active FROM global_settings WHERE id = 'global');
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction pour mettre à jour les timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour auto-update des timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_settings_updated_at BEFORE UPDATE ON global_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FONCTION: Enregistrer un référé de partenaire
-- =====================================================
CREATE OR REPLACE FUNCTION create_partner_referral(
  p_partner_id TEXT,
  p_product_id TEXT,
  p_referred_user_id TEXT,
  p_commission_amount NUMERIC,
  p_commission_rate NUMERIC,
  p_product_price NUMERIC,
  p_partner_code TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_referral_id TEXT;
BEGIN
  v_referral_id := 'ref-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 8);
  
  INSERT INTO partner_referrals (
    id, partner_id, referred_user_id, product_id,
    commission_amount, commission_rate, product_price,
    partner_code_used, status
  ) VALUES (
    v_referral_id, p_partner_id, p_referred_user_id, p_product_id,
    p_commission_amount, p_commission_rate, p_product_price,
    p_partner_code, 'pending'
  )
  ON CONFLICT (partner_id, product_id) DO UPDATE
  SET commission_amount = EXCLUDED.commission_amount,
      commission_rate = EXCLUDED.commission_rate,
      product_price = EXCLUDED.product_price;
  
  RETURN v_referral_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VUES MATÉRIALISÉES POUR PERFORMANCE
-- =====================================================

-- Vue pour les statistiques des partenaires (mise en cache)
CREATE MATERIALIZED VIEW partner_stats AS
SELECT 
  u.id,
  u.name,
  u.phone,
  u.email,
  u.avatar,
  u.partner_referral_code,
  u.is_partner,
  COUNT(DISTINCT pr.id) as total_referrals,
  COALESCE(SUM(pr.commission_amount), 0) as total_commission_earned,
  COALESCE(SUM(CASE WHEN pr.status = 'paid' THEN pr.commission_amount ELSE 0 END), 0) as total_paid,
  COALESCE(SUM(CASE WHEN pr.status = 'pending' THEN pr.commission_amount ELSE 0 END), 0) as total_pending,
  COUNT(DISTINCT pr.product_id) as total_sales,
  u.created_at
FROM users u
LEFT JOIN partner_referrals pr ON pr.partner_id = u.id
WHERE u.is_partner = TRUE
GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.partner_referral_code, u.is_partner, u.created_at;

CREATE UNIQUE INDEX idx_partner_stats_id ON partner_stats(id);

-- Fonction pour rafraîchir les stats
CREATE OR REPLACE FUNCTION refresh_partner_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY partner_stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Activer RLS sur toutes les tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Policies: Tout le monde peut lire
CREATE POLICY "Public read access" ON users FOR SELECT USING (true);
CREATE POLICY "Public read access" ON products FOR SELECT USING (true);
CREATE POLICY "Public read access" ON reviews FOR SELECT USING (true);
CREATE POLICY "Public read access" ON global_settings FOR SELECT USING (true);

-- Users: peut mettre à jour son profil
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (true);

-- Products: vendeur peut créer/modifier
CREATE POLICY "Sellers can insert products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Sellers can update own products" ON products FOR UPDATE USING (true);
CREATE POLICY "Sellers can delete own products" ON products FOR DELETE USING (true);

-- Favorites: user peut gérer ses favoris
CREATE POLICY "Users can manage own favorites" ON favorites FOR ALL USING (true);

-- Orders: user peut voir ses commandes
CREATE POLICY "Users can manage own orders" ON orders FOR ALL USING (true);

-- Order items: lecture publique
CREATE POLICY "Public read order items" ON order_items FOR SELECT USING (true);
CREATE POLICY "Can insert order items" ON order_items FOR INSERT WITH CHECK (true);

-- Reviews: lecture publique, création pour users
CREATE POLICY "Users can create reviews" ON reviews FOR INSERT WITH CHECK (true);

-- Notifications: user voit ses notifications
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT USING (true);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (true);
CREATE POLICY "Can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Discount codes: lecture publique
CREATE POLICY "Public read discount codes" ON discount_codes FOR SELECT USING (true);
CREATE POLICY "Can manage discount codes" ON discount_codes FOR ALL USING (true);

-- Partner referrals: lecture publique pour stats
CREATE POLICY "Public read partner referrals" ON partner_referrals FOR SELECT USING (true);
CREATE POLICY "Can insert partner referrals" ON partner_referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "Can update partner referrals" ON partner_referrals FOR UPDATE USING (true);

-- Commission payments: lecture publique
CREATE POLICY "Public read commission payments" ON commission_payments FOR SELECT USING (true);
CREATE POLICY "Can insert commission payments" ON commission_payments FOR INSERT WITH CHECK (true);

-- Global settings: tout le monde peut lire et modifier (admin check côté app)
CREATE POLICY "Can manage global settings" ON global_settings FOR ALL USING (true);

-- =====================================================
-- DONNÉES DE TEST
-- =====================================================

-- Créer un super admin par défaut
INSERT INTO users (
  id, phone, password, name, email, avatar, location, type,
  is_admin, is_super_admin, is_partner, partner_referral_code
) VALUES (
  'superadmin-001',
  '781234567',
  'admin123',
  'Super Admin',
  'admin@marketplace.com',
  'https://ui-avatars.com/api/?name=Super+Admin&background=00A651&color=fff&size=200',
  'Dakar, Sénégal',
  'premium',
  true,
  true,
  false,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- Rafraîchir les stats des partenaires
SELECT refresh_partner_stats();

-- =====================================================
-- OPTIMISATIONS FINALES
-- =====================================================

-- Analyser toutes les tables pour optimiser le query planner
ANALYZE users;
ANALYZE products;
ANALYZE favorites;
ANALYZE orders;
ANALYZE order_items;
ANALYZE reviews;
ANALYZE discount_codes;
ANALYZE notifications;
ANALYZE partner_referrals;
ANALYZE commission_payments;
ANALYZE global_settings;

-- Vacuum pour nettoyer
VACUUM ANALYZE;

-- =====================================================
-- FIN DU SCHÉMA OPTIMISÉ
-- =====================================================
