-- ============================================
-- RECONSTRUCTION COMPLÈTE DU SYSTÈME PARTENAIRES
-- ============================================
-- Version: Complete Rebuild - One Shot
-- Résout tous les bugs et reconstruit proprement
-- ============================================

BEGIN;

-- ==========================================
-- ÉTAPE 1: NETTOYER TOUTES LES FONCTIONS
-- ==========================================

DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN 
    SELECT oid::regprocedure as func_signature
    FROM pg_proc 
    WHERE proname IN ('toggle_partner_status', 'get_active_user_partners', 'get_partner_stats', 'update_partner_referral_code')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- ==========================================
-- ÉTAPE 2: VÉRIFIER ET CRÉER LES COLONNES
-- ==========================================

DO $$
BEGIN
  -- Ajouter is_partner si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_partner'
  ) THEN
    ALTER TABLE users ADD COLUMN is_partner BOOLEAN DEFAULT FALSE;
  END IF;

  -- Ajouter partner_code si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'partner_code'
  ) THEN
    ALTER TABLE users ADD COLUMN partner_code VARCHAR(50);
  END IF;

  -- Ajouter partner_referral_code si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'partner_referral_code'
  ) THEN
    ALTER TABLE users ADD COLUMN partner_referral_code VARCHAR(50);
  END IF;

  -- Ajouter is_super_admin si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- S'assurer que partner_id dans products est TEXT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE products ADD COLUMN partner_id TEXT;
  ELSE
    -- Convertir en TEXT si ce n'est pas déjà le cas
    ALTER TABLE products ALTER COLUMN partner_id TYPE TEXT USING partner_id::TEXT;
  END IF;
END $$;

-- Ajouter les colonnes manquantes dans products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'partner_code_used'
  ) THEN
    ALTER TABLE products ADD COLUMN partner_code_used VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'commission_amount'
  ) THEN
    ALTER TABLE products ADD COLUMN commission_amount DECIMAL(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'discount_code'
  ) THEN
    ALTER TABLE products ADD COLUMN discount_code TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'discount_code_applied'
  ) THEN
    ALTER TABLE products ADD COLUMN discount_code_applied BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'payment_confirmed_at'
  ) THEN
    ALTER TABLE products ADD COLUMN payment_confirmed_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'payment_confirmed_by'
  ) THEN
    ALTER TABLE products ADD COLUMN payment_confirmed_by TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'wave_payment_reference'
  ) THEN
    ALTER TABLE products ADD COLUMN wave_payment_reference TEXT;
  END IF;
END $$;

-- Convertir la colonne status en TEXT si ce n'est pas déjà le cas
DO $$
BEGIN
  -- Vérifier si status est de type enum
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'status' 
    AND data_type != 'text'
  ) THEN
    -- Supprimer temporairement les politiques qui dépendent de status
    DROP POLICY IF EXISTS "Users can view products" ON products;
    
    -- Convertir en TEXT
    ALTER TABLE products ALTER COLUMN status TYPE TEXT USING status::TEXT;
    
    -- Recréer la politique
    CREATE POLICY "Users can view products" ON products FOR SELECT USING (
      status = 'approved' OR 
      seller_id = auth.uid()::text OR
      (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true
    );
  END IF;
END $$;

-- ==========================================
-- ÉTAPE 3: CRÉER LA TABLE discount_codes
-- ==========================================

CREATE TABLE IF NOT EXISTS discount_codes (
  id TEXT PRIMARY KEY DEFAULT ('disc-' || gen_random_uuid()::TEXT),
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  discount_percent INTEGER NOT NULL,
  partner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_limit INTEGER,
  times_used INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_partner ON discount_codes(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);

-- ==========================================
-- ÉTAPE 4: CRÉER LA TABLE global_settings
-- ==========================================

CREATE TABLE IF NOT EXISTS global_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  commission_rate DECIMAL(5,2) DEFAULT 15,
  discount_reduction DECIMAL(5,2) DEFAULT 5,
  partner_commission_rate DECIMAL(5,2) DEFAULT 5,
  global_premium_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO global_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- ÉTAPE 5: CRÉER toggle_partner_status
-- ==========================================

CREATE OR REPLACE FUNCTION toggle_partner_status(
  target_user_id TEXT,
  new_status BOOLEAN
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  partner_code VARCHAR(50),
  partner_referral_code VARCHAR(50)
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  generated_code VARCHAR(50);
  generated_referral_code VARCHAR(50);
  user_exists BOOLEAN;
BEGIN
  -- Vérifier que l'utilisateur existe
  SELECT EXISTS(SELECT 1 FROM users WHERE id = target_user_id) INTO user_exists;
  
  IF NOT user_exists THEN
    RETURN QUERY SELECT 
      false, 
      'Utilisateur introuvable'::TEXT, 
      NULL::VARCHAR(50),
      NULL::VARCHAR(50);
    RETURN;
  END IF;

  IF new_status = true THEN
    -- Activer le partenaire
    -- Générer ou réutiliser le code partenaire
    SELECT COALESCE(u.partner_code, 'PART' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8)))
    INTO generated_code
    FROM users u
    WHERE u.id = target_user_id;
    
    generated_referral_code := generated_code;
    
    -- Mettre à jour l'utilisateur
    UPDATE users 
    SET 
      is_partner = true,
      partner_code = generated_code,
      partner_referral_code = generated_referral_code
    WHERE id = target_user_id;
    
    -- Créer un code promo automatique si aucun n'existe
    INSERT INTO discount_codes (
      id,
      code,
      description,
      discount_percent,
      partner_user_id,
      is_active,
      created_at
    )
    SELECT
      'disc-' || gen_random_uuid()::TEXT,
      generated_code,
      'Code de réduction partenaire',
      (SELECT COALESCE(discount_reduction, 10) FROM global_settings LIMIT 1),
      target_user_id,
      true,
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM discount_codes 
      WHERE partner_user_id = target_user_id AND is_active = true
    );
    
    RETURN QUERY SELECT 
      true, 
      'Utilisateur promu partenaire avec succès'::TEXT, 
      generated_code,
      generated_referral_code;
  ELSE
    -- Désactiver le partenaire
    UPDATE users 
    SET is_partner = false
    WHERE id = target_user_id;
    
    -- Désactiver tous les codes du partenaire
    UPDATE discount_codes
    SET is_active = false
    WHERE partner_user_id = target_user_id;
    
    RETURN QUERY SELECT 
      true, 
      'Partenaire désactivé avec succès'::TEXT, 
      NULL::VARCHAR(50),
      NULL::VARCHAR(50);
  END IF;
END;
$$;

-- ==========================================
-- ÉTAPE 6: CRÉER get_active_user_partners
-- ==========================================

CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS TABLE(
  id TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  avatar TEXT,
  bio TEXT,
  partner_code VARCHAR(50),
  partner_referral_code VARCHAR(50),
  total_commission_earned NUMERIC,
  total_sales BIGINT,
  total_referrals BIGINT,
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
    COALESCE(u.partner_code, '')::VARCHAR(50) as partner_code,
    COALESCE(u.partner_referral_code, '')::VARCHAR(50) as partner_referral_code,
    COALESCE(SUM(
      CASE 
        WHEN p.status IN ('approved', 'pending')
          AND p.payment_confirmed_at IS NOT NULL
          AND p.partner_id = u.id
        THEN p.commission_amount * (COALESCE(gs.partner_commission_rate, 5) / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as total_commission_earned,
    COUNT(DISTINCT CASE 
      WHEN p.status IN ('approved', 'pending')
        AND p.payment_confirmed_at IS NOT NULL
        AND p.partner_id = u.id
      THEN p.id 
    END)::BIGINT as total_sales,
    COUNT(DISTINCT CASE 
      WHEN p.partner_id = u.id
      THEN p.seller_id 
    END)::BIGINT as total_referrals,
    u.created_at
  FROM users u
  CROSS JOIN global_settings gs
  LEFT JOIN products p ON p.partner_id = u.id
  WHERE u.is_partner = TRUE
  GROUP BY 
    u.id, 
    u.name, 
    u.phone, 
    u.email, 
    u.avatar, 
    u.bio, 
    u.partner_code, 
    u.partner_referral_code, 
    u.created_at, 
    gs.partner_commission_rate
  ORDER BY total_commission_earned DESC;
END;
$$;

-- ==========================================
-- ÉTAPE 7: CRÉER get_partner_stats
-- ==========================================

CREATE OR REPLACE FUNCTION get_partner_stats(
  partner_user_id TEXT
)
RETURNS TABLE(
  total_commission_earned NUMERIC,
  pending_commission NUMERIC,
  total_sales BIGINT,
  total_referrals BIGINT,
  active_codes_count BIGINT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  user_exists BOOLEAN;
BEGIN
  -- Vérifier que l'utilisateur existe et est partenaire
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE id = partner_user_id AND is_partner = TRUE
  ) INTO user_exists;
  
  IF NOT user_exists THEN
    RETURN QUERY SELECT 
      0::NUMERIC,
      0::NUMERIC,
      0::BIGINT,
      0::BIGINT,
      0::BIGINT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    -- Total commission (validée)
    COALESCE(SUM(
      CASE 
        WHEN p.status IN ('approved', 'pending')
          AND p.payment_confirmed_at IS NOT NULL
          AND p.partner_id = get_partner_stats.partner_user_id
        THEN p.commission_amount * (COALESCE(gs.partner_commission_rate, 5) / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as total_commission_earned,
    
    -- Commission en attente
    COALESCE(SUM(
      CASE 
        WHEN p.status IN ('approved', 'pending')
          AND p.payment_confirmed_at IS NULL
          AND p.partner_id = get_partner_stats.partner_user_id
        THEN p.commission_amount * (COALESCE(gs.partner_commission_rate, 5) / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as pending_commission,
    
    -- Ventes totales (validées)
    COUNT(DISTINCT CASE 
      WHEN p.status IN ('approved', 'pending')
        AND p.payment_confirmed_at IS NOT NULL
        AND p.partner_id = get_partner_stats.partner_user_id
      THEN p.id 
    END)::BIGINT as total_sales,
    
    -- Total de vendeurs référés
    COUNT(DISTINCT CASE 
      WHEN p.partner_id = get_partner_stats.partner_user_id
      THEN p.seller_id 
    END)::BIGINT as total_referrals,
    
    -- Codes actifs
    (SELECT COUNT(*)::BIGINT FROM discount_codes 
     WHERE discount_codes.partner_user_id = get_partner_stats.partner_user_id 
       AND is_active = true) as active_codes_count
  FROM products p
  CROSS JOIN global_settings gs;
END;
$$;

-- ==========================================
-- ÉTAPE 8: CRÉER update_partner_referral_code
-- ==========================================

CREATE OR REPLACE FUNCTION update_partner_referral_code(
  partner_user_id TEXT,
  new_code VARCHAR(50)
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  updated_code VARCHAR(50)
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  code_exists BOOLEAN;
  is_partner_active BOOLEAN;
  user_exists BOOLEAN;
BEGIN
  -- Vérifier si l'utilisateur existe
  SELECT EXISTS(SELECT 1 FROM users WHERE id = partner_user_id) INTO user_exists;
  
  IF NOT user_exists THEN
    RETURN QUERY SELECT 
      false, 
      'Utilisateur introuvable'::TEXT, 
      NULL::VARCHAR(50);
    RETURN;
  END IF;

  -- Vérifier si l'utilisateur est partenaire
  SELECT is_partner INTO is_partner_active
  FROM users
  WHERE id = partner_user_id;
  
  IF NOT is_partner_active THEN
    RETURN QUERY SELECT 
      false, 
      'Utilisateur n''est pas un partenaire actif'::TEXT, 
      NULL::VARCHAR(50);
    RETURN;
  END IF;
  
  -- Vérifier si le code existe déjà
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE (partner_code = UPPER(new_code) OR partner_referral_code = UPPER(new_code))
      AND id != partner_user_id
  ) INTO code_exists;
  
  IF code_exists THEN
    RETURN QUERY SELECT 
      false, 
      'Ce code est déjà utilisé par un autre partenaire'::TEXT, 
      NULL::VARCHAR(50);
    RETURN;
  END IF;
  
  -- Mettre à jour le code dans users
  UPDATE users 
  SET 
    partner_code = UPPER(new_code),
    partner_referral_code = UPPER(new_code)
  WHERE id = partner_user_id;
  
  -- Mettre à jour le code dans discount_codes
  UPDATE discount_codes
  SET code = UPPER(new_code)
  WHERE partner_user_id = partner_user_id AND is_active = true;
  
  -- Si aucun code actif n'existe, en créer un
  INSERT INTO discount_codes (
    id,
    code,
    description,
    discount_percent,
    partner_user_id,
    is_active,
    created_at
  )
  SELECT
    'disc-' || gen_random_uuid()::TEXT,
    UPPER(new_code),
    'Code de réduction partenaire',
    (SELECT COALESCE(discount_reduction, 10) FROM global_settings LIMIT 1),
    partner_user_id,
    true,
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM discount_codes 
    WHERE partner_user_id = partner_user_id AND is_active = true
  );
  
  RETURN QUERY SELECT 
    true, 
    'Code mis à jour avec succès'::TEXT, 
    UPPER(new_code);
END;
$$;

-- ==========================================
-- ÉTAPE 9: CRÉER is_global_premium_active
-- ==========================================

CREATE OR REPLACE FUNCTION is_global_premium_active()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_active BOOLEAN;
BEGIN
  SELECT global_premium_active INTO is_active
  FROM global_settings
  LIMIT 1;
  
  RETURN COALESCE(is_active, FALSE);
END;
$$;

-- ==========================================
-- ÉTAPE 10: PERMISSIONS
-- ==========================================

GRANT EXECUTE ON FUNCTION toggle_partner_status TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_active_user_partners TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_partner_stats TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_partner_referral_code TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_global_premium_active TO authenticated, anon;

-- Permissions sur les tables
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Admins can manage discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Anyone can view settings" ON global_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON global_settings;

CREATE POLICY "Anyone can view discount codes" ON discount_codes FOR SELECT USING (true);
CREATE POLICY "Admins can manage discount codes" ON discount_codes FOR ALL USING (
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

CREATE POLICY "Anyone can view settings" ON global_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update settings" ON global_settings FOR UPDATE USING (
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

-- ==========================================
-- ÉTAPE 11: NETTOYAGE DES DONNÉES INVALIDES
-- ==========================================

DO $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Nettoyer les partner_id invalides (IDs locaux "user-xxx" qui ne sont pas dans users)
  UPDATE products 
  SET partner_id = NULL 
  WHERE partner_id IS NOT NULL 
    AND partner_id NOT IN (SELECT id FROM users WHERE is_partner = true);
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
END $$;

-- ==========================================
-- ÉTAPE 12: CRÉER DES INDEX
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_users_partner ON users(is_partner) WHERE is_partner = true;
CREATE INDEX IF NOT EXISTS idx_users_partner_code ON users(partner_code) WHERE partner_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_partner_id ON products(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_payment_confirmed ON products(payment_confirmed_at) WHERE payment_confirmed_at IS NOT NULL;

COMMIT;
