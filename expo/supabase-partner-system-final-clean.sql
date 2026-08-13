-- =====================================================
-- SCRIPT ULTIME DE CORRECTION DU SYSTÈME PARTENAIRES
-- Exécution en ONE-SHOT - Anticipe toutes les erreurs
-- =====================================================

-- ============================================
-- ÉTAPE 1: NETTOYAGE COMPLET (Suppressions sécurisées)
-- ============================================

-- Supprimer toutes les anciennes fonctions (avec toutes leurs surcharges)
DROP FUNCTION IF EXISTS get_active_user_partners() CASCADE;
DROP FUNCTION IF EXISTS get_partner_stats(text) CASCADE;
DROP FUNCTION IF EXISTS toggle_partner_status(boolean, text) CASCADE;
DROP FUNCTION IF EXISTS toggle_partner_status(text, boolean) CASCADE;
DROP FUNCTION IF EXISTS update_partner_referral_code(text, text) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commissions(text) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commission_stats(text) CASCADE;

-- Supprimer tous les anciens triggers
DROP TRIGGER IF EXISTS trigger_notify_partner_code_used ON products CASCADE;
DROP FUNCTION IF EXISTS notify_partner_code_used() CASCADE;

-- Supprimer toutes les anciennes tables liées aux partenaires (si elles existent)
DROP TABLE IF EXISTS partner_commissions CASCADE;
DROP TABLE IF EXISTS discount_codes CASCADE;

-- ============================================
-- ÉTAPE 2: AJOUT DES COLONNES À LA TABLE USERS
-- ============================================

-- Ajouter les colonnes nécessaires à users si elles n'existent pas
DO $$ 
BEGIN
    -- Colonne is_partner
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_partner'
    ) THEN
        ALTER TABLE users ADD COLUMN is_partner BOOLEAN DEFAULT false;
    END IF;

    -- Colonne partner_referral_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'partner_referral_code'
    ) THEN
        ALTER TABLE users ADD COLUMN partner_referral_code TEXT UNIQUE;
    END IF;

    -- Colonne referred_by_partner_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'referred_by_partner_id'
    ) THEN
        ALTER TABLE users ADD COLUMN referred_by_partner_id TEXT REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Créer des index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_users_is_partner ON users(is_partner) WHERE is_partner = true;
CREATE INDEX IF NOT EXISTS idx_users_partner_referral_code ON users(partner_referral_code) WHERE partner_referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_partner_id) WHERE referred_by_partner_id IS NOT NULL;

-- ============================================
-- ÉTAPE 3: CRÉATION DES TABLES NÉCESSAIRES
-- ============================================

-- Table pour les codes de réduction des partenaires
CREATE TABLE IF NOT EXISTS discount_codes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    discount_percent INTEGER NOT NULL DEFAULT 5,
    partner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    times_used INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour discount_codes
CREATE INDEX IF NOT EXISTS idx_discount_codes_partner ON discount_codes(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code) WHERE is_active = true;

-- Table pour tracker les commissions des partenaires
CREATE TABLE IF NOT EXISTS partner_commissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    partner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_title TEXT NOT NULL,
    product_price DECIMAL(10,2) NOT NULL,
    seller_name TEXT NOT NULL,
    commission_rate INTEGER NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour partner_commissions
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_product ON partner_commissions(product_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);

-- ============================================
-- ÉTAPE 4: AJOUT DES COLONNES À LA TABLE PRODUCTS
-- ============================================

DO $$ 
BEGIN
    -- Colonne partner_code_used
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'partner_code_used'
    ) THEN
        ALTER TABLE products ADD COLUMN partner_code_used TEXT;
    END IF;

    -- Colonne partner_user_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'partner_user_id'
    ) THEN
        ALTER TABLE products ADD COLUMN partner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Colonne commission_rate
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'commission_rate'
    ) THEN
        ALTER TABLE products ADD COLUMN commission_rate INTEGER;
    END IF;

    -- Colonne commission_amount
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'commission_amount'
    ) THEN
        ALTER TABLE products ADD COLUMN commission_amount DECIMAL(10,2);
    END IF;
END $$;

-- Index pour products
CREATE INDEX IF NOT EXISTS idx_products_partner_user ON products(partner_user_id) WHERE partner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_partner_code ON products(partner_code_used) WHERE partner_code_used IS NOT NULL;

-- ============================================
-- ÉTAPE 5: CRÉATION DES FONCTIONS
-- ============================================

-- Fonction: Récupérer tous les partenaires actifs
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
    created_at TIMESTAMP WITH TIME ZONE
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
        u.partner_referral_code,
        COALESCE(SUM(pc.commission_amount), 0) as total_commission_earned,
        COUNT(DISTINCT pc.product_id) as total_sales,
        u.created_at
    FROM users u
    LEFT JOIN partner_commissions pc ON u.id = pc.partner_user_id
    WHERE u.is_partner = true
    GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.partner_referral_code, u.created_at
    ORDER BY u.created_at DESC;
END;
$$;

-- Fonction: Récupérer les stats d'un partenaire
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
        COUNT(DISTINCT u.id) as total_referrals,
        COUNT(DISTINCT pc.product_id) as total_sales,
        COALESCE(SUM(pc.commission_amount), 0) as total_commission_earned
    FROM users u
    LEFT JOIN partner_commissions pc ON u.id = pc.partner_user_id
    WHERE u.id = partner_user_id AND u.is_partner = true;
END;
$$;

-- Fonction: Mettre à jour le code de parrainage d'un partenaire
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
        RETURN QUERY SELECT false, 'Ce code est déjà utilisé par un autre partenaire';
        RETURN;
    END IF;

    -- Mettre à jour le code
    UPDATE users 
    SET 
        partner_referral_code = new_code,
        updated_at = NOW()
    WHERE id = partner_user_id AND is_partner = true;

    RETURN QUERY SELECT true, 'Code mis à jour avec succès';
END;
$$;

-- Fonction: Récupérer les commissions d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_commissions(partner_user_id TEXT)
RETURNS TABLE (
    id TEXT,
    product_id TEXT,
    product_title TEXT,
    product_price NUMERIC,
    seller_id TEXT,
    seller_name TEXT,
    commission_rate INTEGER,
    commission_amount NUMERIC,
    status TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.id,
        pc.product_id,
        pc.product_title,
        pc.product_price,
        pc.seller_id,
        pc.seller_name,
        pc.commission_rate,
        pc.commission_amount,
        pc.status,
        pc.paid_at,
        pc.created_at
    FROM partner_commissions pc
    WHERE pc.partner_user_id = get_partner_commissions.partner_user_id
    ORDER BY pc.created_at DESC;
END;
$$;

-- Fonction: Récupérer les statistiques de commissions
CREATE OR REPLACE FUNCTION get_partner_commission_stats(partner_user_id TEXT)
RETURNS TABLE (
    total_earned NUMERIC,
    total_pending NUMERIC,
    total_paid NUMERIC,
    total_commissions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(commission_amount), 0) as total_earned,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as total_pending,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0) as total_paid,
        COUNT(*) as total_commissions
    FROM partner_commissions
    WHERE partner_commissions.partner_user_id = get_partner_commission_stats.partner_user_id;
END;
$$;

-- ============================================
-- ÉTAPE 6: CRÉATION DU TRIGGER POUR CRÉER LES COMMISSIONS
-- ============================================

-- Fonction trigger: Créer une commission quand un produit avec code partenaire est approuvé
CREATE OR REPLACE FUNCTION create_partner_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    partner_id TEXT;
    partner_name TEXT;
    commission_rate_value INTEGER;
    commission_amount_value NUMERIC;
    global_commission_rate INTEGER;
BEGIN
    -- Vérifier si le produit est approuvé et a un code partenaire
    IF NEW.status = 'approved' AND NEW.partner_code_used IS NOT NULL AND NEW.partner_user_id IS NOT NULL THEN
        
        -- Récupérer le taux de commission global
        SELECT partner_commission_rate INTO global_commission_rate
        FROM global_settings
        LIMIT 1;
        
        -- Utiliser 10% par défaut si pas de valeur dans global_settings
        IF global_commission_rate IS NULL THEN
            global_commission_rate := 10;
        END IF;
        
        -- Calculer le montant de la commission
        commission_rate_value := global_commission_rate;
        commission_amount_value := (NEW.price * commission_rate_value / 100.0);
        
        -- Vérifier que le partenaire existe et est actif
        SELECT id, name INTO partner_id, partner_name
        FROM users
        WHERE id = NEW.partner_user_id AND is_partner = true;
        
        IF partner_id IS NOT NULL THEN
            -- Créer la commission
            INSERT INTO partner_commissions (
                partner_user_id,
                product_id,
                seller_id,
                product_title,
                product_price,
                seller_name,
                commission_rate,
                commission_amount,
                status,
                created_at
            ) VALUES (
                partner_id,
                NEW.id,
                NEW.seller_id,
                NEW.title,
                NEW.price,
                NEW.seller_name,
                commission_rate_value,
                commission_amount_value,
                'pending',
                NOW()
            )
            ON CONFLICT DO NOTHING;
            
            -- Mettre à jour le produit avec les infos de commission
            NEW.commission_rate := commission_rate_value;
            NEW.commission_amount := commission_amount_value;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_create_partner_commission ON products;
CREATE TRIGGER trigger_create_partner_commission
    BEFORE UPDATE ON products
    FOR EACH ROW
    WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
    EXECUTE FUNCTION create_partner_commission();

-- ============================================
-- ÉTAPE 7: POLITIQUES RLS
-- ============================================

-- Activer RLS sur les nouvelles tables
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Anyone can view active discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Admins can manage discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Partners can view own commissions" ON partner_commissions;
DROP POLICY IF EXISTS "Admins can view all commissions" ON partner_commissions;

-- Politiques pour discount_codes
CREATE POLICY "Anyone can view active discount codes"
    ON discount_codes FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage discount codes"
    ON discount_codes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::text 
            AND is_admin = true
        )
    );

-- Politiques pour partner_commissions
CREATE POLICY "Partners can view own commissions"
    ON partner_commissions FOR SELECT
    USING (
        partner_user_id = auth.uid()::text OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::text 
            AND is_admin = true
        )
    );

CREATE POLICY "System can manage commissions"
    ON partner_commissions FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- ÉTAPE 8: INITIALISATION DES CODES PARTENAIRES
-- ============================================

-- Générer des codes de parrainage pour les partenaires existants qui n'en ont pas
UPDATE users
SET partner_referral_code = 'PARTNER' || UPPER(substring(md5(random()::text) from 1 for 6))
WHERE is_partner = true 
AND partner_referral_code IS NULL;

-- ============================================
-- ÉTAPE 9: VÉRIFICATION ET MESSAGES
-- ============================================

DO $$
DECLARE
    partner_count INTEGER;
    commission_count INTEGER;
    code_count INTEGER;
BEGIN
    -- Compter les partenaires
    SELECT COUNT(*) INTO partner_count FROM users WHERE is_partner = true;
    
    -- Compter les commissions
    SELECT COUNT(*) INTO commission_count FROM partner_commissions;
    
    -- Compter les codes de réduction
    SELECT COUNT(*) INTO code_count FROM discount_codes;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ SYSTÈME PARTENAIRES INITIALISÉ AVEC SUCCÈS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Partenaires actifs: %', partner_count;
    RAISE NOTICE 'Codes de réduction: %', code_count;
    RAISE NOTICE 'Commissions: %', commission_count;
    RAISE NOTICE '========================================';
END $$;
