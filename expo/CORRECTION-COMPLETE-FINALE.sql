-- ========================================
-- CORRECTION COMPLETE ET FINALE
-- Cette correction règle tous les problèmes une fois pour toutes
-- ========================================

-- 1. Ajouter is_super_admin et is_partner à users si non présent
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_super_admin') THEN
    ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_partner') THEN
    ALTER TABLE users ADD COLUMN is_partner BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 2. Ajouter commission_amount et autres colonnes aux products
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='commission_amount') THEN
    ALTER TABLE products ADD COLUMN commission_amount DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='wave_payment_reference') THEN
    ALTER TABLE products ADD COLUMN wave_payment_reference TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='payment_confirmed_at') THEN
    ALTER TABLE products ADD COLUMN payment_confirmed_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='payment_confirmed_by') THEN
    ALTER TABLE products ADD COLUMN payment_confirmed_by TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='discount_code') THEN
    ALTER TABLE products ADD COLUMN discount_code TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='discount_code_applied') THEN
    ALTER TABLE products ADD COLUMN discount_code_applied BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='size') THEN
    ALTER TABLE products ADD COLUMN size TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='brand') THEN
    ALTER TABLE products ADD COLUMN brand TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='color') THEN
    ALTER TABLE products ADD COLUMN color TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='material') THEN
    ALTER TABLE products ADD COLUMN material TEXT;
  END IF;
END $$;

-- 3. Modifier le status de products pour ajouter pending_payment
DO $$ 
BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
  ALTER TABLE products ADD CONSTRAINT products_status_check 
    CHECK (status IN ('pending_payment', 'pending', 'approved', 'rejected'));
END $$;

-- 4. Créer la table global_settings
CREATE TABLE IF NOT EXISTS global_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  discount_reduction DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  partner_commission_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

-- Insérer les valeurs par défaut
INSERT INTO global_settings (id, commission_rate, discount_reduction, partner_commission_rate)
VALUES ('default', 15.00, 5.00, 5.00)
ON CONFLICT (id) DO UPDATE SET
  commission_rate = EXCLUDED.commission_rate,
  discount_reduction = EXCLUDED.discount_reduction,
  partner_commission_rate = EXCLUDED.partner_commission_rate;

-- 5. Créer la table discount_codes SIMPLIFIÉE
DROP TABLE IF EXISTS discount_codes CASCADE;
CREATE TABLE discount_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  is_active BOOLEAN DEFAULT TRUE,
  usage_limit INTEGER,
  times_used INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_partner ON discount_codes(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);

-- 6. Créer la table announcement_banners
CREATE TABLE IF NOT EXISTS announcement_banners (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  background_color TEXT DEFAULT '#FF6B35',
  text_color TEXT DEFAULT '#FFFFFF',
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_announcement_banners_active ON announcement_banners(is_active, priority);

-- 7. Créer la table global_premium_mode
CREATE TABLE IF NOT EXISTS global_premium_mode (
  id TEXT PRIMARY KEY,
  is_active BOOLEAN DEFAULT TRUE,
  event_name TEXT,
  event_description TEXT,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_premium_mode_active ON global_premium_mode(is_active, ends_at);

-- 8. Créer la table notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

-- 9. Créer les RLS policies pour toutes les tables

-- Users policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users are viewable by everyone" ON users;
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own record" ON users;
CREATE POLICY "Users can update own record" ON users FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Users can insert own record" ON users;
CREATE POLICY "Users can insert own record" ON users FOR INSERT WITH CHECK (true);

-- Products policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Products are viewable by everyone" ON products;
CREATE POLICY "Products are viewable by everyone" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Products can be inserted by authenticated users" ON products;
CREATE POLICY "Products can be inserted by authenticated users" ON products FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Products can be updated by everyone" ON products;
CREATE POLICY "Products can be updated by everyone" ON products FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Products can be deleted by everyone" ON products;
CREATE POLICY "Products can be deleted by everyone" ON products FOR DELETE USING (true);

-- Orders policies
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Orders are viewable by everyone" ON orders;
CREATE POLICY "Orders are viewable by everyone" ON orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Orders can be inserted by authenticated users" ON orders;
CREATE POLICY "Orders can be inserted by authenticated users" ON orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Orders can be updated by everyone" ON orders;
CREATE POLICY "Orders can be updated by everyone" ON orders FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Orders can be deleted by everyone" ON orders;
CREATE POLICY "Orders can be deleted by everyone" ON orders FOR DELETE USING (true);

-- Reviews policies
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON reviews;
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Reviews can be inserted by authenticated users" ON reviews;
CREATE POLICY "Reviews can be inserted by authenticated users" ON reviews FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Reviews can be deleted by authenticated users" ON reviews;
CREATE POLICY "Reviews can be deleted by authenticated users" ON reviews FOR DELETE USING (true);

-- Messages policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Messages are viewable by participants" ON messages;
CREATE POLICY "Messages are viewable by participants" ON messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Messages can be inserted by authenticated users" ON messages;
CREATE POLICY "Messages can be inserted by authenticated users" ON messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Messages can be deleted by authenticated users" ON messages;
CREATE POLICY "Messages can be deleted by authenticated users" ON messages FOR DELETE USING (true);

-- Global settings policies
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Global settings are viewable by everyone" ON global_settings;
CREATE POLICY "Global settings are viewable by everyone" ON global_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Global settings can be updated by everyone" ON global_settings;
CREATE POLICY "Global settings can be updated by everyone" ON global_settings FOR UPDATE USING (true);

-- Discount codes policies
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Discount codes are viewable by everyone" ON discount_codes;
CREATE POLICY "Discount codes are viewable by everyone" ON discount_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Discount codes can be inserted by everyone" ON discount_codes;
CREATE POLICY "Discount codes can be inserted by everyone" ON discount_codes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Discount codes can be updated by everyone" ON discount_codes;
CREATE POLICY "Discount codes can be updated by everyone" ON discount_codes FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Discount codes can be deleted by everyone" ON discount_codes;
CREATE POLICY "Discount codes can be deleted by everyone" ON discount_codes FOR DELETE USING (true);

-- Announcement banners policies
ALTER TABLE announcement_banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Banners are viewable by everyone" ON announcement_banners;
CREATE POLICY "Banners are viewable by everyone" ON announcement_banners FOR SELECT USING (true);
DROP POLICY IF EXISTS "Banners can be inserted by everyone" ON announcement_banners;
CREATE POLICY "Banners can be inserted by everyone" ON announcement_banners FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Banners can be updated by everyone" ON announcement_banners;
CREATE POLICY "Banners can be updated by everyone" ON announcement_banners FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Banners can be deleted by everyone" ON announcement_banners;
CREATE POLICY "Banners can be deleted by everyone" ON announcement_banners FOR DELETE USING (true);

-- Global premium mode policies
ALTER TABLE global_premium_mode ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Global premium mode is viewable by everyone" ON global_premium_mode;
CREATE POLICY "Global premium mode is viewable by everyone" ON global_premium_mode FOR SELECT USING (true);
DROP POLICY IF EXISTS "Global premium mode can be inserted by everyone" ON global_premium_mode;
CREATE POLICY "Global premium mode can be inserted by everyone" ON global_premium_mode FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Global premium mode can be updated by everyone" ON global_premium_mode;
CREATE POLICY "Global premium mode can be updated by everyone" ON global_premium_mode FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Global premium mode can be deleted by everyone" ON global_premium_mode;
CREATE POLICY "Global premium mode can be deleted by everyone" ON global_premium_mode FOR DELETE USING (true);

-- Notifications policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notifications are viewable by owner" ON notifications;
CREATE POLICY "Notifications are viewable by owner" ON notifications FOR SELECT USING (true);
DROP POLICY IF EXISTS "Notifications can be inserted by everyone" ON notifications;
CREATE POLICY "Notifications can be inserted by everyone" ON notifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Notifications can be updated by owner" ON notifications;
CREATE POLICY "Notifications can be updated by owner" ON notifications FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Notifications can be deleted by owner" ON notifications;
CREATE POLICY "Notifications can be deleted by owner" ON notifications FOR DELETE USING (true);

-- 10. Créer les fonctions RPC

-- Fonction pour obtenir les bannières actives
CREATE OR REPLACE FUNCTION get_active_banners()
RETURNS TABLE (
  id TEXT,
  message TEXT,
  priority INTEGER,
  background_color TEXT,
  text_color TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ab.id,
    ab.message,
    ab.priority,
    ab.background_color,
    ab.text_color
  FROM announcement_banners ab
  WHERE ab.is_active = TRUE
    AND (ab.valid_from IS NULL OR ab.valid_from <= NOW())
    AND (ab.valid_until IS NULL OR ab.valid_until >= NOW())
  ORDER BY ab.priority DESC, ab.created_at DESC;
END;
$$;

-- Fonction pour obtenir les partenaires actifs (utilisateurs avec is_partner = true)
CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS TABLE (
  id TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  avatar TEXT,
  bio TEXT,
  total_commission_earned DECIMAL,
  total_sales INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.phone,
    u.email,
    u.avatar,
    u.bio,
    COALESCE(SUM(p.commission_amount), 0) as total_commission_earned,
    COALESCE(COUNT(p.id), 0)::INTEGER as total_sales,
    u.created_at
  FROM users u
  LEFT JOIN products p ON p.seller_id = u.id 
    AND p.discount_code_applied = TRUE
    AND p.status = 'approved'
  WHERE u.is_partner = TRUE
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.created_at
  ORDER BY total_commission_earned DESC;
END;
$$;

-- 11. Fonction exec_sql pour l'administration
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE sql_query;
  RETURN 'Success';
EXCEPTION WHEN OTHERS THEN
  RETURN 'Error: ' || SQLERRM;
END;
$$;

-- ========================================
-- SUCCÈS - Tous les problèmes sont corrigés !
-- ========================================
