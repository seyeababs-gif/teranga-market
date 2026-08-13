-- ============================================
-- CORRECTION: Ajouter partner_id à discount_codes
-- ============================================

-- 1. Ajouter la colonne partner_id si elle n'existe pas
DO $$ 
BEGIN
  -- Vérifier et ajouter partner_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN partner_id TEXT;
    RAISE NOTICE '✓ Colonne partner_id ajoutée à discount_codes';
  ELSE
    RAISE NOTICE '✓ Colonne partner_id existe déjà';
  END IF;

  -- Vérifier et ajouter partner_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_name'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN partner_name TEXT;
    RAISE NOTICE '✓ Colonne partner_name ajoutée à discount_codes';
  ELSE
    RAISE NOTICE '✓ Colonne partner_name existe déjà';
  END IF;

  -- Vérifier et ajouter partner_commission_rate
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_commission_rate'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN partner_commission_rate NUMERIC(5,2) DEFAULT 5;
    RAISE NOTICE '✓ Colonne partner_commission_rate ajoutée à discount_codes';
  ELSE
    RAISE NOTICE '✓ Colonne partner_commission_rate existe déjà';
  END IF;
END $$;

-- 2. Ajouter is_partner aux users si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'is_partner'
  ) THEN
    ALTER TABLE users ADD COLUMN is_partner BOOLEAN DEFAULT FALSE;
    RAISE NOTICE '✓ Colonne is_partner ajoutée à users';
  ELSE
    RAISE NOTICE '✓ Colonne is_partner existe déjà';
  END IF;
END $$;

-- 3. S'assurer que global_settings existe et est correctement configuré
DO $$ 
BEGIN
  -- Créer la table si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'global_settings') THEN
    CREATE TABLE global_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      commission_rate NUMERIC(5,2) DEFAULT 15,
      discount_reduction NUMERIC(5,2) DEFAULT 5,
      partner_commission_rate NUMERIC(5,2) DEFAULT 5,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_by TEXT REFERENCES users(id)
    );
    RAISE NOTICE '✓ Table global_settings créée';
  END IF;

  -- Insérer ou mettre à jour les valeurs par défaut
  INSERT INTO global_settings (id, commission_rate, discount_reduction, partner_commission_rate)
  VALUES ('default', 15, 5, 5)
  ON CONFLICT (id) DO UPDATE SET
    commission_rate = COALESCE(global_settings.commission_rate, 15),
    discount_reduction = COALESCE(global_settings.discount_reduction, 5),
    partner_commission_rate = COALESCE(global_settings.partner_commission_rate, 5);
  
  RAISE NOTICE '✓ Global settings configuré (Commission: 15%%, Réduction: 5%%, Commission partenaire: 5%%)';
END $$;

-- 4. Créer un index sur partner_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'discount_codes' 
    AND indexname = 'idx_discount_codes_partner_id'
  ) THEN
    CREATE INDEX idx_discount_codes_partner_id ON discount_codes(partner_id);
    RAISE NOTICE '✓ Index créé sur discount_codes.partner_id';
  END IF;
END $$;

-- 5. Mettre à jour la fonction get_active_user_partners
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

-- 6. RLS pour global_settings
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view global settings" ON global_settings;
DROP POLICY IF EXISTS "Super admins can update global settings" ON global_settings;

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

-- 7. RLS améliorées pour discount_codes
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Super admins can insert discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Super admins can update discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Super admins can delete discount codes" ON discount_codes;

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

-- 8. RLS pour announcement_banners
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

-- Message de confirmation finale
DO $$
DECLARE
  v_commission_rate NUMERIC;
  v_discount_reduction NUMERIC;
  v_partner_commission NUMERIC;
  v_codes_count INTEGER;
  v_partners_count INTEGER;
BEGIN
  -- Récupérer les paramètres actuels
  SELECT commission_rate, discount_reduction, partner_commission_rate
  INTO v_commission_rate, v_discount_reduction, v_partner_commission
  FROM global_settings WHERE id = 'default';
  
  -- Compter les codes actifs
  SELECT COUNT(*) INTO v_codes_count FROM discount_codes WHERE is_active = TRUE;
  
  -- Compter les partenaires actifs
  SELECT COUNT(*) INTO v_partners_count FROM users WHERE is_partner = TRUE;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ CORRECTION TERMINÉE AVEC SUCCÈS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Commission standard: %% %%', v_commission_rate;
  RAISE NOTICE 'Réduction avec code promo: %% %%', v_discount_reduction;
  RAISE NOTICE 'Commission partenaires: %% %%', v_partner_commission;
  RAISE NOTICE 'Codes promo actifs: %', v_codes_count;
  RAISE NOTICE 'Partenaires actifs: %', v_partners_count;
  RAISE NOTICE '========================================';
END $$;
