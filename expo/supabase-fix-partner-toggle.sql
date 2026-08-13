-- ========================================
-- FIX DÉFINITIF DU SYSTÈME PARTENAIRES
-- ========================================

-- 1. Supprimer toutes les anciennes fonctions toggle_partner_status
DROP FUNCTION IF EXISTS toggle_partner_status(uuid, boolean);
DROP FUNCTION IF EXISTS toggle_partner_status(text, boolean);
DROP FUNCTION IF EXISTS toggle_partner_status(uuid);
DROP FUNCTION IF EXISTS toggle_partner_status(text);

-- 2. Créer une fonction simple et fiable pour toggle le statut partenaire
CREATE OR REPLACE FUNCTION toggle_partner_status(
  target_user_id TEXT,
  new_status BOOLEAN
) RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
BEGIN
  -- Vérifier que l'utilisateur existe
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = target_user_id) THEN
    RETURN QUERY SELECT false, 'Utilisateur introuvable';
    RETURN;
  END IF;
  
  -- Mettre à jour le statut partenaire
  UPDATE users
  SET 
    is_partner = new_status,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  -- Si on désactive le partenaire, désactiver tous ses codes
  IF new_status = false THEN
    UPDATE discount_codes
    SET is_active = false
    WHERE partner_user_id = target_user_id;
  END IF;
  
  RETURN QUERY SELECT true, 'Statut partenaire mis à jour avec succès';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Vérifier et créer la fonction get_active_user_partners si nécessaire
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
  total_sales INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.phone,
    COALESCE(u.email, '') as email,
    u.avatar,
    COALESCE(u.bio, '') as bio,
    COALESCE(u.partner_referral_code, '') as partner_referral_code,
    COALESCE(SUM(pc.commission_amount), 0)::NUMERIC as total_commission_earned,
    COALESCE(COUNT(DISTINCT pc.product_id), 0)::INTEGER as total_sales,
    u.created_at
  FROM users u
  LEFT JOIN partner_commissions pc ON pc.partner_user_id = u.id
  WHERE u.is_partner = true
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.partner_referral_code, u.created_at
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Permissions
GRANT EXECUTE ON FUNCTION toggle_partner_status(TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_user_partners() TO anon, authenticated;

-- Message de confirmation
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Système partenaires corrigé avec succès';
  RAISE NOTICE '✅ Fonction toggle_partner_status recréée';
  RAISE NOTICE '✅ Fonction get_active_user_partners mise à jour';
END $$;
