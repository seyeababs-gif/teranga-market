-- =====================================================
-- SYSTÈME DE SUIVI DES CLIENTS RÉFÉRÉS PAR LES PARTENAIRES
-- Permet aux partenaires de voir qui utilise leur code
-- =====================================================

-- ============================================
-- ÉTAPE 1: CRÉER LA TABLE DE TRACKING DES UTILISATIONS DE CODE
-- ============================================

CREATE TABLE IF NOT EXISTS partner_code_usages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    partner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_name TEXT NOT NULL,
    seller_phone TEXT NOT NULL,
    seller_avatar TEXT,
    product_title TEXT NOT NULL,
    product_price DECIMAL(10,2) NOT NULL,
    discount_applied DECIMAL(10,2) NOT NULL,
    code_used TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_partner_code_usages_partner ON partner_code_usages(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_code_usages_product ON partner_code_usages(product_id);
CREATE INDEX IF NOT EXISTS idx_partner_code_usages_seller ON partner_code_usages(seller_id);

-- ============================================
-- ÉTAPE 2: FONCTION POUR ENREGISTRER L'UTILISATION D'UN CODE
-- ============================================

CREATE OR REPLACE FUNCTION track_partner_code_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    discount_amount NUMERIC;
    discount_percent INTEGER;
BEGIN
    -- Enregistrer l'utilisation du code partenaire dès la création du produit
    IF NEW.partner_code_used IS NOT NULL AND NEW.partner_user_id IS NOT NULL THEN
        
        -- Récupérer le pourcentage de réduction
        SELECT dc.discount_percent INTO discount_percent
        FROM discount_codes dc
        WHERE dc.code = NEW.partner_code_used
        LIMIT 1;
        
        -- Si pas trouvé, utiliser les paramètres globaux
        IF discount_percent IS NULL THEN
            SELECT discount_reduction INTO discount_percent
            FROM global_settings
            LIMIT 1;
        END IF;
        
        -- Par défaut 5% si rien trouvé
        IF discount_percent IS NULL THEN
            discount_percent := 5;
        END IF;
        
        -- Calculer le montant de la réduction
        discount_amount := (NEW.price * discount_percent / 100.0);
        
        -- Enregistrer l'utilisation du code
        INSERT INTO partner_code_usages (
            partner_user_id,
            product_id,
            seller_id,
            seller_name,
            seller_phone,
            seller_avatar,
            product_title,
            product_price,
            discount_applied,
            code_used,
            created_at
        ) VALUES (
            NEW.partner_user_id,
            NEW.id,
            NEW.seller_id,
            NEW.seller_name,
            NEW.seller_phone,
            NEW.seller_avatar,
            NEW.title,
            NEW.price,
            discount_amount,
            NEW.partner_code_used,
            NOW()
        )
        ON CONFLICT (id) DO NOTHING;
        
        -- Incrémenter le compteur d'utilisation du code
        UPDATE discount_codes
        SET times_used = times_used + 1
        WHERE code = NEW.partner_code_used;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Créer le trigger pour tracker l'utilisation des codes
DROP TRIGGER IF EXISTS trigger_track_partner_code_usage ON products;
CREATE TRIGGER trigger_track_partner_code_usage
    AFTER INSERT ON products
    FOR EACH ROW
    WHEN (NEW.partner_code_used IS NOT NULL)
    EXECUTE FUNCTION track_partner_code_usage();

-- ============================================
-- ÉTAPE 3: FONCTION POUR RÉCUPÉRER LES CLIENTS QUI ONT UTILISÉ LE CODE
-- ============================================

CREATE OR REPLACE FUNCTION get_partner_referred_clients(partner_user_id TEXT)
RETURNS TABLE (
    id TEXT,
    seller_id TEXT,
    seller_name TEXT,
    seller_phone TEXT,
    seller_avatar TEXT,
    total_products BIGINT,
    total_spent NUMERIC,
    total_discount_received NUMERIC,
    first_use_date TIMESTAMP WITH TIME ZONE,
    last_use_date TIMESTAMP WITH TIME ZONE,
    products JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pcu.seller_id as id,
        pcu.seller_id,
        pcu.seller_name,
        pcu.seller_phone,
        pcu.seller_avatar,
        COUNT(DISTINCT pcu.product_id)::BIGINT as total_products,
        SUM(pcu.product_price) as total_spent,
        SUM(pcu.discount_applied) as total_discount_received,
        MIN(pcu.created_at) as first_use_date,
        MAX(pcu.created_at) as last_use_date,
        jsonb_agg(
            jsonb_build_object(
                'product_id', pcu.product_id,
                'product_title', pcu.product_title,
                'product_price', pcu.product_price,
                'discount_applied', pcu.discount_applied,
                'code_used', pcu.code_used,
                'created_at', pcu.created_at
            ) ORDER BY pcu.created_at DESC
        ) as products
    FROM partner_code_usages pcu
    WHERE pcu.partner_user_id = get_partner_referred_clients.partner_user_id
    GROUP BY pcu.seller_id, pcu.seller_name, pcu.seller_phone, pcu.seller_avatar
    ORDER BY last_use_date DESC;
END;
$$;

-- ============================================
-- ÉTAPE 4: FONCTION POUR RÉCUPÉRER LES DÉTAILS D'UN CLIENT
-- ============================================

CREATE OR REPLACE FUNCTION get_partner_client_details(
    partner_user_id TEXT,
    client_seller_id TEXT
)
RETURNS TABLE (
    product_id TEXT,
    product_title TEXT,
    product_price NUMERIC,
    discount_applied NUMERIC,
    code_used TEXT,
    product_status TEXT,
    commission_amount NUMERIC,
    commission_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pcu.product_id,
        pcu.product_title,
        pcu.product_price,
        pcu.discount_applied,
        pcu.code_used,
        p.status as product_status,
        pc.commission_amount,
        pc.status as commission_status,
        pcu.created_at
    FROM partner_code_usages pcu
    LEFT JOIN products p ON pcu.product_id = p.id
    LEFT JOIN partner_commissions pc ON pcu.product_id = pc.product_id
    WHERE pcu.partner_user_id = get_partner_client_details.partner_user_id
        AND pcu.seller_id = client_seller_id
    ORDER BY pcu.created_at DESC;
END;
$$;

-- ============================================
-- ÉTAPE 5: METTRE À JOUR LA FONCTION get_partner_stats
-- ============================================

DROP FUNCTION IF EXISTS get_partner_stats(TEXT);

CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id TEXT)
RETURNS TABLE (
    total_referrals BIGINT,
    total_clients BIGINT,
    total_sales BIGINT,
    total_commission_earned NUMERIC,
    total_discount_given NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT u.id) as total_referrals,
        COUNT(DISTINCT pcu.seller_id) as total_clients,
        COUNT(DISTINCT pc.product_id) as total_sales,
        COALESCE(SUM(pc.commission_amount), 0) as total_commission_earned,
        COALESCE(SUM(pcu.discount_applied), 0) as total_discount_given
    FROM users u
    LEFT JOIN partner_commissions pc ON u.id = pc.partner_user_id
    LEFT JOIN partner_code_usages pcu ON u.id = pcu.partner_user_id
    WHERE u.id = get_partner_stats.partner_user_id AND u.is_partner = true
    GROUP BY u.id;
END;
$$;

-- ============================================
-- ÉTAPE 6: POLITIQUES RLS
-- ============================================

ALTER TABLE partner_code_usages ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Partners can view own code usages" ON partner_code_usages;
DROP POLICY IF EXISTS "Admins can view all code usages" ON partner_code_usages;
DROP POLICY IF EXISTS "System can manage code usages" ON partner_code_usages;

-- Politiques pour partner_code_usages
CREATE POLICY "Partners can view own code usages"
    ON partner_code_usages FOR SELECT
    USING (
        partner_user_id = auth.uid()::text OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::text 
            AND is_admin = true
        )
    );

CREATE POLICY "System can manage code usages"
    ON partner_code_usages FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- ÉTAPE 7: MIGRER LES DONNÉES EXISTANTES
-- ============================================

-- Remplir partner_code_usages avec les produits existants qui ont un code partenaire
INSERT INTO partner_code_usages (
    partner_user_id,
    product_id,
    seller_id,
    seller_name,
    seller_phone,
    seller_avatar,
    product_title,
    product_price,
    discount_applied,
    code_used,
    created_at
)
SELECT 
    p.partner_user_id,
    p.id,
    p.seller_id,
    p.seller_name,
    p.seller_phone,
    p.seller_avatar,
    p.title,
    p.price,
    COALESCE(
        (p.price * dc.discount_percent / 100.0),
        (p.price * gs.discount_reduction / 100.0),
        (p.price * 5 / 100.0)
    ),
    p.partner_code_used,
    p.created_at
FROM products p
LEFT JOIN discount_codes dc ON p.partner_code_used = dc.code
CROSS JOIN global_settings gs
WHERE p.partner_code_used IS NOT NULL 
    AND p.partner_user_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM partner_code_usages pcu 
        WHERE pcu.product_id = p.id
    );

-- ============================================
-- ÉTAPE 8: VÉRIFICATION
-- ============================================

DO $$
DECLARE
    usage_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO usage_count FROM partner_code_usages;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ SYSTÈME DE TRACKING DES CLIENTS RÉFÉRÉS CRÉÉ';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Utilisations de codes trackées: %', usage_count;
    RAISE NOTICE '========================================';
END $$;
