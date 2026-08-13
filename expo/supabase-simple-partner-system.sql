-- ========================================
-- SYSTÈME PARTENAIRES SIMPLE ET FONCTIONNEL
-- ========================================

-- 1. NETTOYAGE COMPLET
DROP FUNCTION IF EXISTS toggle_partner_status(uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS toggle_partner_status(text, boolean) CASCADE;
DROP FUNCTION IF EXISTS toggle_partner_status(uuid) CASCADE;
DROP FUNCTION IF EXISTS toggle_partner_status(text) CASCADE;
DROP FUNCTION IF EXISTS get_active_user_partners() CASCADE;
DROP FUNCTION IF EXISTS get_partner_stats(text) CASCADE;
DROP FUNCTION IF EXISTS update_partner_referral_code(text, text) CASCADE;

-- 2. S'assurer que les colonnes nécessaires existent
DO $$ 
BEGIN
  -- Ajouter is_partner si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_partner'
  ) THEN
    ALTER TABLE users ADD COLUMN is_partner BOOLEAN DEFAULT false;
  END IF;

  -- Ajouter partner_referral_code si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'partner_referral_code'
  ) THEN
    ALTER TABLE users ADD COLUMN partner_referral_code TEXT;
  END IF;

  -- Ajouter referred_by_partner_id si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'referred_by_partner_id'
  ) THEN
    ALTER TABLE users ADD COLUMN referred_by_partner_id TEXT;
  END IF;

  -- Index pour la performance
  CREATE INDEX IF NOT EXISTS idx_users_is_partner ON users(is_partner) WHERE is_partner = true;
  CREATE INDEX IF NOT EXISTS idx_users_partner_code ON users(partner_referral_code) WHERE partner_referral_code IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_partner_id) WHERE referred_by_partner_id IS NOT NULL;
END $$;

-- 3. FONCTION SIMPLE : Récupérer tous les partenaires actifs
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
  total_sales BIGINT,
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
    COALESCE(u.email, '') as email,
    u.avatar,
    COALESCE(u.bio, '') as bio,
    COALESCE(u.partner_referral_code, '') as partner_referral_code,
    COALESCE(SUM(pc.commission_amount), 0)::NUMERIC as total_commission_earned,
    COALESCE(COUNT(DISTINCT pc.product_id), 0)::BIGINT as total_sales,
    u.created_at
  FROM users u
  LEFT JOIN partner_commissions pc ON pc.partner_user_id = u.id
  WHERE u.is_partner = true
  GROUP BY u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- 4. FONCTION SIMPLE : Obtenir les stats d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id TEXT)
RETURNS TABLE (
  total_referrals BIGINT,
  total_sales BIGINT,
  total_commission_earned NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM users WHERE referred_by_partner_id = partner_user_id)::BIGINT as total_referrals,
    (SELECT COUNT(*) FROM partner_commissions WHERE partner_commissions.partner_user_id = get_partner_stats.partner_user_id)::BIGINT as total_sales,
    COALESCE((SELECT SUM(commission_amount) FROM partner_commissions WHERE partner_commissions.partner_user_id = get_partner_stats.partner_user_id), 0)::NUMERIC as total_commission_earned;
END;
$$;

-- 5. FONCTION SIMPLE : Mettre à jour le code de parrainage d'un partenaire
CREATE OR REPLACE FUNCTION update_partner_referral_code(
  partner_user_id TEXT,
  new_code TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code_exists BOOLEAN;
BEGIN
  -- Vérifier si le code existe déjà
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE partner_referral_code = new_code 
    AND id != partner_user_id
  ) INTO code_exists;

  IF code_exists THEN
    RETURN QUERY SELECT false, 'Ce code de parrainage est déjà utilisé'::TEXT;
    RETURN;
  END IF;

  -- Mettre à jour le code
  UPDATE users
  SET 
    partner_referral_code = new_code,
    updated_at = NOW()
  WHERE id = partner_user_id;

  RETURN QUERY SELECT true, 'Code de parrainage mis à jour avec succès'::TEXT;
END;
$$;

-- 6. PERMISSIONS
GRANT EXECUTE ON FUNCTION get_active_user_partners() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_partner_stats(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_partner_referral_code(TEXT, TEXT) TO anon, authenticated;

-- 7. RLS pour la table users (lecture)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all users" ON users;
CREATE POLICY "Users can view all users" ON users
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Message final
SELECT 
  '✅ Système partenaires installé avec succès' as message,
  '✅ Fonctions créées: get_active_user_partners, get_partner_stats, update_partner_referral_code' as details;
