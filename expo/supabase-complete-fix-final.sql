-- ========================================
-- FIX COMPLET DE L'APPLICATION
-- ========================================

-- 1. Créer la colonne is_partner si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'is_partner'
  ) THEN
    ALTER TABLE users ADD COLUMN is_partner BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN users.is_partner IS 'Partenaire (influenceur) qui peut gagner des commissions via codes promo';
  END IF;
END $$;

-- 2. Créer la colonne is_super_admin si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN users.is_super_admin IS 'Super administrateur avec tous les droits';
  END IF;
END $$;

-- 3. Créer la table global_settings pour les paramètres
CREATE TABLE IF NOT EXISTS global_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  commission_rate NUMERIC(5,2) DEFAULT 15,
  discount_reduction NUMERIC(5,2) DEFAULT 5,
  partner_commission_rate NUMERIC(5,2) DEFAULT 5,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id)
);

COMMENT ON TABLE global_settings IS 'Paramètres globaux de l''application';
COMMENT ON COLUMN global_settings.commission_rate IS 'Taux de commission par défaut en % (ex: 15 pour 15%)';
COMMENT ON COLUMN global_settings.discount_reduction IS 'Réduction de commission avec code promo en % (ex: 5 pour 5%)';
COMMENT ON COLUMN global_settings.partner_commission_rate IS 'Commission pour les partenaires en % (ex: 5 pour 5%)';

-- Insérer les valeurs par défaut
INSERT INTO global_settings (id, commission_rate, discount_reduction, partner_commission_rate)
VALUES ('default', 15, 5, 5)
ON CONFLICT (id) DO UPDATE SET
  commission_rate = 15,
  discount_reduction = 5,
  partner_commission_rate = 5;

-- 4. Créer la table discount_codes si elle n'existe pas
CREATE TABLE IF NOT EXISTS discount_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_rate NUMERIC(5,2) DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  usage_limit INTEGER,
  times_used INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  partner_id TEXT,
  partner_name TEXT,
  partner_commission_rate NUMERIC(5,2) DEFAULT 5
);

COMMENT ON TABLE discount_codes IS 'Codes promo pour réduire la commission';
COMMENT ON COLUMN discount_codes.discount_rate IS 'Taux de réduction de commission en %';
COMMENT ON COLUMN discount_codes.partner_id IS 'ID du partenaire (user_id) qui recevra les commissions';
COMMENT ON COLUMN discount_codes.partner_name IS 'Nom du partenaire pour affichage';
COMMENT ON COLUMN discount_codes.partner_commission_rate IS 'Commission du partenaire en %';

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_discount_codes_partner ON discount_codes(partner_id);

-- Ajouter la colonne partner_commission_rate si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_commission_rate'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN partner_commission_rate NUMERIC(5,2) DEFAULT 5;
    COMMENT ON COLUMN discount_codes.partner_commission_rate IS 'Commission du partenaire en %';
  END IF;
END $$;

-- Ajouter partner_id et partner_name si manquants
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN partner_id TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_name'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN partner_name TEXT;
  END IF;
END $$;

-- 5. Créer la table announcement_banners
CREATE TABLE IF NOT EXISTS announcement_banners (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  background_color TEXT DEFAULT '#FF6B35',
  text_color TEXT DEFAULT '#FFFFFF',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE announcement_banners IS 'Messages défilants affichés en haut de l''application';

CREATE INDEX IF NOT EXISTS idx_announcement_banners_active ON announcement_banners(is_active);
CREATE INDEX IF NOT EXISTS idx_announcement_banners_priority ON announcement_banners(priority DESC);

-- 6. Créer la table global_premium_mode
CREATE TABLE IF NOT EXISTS global_premium_mode (
  id TEXT PRIMARY KEY,
  is_active BOOLEAN DEFAULT TRUE,
  event_name TEXT,
  event_description TEXT,
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE global_premium_mode IS 'Mode Premium global pour événements (ex: Black Friday)';

CREATE INDEX IF NOT EXISTS idx_global_premium_mode_active ON global_premium_mode(is_active);
CREATE INDEX IF NOT EXISTS idx_global_premium_mode_dates ON global_premium_mode(ends_at);

-- 7. RLS pour global_settings
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view global settings" ON global_settings;
DROP POLICY IF EXISTS "Super admins can manage global settings" ON global_settings;

CREATE POLICY "Anyone can view global settings" ON global_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Super admins can update global settings" ON global_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

-- 8. RLS pour discount_codes
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Super admins can manage discount codes" ON discount_codes;

CREATE POLICY "Anyone can view active discount codes" ON discount_codes
  FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Super admins can insert discount codes" ON discount_codes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admins can update discount codes" ON discount_codes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admins can delete discount codes" ON discount_codes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

-- 9. RLS pour announcement_banners
ALTER TABLE announcement_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active banners" ON announcement_banners;
DROP POLICY IF EXISTS "Super admins can insert banners" ON announcement_banners;
DROP POLICY IF EXISTS "Super admins can update banners" ON announcement_banners;
DROP POLICY IF EXISTS "Super admins can delete banners" ON announcement_banners;

CREATE POLICY "Anyone can view active banners" ON announcement_banners
  FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Super admins can insert banners" ON announcement_banners
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admins can update banners" ON announcement_banners
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admins can delete banners" ON announcement_banners
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

-- 10. RLS pour global_premium_mode
ALTER TABLE global_premium_mode ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active premium mode" ON global_premium_mode;
DROP POLICY IF EXISTS "Super admins can manage premium mode" ON global_premium_mode;

CREATE POLICY "Anyone can view active premium mode" ON global_premium_mode
  FOR SELECT
  USING (is_active = TRUE AND ends_at >= NOW());

CREATE POLICY "Super admins can insert premium mode" ON global_premium_mode
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admins can update premium mode" ON global_premium_mode
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admins can delete premium mode" ON global_premium_mode
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

-- 11. Fonction pour obtenir les bannières actives
CREATE OR REPLACE FUNCTION get_active_banners()
RETURNS TABLE(
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
  WHERE b.is_active = TRUE
    AND (b.valid_from IS NULL OR b.valid_from <= NOW())
    AND (b.valid_until IS NULL OR b.valid_until >= NOW())
  ORDER BY b.priority DESC, b.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Fonction pour obtenir les partenaires actifs (basé sur users.is_partner)
CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS TABLE(
  id TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  avatar TEXT,
  bio TEXT,
  total_commission_earned NUMERIC,
  total_sales INTEGER,
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
    COALESCE(SUM(CASE 
      WHEN dc.partner_id = u.id THEN dc.partner_commission_rate * dc.times_used
      ELSE 0 
    END), 0)::NUMERIC as total_commission_earned,
    COALESCE(SUM(CASE 
      WHEN dc.partner_id = u.id THEN dc.times_used
      ELSE 0 
    END), 0)::INTEGER as total_sales,
    u.created_at
  FROM users u
  LEFT JOIN discount_codes dc ON dc.partner_id = u.id
  WHERE u.is_partner = TRUE
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.created_at
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Vérifications finales
DO $$
BEGIN
  -- Vérifier que global_settings existe et a des données
  IF NOT EXISTS (SELECT 1 FROM global_settings WHERE id = 'default') THEN
    INSERT INTO global_settings (id, commission_rate, discount_reduction, partner_commission_rate)
    VALUES ('default', 15, 5, 5);
  ELSE
    -- Mettre à jour les valeurs par défaut
    UPDATE global_settings 
    SET 
      commission_rate = 15,
      discount_reduction = 5,
      partner_commission_rate = 5
    WHERE id = 'default';
  END IF;
  
  RAISE NOTICE '✓ Global settings configuré';
  RAISE NOTICE '✓ Commission par défaut: 15%%';
  RAISE NOTICE '✓ Réduction avec code promo: 5%%';
  RAISE NOTICE '✓ Commission partenaires: 5%%';
END $$;

-- Résumé des corrections
SELECT 
  '✓ Correction terminée' as status,
  (SELECT COUNT(*) FROM discount_codes WHERE is_active = TRUE) as codes_actifs,
  (SELECT COUNT(*) FROM announcement_banners WHERE is_active = TRUE) as bannières_actives,
  (SELECT COUNT(*) FROM users WHERE is_partner = TRUE) as partenaires_actifs,
  (SELECT commission_rate || '%' FROM global_settings WHERE id = 'default') as commission_actuelle;
