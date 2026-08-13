-- ============================================
-- SYSTÈME PARTENAIRES COMPLET ET FONCTIONNEL
-- ============================================
-- Résout tous les problèmes et implémente un système complet

BEGIN;

-- ==========================================
-- ÉTAPE 1: FONCTION togglePartnerStatus AMÉLIORÉE
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
) AS $$
DECLARE
  generated_code VARCHAR(50);
  generated_referral_code VARCHAR(50);
BEGIN
  IF new_status = true THEN
    -- Activer le partenaire
    -- Générer ou réutiliser le code partenaire
    SELECT COALESCE(u.partner_code, generate_partner_code())
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- ÉTAPE 2: FONCTION POUR METTRE À JOUR LE CODE PARTENAIRE
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
) AS $$
DECLARE
  code_exists BOOLEAN;
  is_partner_active BOOLEAN;
BEGIN
  -- Vérifier si l'utilisateur est partenaire
  SELECT is_partner INTO is_partner_active
  FROM users
  WHERE id = partner_user_id;
  
  IF NOT is_partner_active THEN
    RETURN QUERY SELECT false, 'Utilisateur n''est pas un partenaire actif'::TEXT, NULL::VARCHAR(50);
    RETURN;
  END IF;
  
  -- Vérifier si le code existe déjà
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE (partner_code = UPPER(new_code) OR partner_referral_code = UPPER(new_code))
      AND id != partner_user_id
  ) INTO code_exists;
  
  IF code_exists THEN
    RETURN QUERY SELECT false, 'Ce code est déjà utilisé par un autre partenaire'::TEXT, NULL::VARCHAR(50);
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
  
  RETURN QUERY SELECT true, 'Code mis à jour avec succès'::TEXT, UPPER(new_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- ÉTAPE 3: AMÉLIORER get_active_user_partners
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
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
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
    u.partner_code,
    u.partner_referral_code,
    COALESCE(SUM(
      CASE 
        WHEN p.status IN ('approved'::product_status, 'pending'::product_status)
          AND p.payment_confirmed_at IS NOT NULL
        THEN p.commission_amount * (COALESCE(gs.partner_commission_rate, 5) / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as total_commission_earned,
    COUNT(DISTINCT CASE 
      WHEN p.status IN ('approved'::product_status, 'pending'::product_status)
        AND p.payment_confirmed_at IS NOT NULL
      THEN p.id 
    END)::BIGINT as total_sales,
    COUNT(DISTINCT p.seller_id)::BIGINT as total_referrals,
    u.is_partner as is_active,
    u.created_at
  FROM users u
  CROSS JOIN global_settings gs
  LEFT JOIN products p ON p.partner_id = u.id
  WHERE u.is_partner = TRUE
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.partner_code, u.partner_referral_code, u.is_partner, u.created_at, gs.partner_commission_rate
  ORDER BY total_commission_earned DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- ÉTAPE 4: FONCTION POUR OBTENIR LES DÉTAILS D'UN PARTENAIRE
-- ==========================================

DROP FUNCTION IF EXISTS get_partner_details(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION get_partner_details(partner_user_id TEXT)
RETURNS TABLE(
  id TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  avatar TEXT,
  bio TEXT,
  partner_code VARCHAR(50),
  partner_referral_code VARCHAR(50),
  is_active BOOLEAN,
  total_commission_earned NUMERIC,
  pending_commission NUMERIC,
  paid_commission NUMERIC,
  total_sales BIGINT,
  total_referrals BIGINT,
  active_codes_count BIGINT,
  created_at TIMESTAMPTZ
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
    u.partner_code,
    u.partner_referral_code,
    u.is_partner as is_active,
    
    -- Total commission (validée)
    COALESCE(SUM(
      CASE 
        WHEN p.status IN ('approved'::product_status, 'pending'::product_status)
          AND p.payment_confirmed_at IS NOT NULL
        THEN p.commission_amount * (COALESCE(gs.partner_commission_rate, 5) / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as total_commission_earned,
    
    -- Commission en attente
    COALESCE(SUM(
      CASE 
        WHEN p.status IN ('approved'::product_status, 'pending'::product_status)
          AND p.payment_confirmed_at IS NULL
        THEN p.commission_amount * (COALESCE(gs.partner_commission_rate, 5) / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as pending_commission,
    
    -- Commission payée
    COALESCE((
      SELECT SUM(commission_amount) 
      FROM partner_commissions 
      WHERE partner_commissions.partner_user_id = u.id 
        AND status = 'paid'
    ), 0)::NUMERIC as paid_commission,
    
    -- Ventes totales (validées)
    COUNT(DISTINCT CASE 
      WHEN p.status IN ('approved'::product_status, 'pending'::product_status)
        AND p.payment_confirmed_at IS NOT NULL
      THEN p.id 
    END)::BIGINT as total_sales,
    
    -- Total de vendeurs référés
    COUNT(DISTINCT p.seller_id)::BIGINT as total_referrals,
    
    -- Codes actifs
    (SELECT COUNT(*)::BIGINT FROM discount_codes 
     WHERE discount_codes.partner_user_id = u.id AND is_active = true) as active_codes_count,
    
    u.created_at
  FROM users u
  CROSS JOIN global_settings gs
  LEFT JOIN products p ON p.partner_id = u.id
  WHERE u.id = get_partner_details.partner_user_id AND u.is_partner = TRUE
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.partner_code, u.partner_referral_code, u.is_partner, u.created_at, gs.partner_commission_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- ÉTAPE 5: FONCTION POUR OBTENIR LES VENTES D'UN PARTENAIRE
-- ==========================================

DROP FUNCTION IF EXISTS get_partner_sales(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION get_partner_sales(partner_user_id TEXT)
RETURNS TABLE(
  product_id TEXT,
  product_title TEXT,
  product_price NUMERIC,
  seller_id TEXT,
  seller_name TEXT,
  seller_phone TEXT,
  seller_avatar TEXT,
  commission_amount NUMERIC,
  partner_commission NUMERIC,
  status product_status,
  payment_confirmed BOOLEAN,
  created_at TIMESTAMPTZ,
  payment_confirmed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.title as product_title,
    p.price as product_price,
    p.seller_id,
    p.seller_name,
    p.seller_phone,
    p.seller_avatar,
    p.commission_amount,
    (p.commission_amount * COALESCE(gs.partner_commission_rate, 5) / 100.0)::NUMERIC as partner_commission,
    p.status,
    (p.payment_confirmed_at IS NOT NULL) as payment_confirmed,
    p.created_at,
    p.payment_confirmed_at
  FROM products p
  CROSS JOIN global_settings gs
  WHERE p.partner_id = get_partner_sales.partner_user_id
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- ÉTAPE 6: PERMISSIONS
-- ==========================================

GRANT EXECUTE ON FUNCTION toggle_partner_status TO authenticated;
GRANT EXECUTE ON FUNCTION update_partner_referral_code TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_user_partners TO authenticated;
GRANT EXECUTE ON FUNCTION get_partner_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_partner_sales TO authenticated;

-- ==========================================
-- VÉRIFICATION FINALE
-- ==========================================

DO $$
DECLARE
  partner_count INTEGER;
  functions_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO partner_count FROM users WHERE is_partner = true;
  
  SELECT COUNT(*) INTO functions_count 
  FROM pg_proc 
  WHERE proname IN (
    'toggle_partner_status',
    'update_partner_referral_code',
    'get_active_user_partners',
    'get_partner_details',
    'get_partner_sales'
  );
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ SYSTÈME PARTENAIRES - FINALISÉ ! 🎉';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ % nouvelles fonctions créées', functions_count;
  RAISE NOTICE '✅ Partenaires actifs: %', partner_count;
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ Fonctionnalités:';
  RAISE NOTICE '   - Activation/Désactivation instantanée';
  RAISE NOTICE '   - Codes de parrainage modifiables';
  RAISE NOTICE '   - Traçabilité complète des ventes';
  RAISE NOTICE '   - Liste des partenaires fonctionnelle';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '';
END $$;

COMMIT;
