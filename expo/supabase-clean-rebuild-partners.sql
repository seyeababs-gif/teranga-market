-- ============================================
-- NETTOYAGE COMPLET ET RECONSTRUCTION ONE-SHOT
-- ============================================

-- Étape 1 : Supprimer TOUTES les fonctions en double (peu importe leur signature)
DO $$ 
DECLARE
    func_record RECORD;
BEGIN
    -- Supprimer toutes les fonctions liées au système partenaire
    FOR func_record IN 
        SELECT n.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname IN (
            'toggle_partner_status',
            'update_partner_referral_code',
            'generate_referral_code',
            'get_active_user_partners',
            'get_partner_commissions',
            'calculate_partner_commission'
        )
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
            func_record.schema_name, 
            func_record.function_name,
            func_record.args
        );
    END LOOP;
END $$;

-- Étape 2 : Supprimer les triggers liés
DROP TRIGGER IF EXISTS trigger_notify_partner_code_used ON products CASCADE;

-- Étape 3 : Supprimer les anciennes tables de tracking si elles existent
DROP TABLE IF EXISTS partner_commissions CASCADE;
DROP TABLE IF EXISTS partner_referrals CASCADE;

-- Étape 4 : S'assurer que les colonnes nécessaires existent dans profiles
DO $$ 
BEGIN
    -- is_partner
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_partner') THEN
        ALTER TABLE profiles ADD COLUMN is_partner BOOLEAN DEFAULT false;
    END IF;
    
    -- partner_code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'partner_code') THEN
        ALTER TABLE profiles ADD COLUMN partner_code TEXT;
    END IF;
    
    -- commission_rate
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'commission_rate') THEN
        ALTER TABLE profiles ADD COLUMN commission_rate NUMERIC(5,2) DEFAULT 10.00;
    END IF;
END $$;

-- Étape 5 : S'assurer que products a la colonne partner_code (pas partner_id)
DO $$ 
BEGIN
    -- Supprimer partner_id si elle existe
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'partner_id') THEN
        ALTER TABLE products DROP COLUMN partner_id CASCADE;
    END IF;
    
    -- Ajouter partner_code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'partner_code') THEN
        ALTER TABLE products ADD COLUMN partner_code TEXT;
    END IF;
END $$;

-- Étape 6 : Créer la table de tracking des commissions
CREATE TABLE IF NOT EXISTS partner_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    order_id UUID,
    commission_amount NUMERIC(10,2) NOT NULL,
    product_price NUMERIC(10,2) NOT NULL,
    commission_rate NUMERIC(5,2) NOT NULL,
    partner_code TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_customer ON partner_commissions(customer_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);

-- Étape 7 : Créer une fonction simple pour générer un code unique
CREATE OR REPLACE FUNCTION generate_unique_partner_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Générer un code de 8 caractères alphanumériques
        new_code := UPPER(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
        
        -- Vérifier s'il existe déjà
        SELECT EXISTS(SELECT 1 FROM profiles WHERE partner_code = new_code) INTO code_exists;
        
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Étape 8 : Fonction pour activer/désactiver un partenaire
CREATE OR REPLACE FUNCTION toggle_partner_status(
    target_user_id UUID,
    new_status BOOLEAN
)
RETURNS JSON AS $$
DECLARE
    result_code TEXT;
BEGIN
    -- Mettre à jour le statut
    UPDATE profiles 
    SET is_partner = new_status,
        partner_code = CASE 
            WHEN new_status = true AND (partner_code IS NULL OR partner_code = '') 
            THEN generate_unique_partner_code()
            ELSE partner_code 
        END
    WHERE id = target_user_id;
    
    -- Récupérer le code
    SELECT partner_code INTO result_code 
    FROM profiles 
    WHERE id = target_user_id;
    
    RETURN json_build_object(
        'success', true,
        'is_partner', new_status,
        'partner_code', result_code
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 9 : Fonction pour mettre à jour le code partenaire
CREATE OR REPLACE FUNCTION update_partner_code(
    target_user_id UUID,
    new_code TEXT
)
RETURNS JSON AS $$
DECLARE
    code_exists BOOLEAN;
BEGIN
    -- Vérifier si le code existe déjà
    SELECT EXISTS(
        SELECT 1 FROM profiles 
        WHERE partner_code = new_code 
        AND id != target_user_id
    ) INTO code_exists;
    
    IF code_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Ce code est déjà utilisé'
        );
    END IF;
    
    -- Mettre à jour
    UPDATE profiles 
    SET partner_code = UPPER(new_code)
    WHERE id = target_user_id;
    
    RETURN json_build_object(
        'success', true,
        'partner_code', UPPER(new_code)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 10 : Fonction pour obtenir les partenaires actifs
CREATE OR REPLACE FUNCTION get_all_partners()
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    is_partner BOOLEAN,
    partner_code TEXT,
    commission_rate NUMERIC,
    total_commissions NUMERIC,
    total_referrals BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.full_name,
        p.is_partner,
        p.partner_code,
        p.commission_rate,
        COALESCE(SUM(pc.commission_amount), 0) as total_commissions,
        COUNT(DISTINCT pc.id) as total_referrals
    FROM profiles p
    LEFT JOIN partner_commissions pc ON pc.partner_id = p.id
    WHERE p.is_partner = true
    GROUP BY p.id, p.email, p.full_name, p.is_partner, p.partner_code, p.commission_rate
    ORDER BY p.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 11 : Fonction pour obtenir les commissions d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_commission_details(target_partner_id UUID)
RETURNS TABLE (
    id UUID,
    customer_email TEXT,
    customer_name TEXT,
    product_title TEXT,
    commission_amount NUMERIC,
    product_price NUMERIC,
    commission_rate NUMERIC,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.id,
        c.email as customer_email,
        c.full_name as customer_name,
        pr.title as product_title,
        pc.commission_amount,
        pc.product_price,
        pc.commission_rate,
        pc.status,
        pc.created_at,
        pc.approved_at
    FROM partner_commissions pc
    LEFT JOIN profiles c ON c.id = pc.customer_id
    LEFT JOIN products pr ON pr.id = pc.product_id
    WHERE pc.partner_id = target_partner_id
    ORDER BY pc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 12 : Trigger pour créer une commission quand un produit avec code partenaire est approuvé
CREATE OR REPLACE FUNCTION track_partner_commission()
RETURNS TRIGGER AS $$
DECLARE
    partner_record RECORD;
    commission NUMERIC;
BEGIN
    -- Seulement si le produit passe à "approved" et qu'il y a un partner_code
    IF NEW.status = 'approved' 
       AND OLD.status != 'approved' 
       AND NEW.partner_code IS NOT NULL 
       AND NEW.partner_code != '' THEN
        
        -- Trouver le partenaire
        SELECT id, commission_rate INTO partner_record
        FROM profiles
        WHERE partner_code = NEW.partner_code
        AND is_partner = true;
        
        IF FOUND THEN
            -- Calculer la commission
            commission := NEW.price * (partner_record.commission_rate / 100.0);
            
            -- Créer l'enregistrement de commission
            INSERT INTO partner_commissions (
                partner_id,
                customer_id,
                product_id,
                commission_amount,
                product_price,
                commission_rate,
                partner_code,
                status,
                approved_at
            ) VALUES (
                partner_record.id,
                NEW.seller_id,
                NEW.id,
                commission,
                NEW.price,
                partner_record.commission_rate,
                NEW.partner_code,
                'approved',
                NOW()
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_track_partner_commission ON products;
CREATE TRIGGER trigger_track_partner_commission
    AFTER UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION track_partner_commission();

-- Étape 13 : RLS pour partner_commissions
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view their own commissions" ON partner_commissions;
CREATE POLICY "Partners can view their own commissions" 
    ON partner_commissions FOR SELECT 
    USING (partner_id = auth.uid());

DROP POLICY IF EXISTS "Super admins can view all commissions" ON partner_commissions;
CREATE POLICY "Super admins can view all commissions" 
    ON partner_commissions FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Étape 14 : Permissions
GRANT EXECUTE ON FUNCTION toggle_partner_status TO authenticated;
GRANT EXECUTE ON FUNCTION update_partner_code TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_partners TO authenticated;
GRANT EXECUTE ON FUNCTION get_partner_commission_details TO authenticated;
GRANT ALL ON partner_commissions TO authenticated;

-- FIN DU SCRIPT
SELECT 'Migration terminée avec succès! Système partenaire reconstruit.' as message;
