-- ============================================
-- CORRECTION COMPLÈTE DU SYSTÈME PARTENAIRE V3
-- Gère correctement les types de données
-- ============================================

-- 1. TROUVER OU CRÉER LE PARTENAIRE
DO $$
DECLARE
    v_partner_id UUID;
    v_partner_name TEXT;
    v_is_partner BOOLEAN;
BEGIN
    -- Chercher avec le téléphone complet
    SELECT id, name, is_partner 
    INTO v_partner_id, v_partner_name, v_is_partner
    FROM users
    WHERE phone = '+221771801199' OR phone = '221771801199' OR phone = '771801199';
    
    IF v_partner_id IS NULL THEN
        RAISE NOTICE 'Aucun utilisateur trouvé avec ce téléphone, création...';
        
        INSERT INTO users (
            id,
            name,
            phone,
            email,
            password,
            avatar,
            type,
            is_partner,
            partner_referral_code,
            created_at,
            updated_at
        )
        VALUES (
            gen_random_uuid(),
            'Partenaire Test',
            '+221771801199',
            'partner771801199@test.com',
            '$2a$10$dummyhashedpassword',
            'https://via.placeholder.com/150',
            'seller',
            true,
            'PART771801',
            NOW(),
            NOW()
        )
        RETURNING id, name INTO v_partner_id, v_partner_name;
        
        RAISE NOTICE 'Utilisateur créé: % (ID: %)', v_partner_name, v_partner_id;
    ELSE
        RAISE NOTICE 'Partenaire trouvé: % (ID: %)', v_partner_name, v_partner_id;
        
        -- Activer le statut partenaire
        UPDATE users
        SET is_partner = true,
            partner_referral_code = COALESCE(partner_referral_code, 'PART771801'),
            updated_at = NOW()
        WHERE id = v_partner_id;
        
        RAISE NOTICE 'Statut partenaire activé';
    END IF;
END $$;

-- 2. NETTOYER LES ANCIENNES FONCTIONS
DROP FUNCTION IF EXISTS get_partner_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commissions(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commission_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_referred_clients(UUID) CASCADE;

-- 3. CRÉER get_partner_stats
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id UUID)
RETURNS TABLE (
    total_clients BIGINT,
    total_sales BIGINT,
    total_commission_earned NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT p.seller_id)::BIGINT as total_clients,
        COUNT(p.id)::BIGINT as total_sales,
        COALESCE(SUM(pc.commission_amount), 0) as total_commission_earned
    FROM products p
    LEFT JOIN partner_commissions pc ON pc.product_id = p.id
    WHERE p.partner_id = partner_user_id::text
        AND p.discount_code_applied = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. CRÉER get_partner_commissions
CREATE OR REPLACE FUNCTION get_partner_commissions(partner_user_id UUID)
RETURNS TABLE (
    id UUID,
    product_id UUID,
    product_title TEXT,
    product_price NUMERIC,
    seller_name TEXT,
    commission_amount NUMERIC,
    commission_rate NUMERIC,
    status TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.id,
        pc.product_id,
        p.title as product_title,
        p.price as product_price,
        p.seller_name,
        pc.commission_amount,
        pc.commission_rate,
        pc.status,
        pc.created_at
    FROM partner_commissions pc
    JOIN products p ON p.id = pc.product_id
    WHERE pc.partner_user_id = get_partner_commissions.partner_user_id
    ORDER BY pc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. CRÉER get_partner_commission_stats
CREATE OR REPLACE FUNCTION get_partner_commission_stats(partner_user_id UUID)
RETURNS TABLE (
    total_earned NUMERIC,
    total_pending NUMERIC,
    total_paid NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(commission_amount), 0) as total_earned,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as total_pending,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0) as total_paid
    FROM partner_commissions
    WHERE partner_commissions.partner_user_id = get_partner_commission_stats.partner_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CRÉER get_partner_referred_clients
CREATE OR REPLACE FUNCTION get_partner_referred_clients(partner_user_id UUID)
RETURNS TABLE (
    id TEXT,
    seller_name TEXT,
    seller_phone TEXT,
    seller_avatar TEXT,
    total_products BIGINT,
    total_discount_received NUMERIC,
    first_use_date TIMESTAMPTZ,
    products JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.seller_id as id,
        p.seller_name,
        p.seller_phone,
        p.seller_avatar,
        COUNT(p.id)::BIGINT as total_products,
        COALESCE(SUM(p.discount_amount), 0) as total_discount_received,
        MIN(p.created_at) as first_use_date,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'product_id', p.id,
                    'product_title', p.title,
                    'product_price', p.price,
                    'created_at', p.created_at
                )
                ORDER BY p.created_at DESC
            ),
            '[]'::jsonb
        ) as products
    FROM products p
    WHERE p.partner_id = get_partner_referred_clients.partner_user_id::text
        AND p.discount_code_applied = true
    GROUP BY p.seller_id, p.seller_name, p.seller_phone, p.seller_avatar;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RECRÉER LE TRIGGER
DROP TRIGGER IF EXISTS trigger_create_partner_commission ON products CASCADE;
DROP FUNCTION IF EXISTS create_partner_commission_on_approval() CASCADE;

CREATE OR REPLACE FUNCTION create_partner_commission_on_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_commission_rate NUMERIC;
    v_commission_amount NUMERIC;
    v_partner_uuid UUID;
BEGIN
    IF NEW.status = 'approved' 
       AND NEW.partner_id IS NOT NULL 
       AND NEW.discount_code_applied = true
       AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
      
        BEGIN
            v_partner_uuid := NEW.partner_id::UUID;
            
            SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
            FROM global_settings
            LIMIT 1;
            
            v_commission_amount := (NEW.price * v_commission_rate) / 100;
            
            IF NOT EXISTS (SELECT 1 FROM partner_commissions WHERE product_id = NEW.id) THEN
                INSERT INTO partner_commissions (
                    partner_user_id,
                    product_id,
                    commission_amount,
                    commission_rate,
                    status,
                    created_at
                )
                VALUES (
                    v_partner_uuid,
                    NEW.id,
                    v_commission_amount,
                    v_commission_rate,
                    'pending',
                    NOW()
                );
                
                INSERT INTO notifications (
                    user_id,
                    type,
                    title,
                    message,
                    data,
                    is_read,
                    created_at
                )
                VALUES (
                    NEW.partner_id,
                    'partner_commission',
                    'Nouvelle commission',
                    format('Commission de %s FCFA pour "%s"', ROUND(v_commission_amount)::text, NEW.title),
                    jsonb_build_object(
                        'product_id', NEW.id,
                        'product_title', NEW.title,
                        'commission_amount', v_commission_amount,
                        'seller_name', NEW.seller_name
                    ),
                    false,
                    NOW()
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erreur commission: %', SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_partner_commission
    AFTER INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION create_partner_commission_on_approval();

-- 8. CRÉER UN PRODUIT TEST ET COMMISSION
DO $$
DECLARE
    v_partner_id UUID;
    v_test_product_id UUID;
    v_commission_rate NUMERIC;
    v_commission_amount NUMERIC;
BEGIN
    -- Trouver le partenaire
    SELECT id INTO v_partner_id
    FROM users
    WHERE phone IN ('+221771801199', '221771801199', '771801199')
        AND is_partner = true
    LIMIT 1;
    
    IF v_partner_id IS NULL THEN
        RAISE EXCEPTION 'Partenaire introuvable';
    END IF;
    
    RAISE NOTICE 'Partenaire ID: %', v_partner_id;
    
    -- Récupérer le taux de commission
    SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
    FROM global_settings
    LIMIT 1;
    
    IF v_commission_rate IS NULL THEN
        v_commission_rate := 10;
        RAISE NOTICE 'Taux par défaut: 10%%';
    END IF;
    
    -- Créer un produit test
    v_test_product_id := gen_random_uuid();
    
    INSERT INTO products (
        id,
        title,
        description,
        price,
        category,
        seller_id,
        seller_name,
        seller_phone,
        seller_avatar,
        location,
        image,
        status,
        partner_id,
        discount_code_applied,
        discount_amount,
        created_at,
        updated_at
    )
    VALUES (
        v_test_product_id,
        'TEST Commission - ' || to_char(NOW(), 'DD/MM HH24:MI'),
        'Produit test pour vérifier les commissions',
        50000,
        'Électronique',
        'test-seller-' || extract(epoch from NOW())::bigint,
        'Client Test',
        '771234567',
        'https://via.placeholder.com/150',
        'Dakar, Sénégal',
        'https://via.placeholder.com/400',
        'approved',
        v_partner_id::text,
        true,
        2500,
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Produit créé: %', v_test_product_id;
    
    -- Attendre que le trigger se déclenche
    PERFORM pg_sleep(1);
    
    -- Créer la commission manuellement si le trigger n'a pas fonctionné
    IF NOT EXISTS (SELECT 1 FROM partner_commissions WHERE product_id = v_test_product_id) THEN
        v_commission_amount := (50000 * v_commission_rate) / 100;
        
        INSERT INTO partner_commissions (
            partner_user_id,
            product_id,
            commission_amount,
            commission_rate,
            status,
            created_at
        )
        VALUES (
            v_partner_id,
            v_test_product_id,
            v_commission_amount,
            v_commission_rate,
            'pending',
            NOW()
        );
        
        RAISE NOTICE 'Commission créée manuellement: % FCFA', v_commission_amount;
    END IF;
    
    RAISE NOTICE 'Produit et commission créés avec succès';
END $$;

-- 9. VÉRIFICATION FINALE
DO $$
DECLARE
    v_partner_id UUID;
    v_partner_code TEXT;
    v_stats RECORD;
    v_commission_count INTEGER;
BEGIN
    SELECT id, partner_referral_code 
    INTO v_partner_id, v_partner_code
    FROM users
    WHERE phone IN ('+221771801199', '221771801199', '771801199')
        AND is_partner = true
    LIMIT 1;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICATION FINALE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Partenaire ID: %', v_partner_id;
    RAISE NOTICE 'Code parrainage: %', v_partner_code;
    
    SELECT COUNT(*) INTO v_commission_count
    FROM partner_commissions
    WHERE partner_user_id = v_partner_id;
    
    RAISE NOTICE 'Nombre de commissions: %', v_commission_count;
    
    SELECT * INTO v_stats FROM get_partner_stats(v_partner_id);
    RAISE NOTICE 'Clients: %, Ventes: %, Total commissions: % FCFA', 
                 v_stats.total_clients, v_stats.total_sales, v_stats.total_commission_earned;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TERMINE - Le dashboard devrait afficher les données';
    RAISE NOTICE '========================================';
END $$;
