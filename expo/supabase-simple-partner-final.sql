-- ============================================
-- SIMPLE PARTNER SYSTEM - FINAL VERSION
-- ============================================

-- 1. S'assurer que la colonne is_partner existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_partner'
    ) THEN
        ALTER TABLE users ADD COLUMN is_partner BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. S'assurer que la colonne partner_referral_code existe  
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'partner_referral_code'
    ) THEN
        ALTER TABLE users ADD COLUMN partner_referral_code TEXT;
    END IF;
END $$;

-- 3. Nettoyer les anciennes fonctions (sans erreur si elles n'existent pas)
DROP FUNCTION IF EXISTS get_active_user_partners() CASCADE;
DROP FUNCTION IF EXISTS toggle_partner_status(uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS toggle_partner_status(text, boolean) CASCADE;
DROP FUNCTION IF EXISTS get_partner_stats(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_partner_stats(text) CASCADE;
DROP FUNCTION IF EXISTS update_partner_referral_code(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS update_partner_referral_code(text, text) CASCADE;

-- 4. Créer la fonction pour récupérer les partenaires actifs
CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS TABLE (
    id text,
    name text,
    phone text,
    email text,
    avatar text,
    bio text,
    partner_referral_code text,
    total_commission_earned numeric,
    total_sales bigint,
    created_at timestamp with time zone
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id::text,
        u.name,
        u.phone,
        u.email,
        u.avatar,
        u.bio,
        u.partner_referral_code,
        COALESCE(SUM(p.partner_commission), 0)::numeric as total_commission_earned,
        COUNT(DISTINCT p.id)::bigint as total_sales,
        u.created_at
    FROM users u
    LEFT JOIN products p ON p.partner_id = u.id::text AND p.status = 'approved'
    WHERE u.is_partner = true
    GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.partner_referral_code, u.created_at
    ORDER BY u.created_at DESC;
END;
$$;

-- 5. Créer la fonction pour obtenir les stats d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id text)
RETURNS TABLE (
    total_sales bigint,
    total_commission numeric,
    total_referred_users bigint,
    active_codes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT p.id)::bigint as total_sales,
        COALESCE(SUM(p.partner_commission), 0)::numeric as total_commission,
        COUNT(DISTINCT u.id)::bigint as total_referred_users,
        COUNT(DISTINCT dc.id)::bigint as active_codes
    FROM users usr
    LEFT JOIN products p ON p.partner_id = partner_user_id AND p.status = 'approved'
    LEFT JOIN users u ON u.referred_by_partner_id = partner_user_id
    LEFT JOIN discount_codes dc ON dc.partner_user_id = partner_user_id AND dc.is_active = true
    WHERE usr.id = partner_user_id;
END;
$$;

-- 6. Créer la fonction pour mettre à jour le code de parrainage
CREATE OR REPLACE FUNCTION update_partner_referral_code(
    partner_user_id text,
    new_code text
)
RETURNS TABLE (
    success boolean,
    message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    code_exists boolean;
BEGIN
    -- Vérifier si le code existe déjà
    SELECT EXISTS(
        SELECT 1 FROM users 
        WHERE partner_referral_code = new_code 
        AND id != partner_user_id
    ) INTO code_exists;

    IF code_exists THEN
        RETURN QUERY SELECT false, 'Ce code est déjà utilisé';
        RETURN;
    END IF;

    -- Mettre à jour le code
    UPDATE users 
    SET partner_referral_code = new_code,
        updated_at = NOW()
    WHERE id = partner_user_id;

    RETURN QUERY SELECT true, 'Code mis à jour avec succès';
END;
$$;

-- 7. Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_users_is_partner ON users(is_partner) WHERE is_partner = true;
CREATE INDEX IF NOT EXISTS idx_users_partner_referral_code ON users(partner_referral_code) WHERE partner_referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_partner_id ON products(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discount_codes_partner_user_id ON discount_codes(partner_user_id) WHERE partner_user_id IS NOT NULL;

-- 8. Grant des permissions
GRANT EXECUTE ON FUNCTION get_active_user_partners() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_partner_stats(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_partner_referral_code(text, text) TO authenticated;

-- Succès
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Système de partenaires installé avec succès!';
    RAISE NOTICE '📋 Fonctions créées:';
    RAISE NOTICE '   - get_active_user_partners()';
    RAISE NOTICE '   - get_partner_stats(partner_user_id)';
    RAISE NOTICE '   - update_partner_referral_code(partner_user_id, new_code)';
END $$;
