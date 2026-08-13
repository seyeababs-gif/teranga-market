-- ============================================
-- CORRECTION COMPLÈTE ET DÉFINITIVE DU SYSTÈME PARTENAIRES
-- ============================================
-- Résout: invalid input syntax for type uuid
-- Assure le fonctionnement avec Supabase Auth

BEGIN;

-- ==========================================
-- ÉTAPE 1: VÉRIFIER ET CORRIGER LA STRUCTURE
-- ==========================================

-- S'assurer que partner_id dans products est bien TEXT et non UUID
DO $$
BEGIN
  -- Vérifier le type de partner_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'partner_id' 
    AND data_type != 'text'
  ) THEN
    ALTER TABLE products ALTER COLUMN partner_id TYPE TEXT USING partner_id::TEXT;
    RAISE NOTICE '✅ Colonne partner_id convertie en TEXT';
  END IF;
END $$;

-- ==========================================
-- ÉTAPE 2: RECRÉER togglePartnerStatus AVEC GESTION ROBUSTE
-- ==========================================

DROP FUNCTION IF EXISTS toggle_partner_status(TEXT, BOOLEAN) CASCADE;

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
-- ÉTAPE 3: RECRÉER get_active_user_partners SÉCURISÉ
-- ==========================================

DROP FUNCTION IF EXISTS get_active_user_partners() CASCADE;

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
        WHEN p.status IN ('approved'::product_status, 'pending'::product_status)
          AND p.payment_confirmed_at IS NOT NULL
          AND p.partner_id = u.id
        THEN p.commission_amount * (COALESCE(gs.partner_commission_rate, 5) / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as total_commission_earned,
    COUNT(DISTINCT CASE 
      WHEN p.status IN ('approved'::product_status, 'pending'::product_status)
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
-- ÉTAPE 4: RECRÉER get_partner_stats SÉCURISÉ
-- ==========================================

DROP FUNCTION IF EXISTS get_partner_stats(TEXT) CASCADE;

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
        WHEN p.status IN ('approved'::product_status, 'pending'::product_status)
          AND p.payment_confirmed_at IS NOT NULL
          AND p.partner_id = get_partner_stats.partner_user_id
        THEN p.commission_amount * (COALESCE(gs.partner_commission_rate, 5) / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as total_commission_earned,
    
    -- Commission en attente
    COALESCE(SUM(
      CASE 
        WHEN p.status IN ('approved'::product_status, 'pending'::product_status)
          AND p.payment_confirmed_at IS NULL
          AND p.partner_id = get_partner_stats.partner_user_id
        THEN p.commission_amount * (COALESCE(gs.partner_commission_rate, 5) / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as pending_commission,
    
    -- Ventes totales (validées)
    COUNT(DISTINCT CASE 
      WHEN p.status IN ('approved'::product_status, 'pending'::product_status)
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
-- ÉTAPE 5: FONCTION update_partner_referral_code
-- ==========================================

DROP FUNCTION IF EXISTS update_partner_referral_code(TEXT, VARCHAR) CASCADE;

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
-- ÉTAPE 6: PERMISSIONS
-- ==========================================

GRANT EXECUTE ON FUNCTION toggle_partner_status TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_active_user_partners TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_partner_stats TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_partner_referral_code TO authenticated;

-- ==========================================
-- ÉTAPE 7: NETTOYAGE ET VÉRIFICATIONS FINALES
-- ==========================================

DO $$
DECLARE
  partner_count INTEGER;
  functions_count INTEGER;
  invalid_partner_ids INTEGER;
  cleaned_count INTEGER;
BEGIN
  -- Nettoyer les partner_id invalides (IDs locaux "user-xxx")
  UPDATE products 
  SET partner_id = NULL 
  WHERE partner_id IS NOT NULL 
    AND partner_id NOT IN (SELECT id FROM users WHERE is_partner = true);
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Compter les partenaires
  SELECT COUNT(*) INTO partner_count FROM users WHERE is_partner = true;
  
  -- Compter les fonctions
  SELECT COUNT(*) INTO functions_count 
  FROM pg_proc 
  WHERE proname IN (
    'toggle_partner_status',
    'update_partner_referral_code',
    'get_active_user_partners',
    'get_partner_stats'
  );
  
  -- Vérifier les partner_id invalides restants
  SELECT COUNT(*) INTO invalid_partner_ids
  FROM products
  WHERE partner_id IS NOT NULL 
    AND partner_id NOT IN (SELECT id FROM users);
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ SYSTÈME PARTENAIRES - CORRECTION COMPLÈTE ! 🎉';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ Fonctions créées/mises à jour: %', functions_count;
  RAISE NOTICE '✅ Partenaires actifs: %', partner_count;
  RAISE NOTICE '✅ IDs partenaires nettoyés: %', cleaned_count;
  RAISE NOTICE '✅ IDs partenaires invalides restants: %', invalid_partner_ids;
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ Corrections appliquées:';
  RAISE NOTICE '   ✓ Types de colonnes corrigés (TEXT au lieu de UUID)';
  RAISE NOTICE '   ✓ Vérifications d''existence des utilisateurs';
  RAISE NOTICE '   ✓ Gestion des erreurs améliorée';
  RAISE NOTICE '   ✓ Nettoyage des données invalides';
  RAISE NOTICE '   ✓ Activation/Désactivation instantanée des partenaires';
  RAISE NOTICE '   ✓ Gestion des codes de parrainage par le super admin';
  RAISE NOTICE '   ✓ Traçabilité des ventes validées par partenaire';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '';
END $$;

COMMIT;
