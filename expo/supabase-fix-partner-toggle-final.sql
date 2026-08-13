-- ============================================
-- FIX FINAL POUR LE TOGGLE PARTENAIRE
-- ============================================

-- Supprimer l'ancienne fonction avec tous les types possibles
DROP FUNCTION IF EXISTS toggle_partner_status(TEXT, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS toggle_partner_status(UUID, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS toggle_partner_status(VARCHAR, BOOLEAN) CASCADE;

-- Fonction pour générer un code partenaire unique
CREATE OR REPLACE FUNCTION generate_unique_partner_code()
RETURNS VARCHAR(50) AS $$
DECLARE
  new_code VARCHAR(50);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Générer un code aléatoire
    new_code := 'PART' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    
    -- Vérifier si le code existe déjà
    SELECT EXISTS(
      SELECT 1 FROM users WHERE partner_code = new_code
      UNION
      SELECT 1 FROM discount_codes WHERE code = new_code
    ) INTO code_exists;
    
    -- Si le code n'existe pas, on l'utilise
    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Nouvelle fonction toggle_partner_status avec gestion d'erreurs améliorée
CREATE OR REPLACE FUNCTION toggle_partner_status(
  target_user_id UUID,
  new_status BOOLEAN
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  partner_code VARCHAR(50),
  user_id UUID
) AS $$
DECLARE
  v_partner_code VARCHAR(50);
  v_user_exists BOOLEAN;
  v_discount_reduction INTEGER;
BEGIN
  -- Vérifier que l'utilisateur existe
  SELECT EXISTS(SELECT 1 FROM users WHERE id = target_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RETURN QUERY SELECT false, 'Utilisateur introuvable'::TEXT, NULL::VARCHAR(50), NULL::UUID;
    RETURN;
  END IF;

  -- Récupérer la réduction globale
  SELECT COALESCE(discount_reduction, 5) INTO v_discount_reduction
  FROM global_settings
  LIMIT 1;

  IF new_status = true THEN
    -- ========================================
    -- ACTIVER LE STATUT PARTENAIRE
    -- ========================================
    
    -- Récupérer ou générer le code partenaire
    SELECT partner_code INTO v_partner_code
    FROM users
    WHERE id = target_user_id;
    
    -- Si pas de code existant, en générer un nouveau
    IF v_partner_code IS NULL OR v_partner_code = '' THEN
      v_partner_code := generate_unique_partner_code();
    END IF;
    
    -- Mettre à jour l'utilisateur
    UPDATE users 
    SET 
      is_partner = true,
      partner_code = v_partner_code
    WHERE id = target_user_id;
    
    -- Créer ou activer un code promo pour ce partenaire
    INSERT INTO discount_codes (
      id,
      code,
      description,
      discount_percent,
      partner_user_id,
      is_active,
      times_used,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_partner_code,
      'Code de réduction partenaire',
      v_discount_reduction,
      target_user_id,
      true,
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (code) DO UPDATE SET
      is_active = true,
      partner_user_id = target_user_id,
      discount_percent = v_discount_reduction,
      updated_at = NOW();
    
    RETURN QUERY SELECT true, 'Partenaire activé avec succès'::TEXT, v_partner_code, target_user_id;
    
  ELSE
    -- ========================================
    -- DÉSACTIVER LE STATUT PARTENAIRE
    -- ========================================
    
    -- Récupérer le code partenaire actuel
    SELECT partner_code INTO v_partner_code
    FROM users
    WHERE id = target_user_id;
    
    -- Mettre à jour l'utilisateur
    UPDATE users 
    SET is_partner = false
    WHERE id = target_user_id;
    
    -- Désactiver tous les codes promo du partenaire
    UPDATE discount_codes
    SET 
      is_active = false,
      updated_at = NOW()
    WHERE partner_user_id = target_user_id;
    
    RETURN QUERY SELECT true, 'Partenaire désactivé avec succès'::TEXT, v_partner_code, target_user_id;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- En cas d'erreur, retourner l'erreur
    RETURN QUERY SELECT false, 'Erreur: ' || SQLERRM, NULL::VARCHAR(50), NULL::UUID;
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
GRANT EXECUTE ON FUNCTION toggle_partner_status TO authenticated;
GRANT EXECUTE ON FUNCTION generate_unique_partner_code TO authenticated;

-- ============================================
-- VÉRIFICATION ET RÉPARATION DES DONNÉES
-- ============================================

-- S'assurer que tous les partenaires actifs ont un code
DO $$
DECLARE
  r RECORD;
  new_code VARCHAR(50);
BEGIN
  FOR r IN 
    SELECT id, partner_code 
    FROM users 
    WHERE is_partner = true 
      AND (partner_code IS NULL OR partner_code = '')
  LOOP
    -- Générer un code unique pour ce partenaire
    new_code := generate_unique_partner_code();
    
    -- Mettre à jour l'utilisateur
    UPDATE users 
    SET partner_code = new_code
    WHERE id = r.id;
    
    -- Créer un code promo pour ce partenaire si aucun n'existe
    INSERT INTO discount_codes (
      id,
      code,
      description,
      discount_percent,
      partner_user_id,
      is_active,
      times_used,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      new_code,
      'Code de réduction partenaire',
      (SELECT COALESCE(discount_reduction, 5) FROM global_settings LIMIT 1),
      r.id,
      true,
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (code) DO NOTHING;
    
    RAISE NOTICE 'Code % créé pour le partenaire %', new_code, r.id;
  END LOOP;
END $$;

-- Afficher un résumé
SELECT 
  COUNT(*) FILTER (WHERE is_partner = true) as "Partenaires actifs",
  COUNT(*) FILTER (WHERE is_partner = true AND partner_code IS NOT NULL) as "Avec code",
  COUNT(*) FILTER (WHERE is_partner = true AND partner_code IS NULL) as "Sans code"
FROM users;

SELECT 'Migration terminée avec succès' as status;
