-- ============================================
-- CORRECTION FINALE COMPLÈTE
-- ============================================
-- Ce script corrige tous les problèmes de l'application

-- 1. Vérifier et créer la table global_settings si elle n'existe pas
CREATE TABLE IF NOT EXISTS global_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  commission_rate NUMERIC NOT NULL DEFAULT 15,
  discount_reduction NUMERIC NOT NULL DEFAULT 5,
  partner_commission_rate NUMERIC NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insérer les paramètres par défaut s'ils n'existent pas
INSERT INTO global_settings (id, commission_rate, discount_reduction, partner_commission_rate)
VALUES ('default', 15, 5, 5)
ON CONFLICT (id) DO NOTHING;

-- 2. Vérifier et créer la table discount_codes si elle n'existe pas
CREATE TABLE IF NOT EXISTS discount_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_rate NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  usage_limit INTEGER,
  times_used INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  partner_user_id TEXT,
  CONSTRAINT fk_discount_codes_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_discount_codes_partner FOREIGN KEY (partner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Vérifier et créer la table announcement_banners si elle n'existe pas
CREATE TABLE IF NOT EXISTS announcement_banners (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  background_color TEXT DEFAULT '#FF6B35',
  text_color TEXT DEFAULT '#FFFFFF',
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  CONSTRAINT fk_announcement_banners_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Vérifier et créer la table global_premium_mode si elle n'existe pas
CREATE TABLE IF NOT EXISTS global_premium_mode (
  id TEXT PRIMARY KEY,
  is_active BOOLEAN DEFAULT TRUE,
  event_name TEXT,
  event_description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_global_premium_mode_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Activer RLS sur toutes les tables
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_premium_mode ENABLE ROW LEVEL SECURITY;

-- 6. Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Allow all for admins" ON global_settings;
DROP POLICY IF EXISTS "Allow read for authenticated" ON global_settings;
DROP POLICY IF EXISTS "Allow all for admins" ON discount_codes;
DROP POLICY IF EXISTS "Allow read for authenticated" ON discount_codes;
DROP POLICY IF EXISTS "Allow all for admins" ON announcement_banners;
DROP POLICY IF EXISTS "Allow read for all" ON announcement_banners;
DROP POLICY IF EXISTS "Allow all for admins" ON global_premium_mode;
DROP POLICY IF EXISTS "Allow read for authenticated" ON global_premium_mode;

-- 7. Créer les nouvelles policies pour global_settings
CREATE POLICY "Allow read for all users"
  ON global_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow update for super admins"
  ON global_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  );

-- 8. Créer les policies pour discount_codes
CREATE POLICY "Allow read for all users"
  ON discount_codes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for super admins"
  ON discount_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  );

CREATE POLICY "Allow update for super admins"
  ON discount_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  );

CREATE POLICY "Allow delete for super admins"
  ON discount_codes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  );

-- 9. Créer les policies pour announcement_banners
CREATE POLICY "Allow read for all users"
  ON announcement_banners FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for super admins"
  ON announcement_banners FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  );

CREATE POLICY "Allow update for super admins"
  ON announcement_banners FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  );

CREATE POLICY "Allow delete for super admins"
  ON announcement_banners FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  );

-- 10. Créer les policies pour global_premium_mode
CREATE POLICY "Allow read for all users"
  ON global_premium_mode FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for super admins"
  ON global_premium_mode FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  );

CREATE POLICY "Allow update for super admins"
  ON global_premium_mode FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  );

CREATE POLICY "Allow delete for super admins"
  ON global_premium_mode FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = true
    )
  );

-- 11. Créer ou remplacer la fonction get_active_banners
CREATE OR REPLACE FUNCTION get_active_banners()
RETURNS TABLE (
  id TEXT,
  message TEXT,
  priority INTEGER,
  background_color TEXT,
  text_color TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
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
  WHERE ab.is_active = true
    AND (ab.valid_from IS NULL OR ab.valid_from <= NOW())
    AND (ab.valid_until IS NULL OR ab.valid_until >= NOW())
  ORDER BY ab.priority DESC, ab.created_at DESC;
END;
$$;

-- 12. Créer ou remplacer la fonction get_active_user_partners
CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS TABLE (
  id TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  avatar TEXT,
  bio TEXT,
  total_commission_earned NUMERIC,
  total_sales INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
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
    COALESCE(SUM(o.total_amount * 0.05), 0) as total_commission_earned,
    COUNT(DISTINCT o.id)::INTEGER as total_sales,
    u.created_at
  FROM users u
  LEFT JOIN products p ON p.seller_id = u.id
  LEFT JOIN order_items oi ON oi.product_id = p.id
  LEFT JOIN orders o ON o.id = oi.order_id AND o.status IN ('validated', 'shipped', 'completed')
  WHERE u.is_partner = true
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.created_at
  ORDER BY u.created_at DESC;
END;
$$;

-- 13. Ajouter la colonne is_partner à users si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_partner'
  ) THEN
    ALTER TABLE users ADD COLUMN is_partner BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 14. Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_announcement_banners_active ON announcement_banners(is_active);
CREATE INDEX IF NOT EXISTS idx_global_premium_mode_active ON global_premium_mode(is_active, ends_at);
CREATE INDEX IF NOT EXISTS idx_users_partner ON users(is_partner) WHERE is_partner = true;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Correction complète terminée avec succès !';
  RAISE NOTICE '✅ Tables créées/vérifiées : global_settings, discount_codes, announcement_banners, global_premium_mode';
  RAISE NOTICE '✅ Policies RLS configurées pour tous les super admins';
  RAISE NOTICE '✅ Fonctions SQL créées : get_active_banners, get_active_user_partners';
  RAISE NOTICE '✅ Paramètres par défaut initialisés';
END $$;
