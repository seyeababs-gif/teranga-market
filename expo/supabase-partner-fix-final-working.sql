-- ============================================
-- CORRECTION FINALE SYSTÈME PARTENAIRE
-- Simple et efficace - One Shot
-- ============================================

-- 1. VÉRIFIER ET CORRIGER LE PARTENAIRE +221771801199
DO $$
DECLARE
    v_partner_id UUID;
    v_partner_name TEXT;
    v_is_partner BOOLEAN;
BEGIN
    -- Chercher le partenaire par téléphone
    SELECT id, name, is_partner 
    INTO v_partner_id, v_partner_name, v_is_partner
    FROM users
    WHERE phone = '+221771801199';
    
    IF v_partner_id IS NULL THEN
        RAISE NOTICE 'Utilisateur +221771801199 introuvable - Création...';
        
        -- Créer l'utilisateur avec mot de passe par défaut
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
            created_at
        )
        VALUES (
            gen_random_uuid(),
            'Partenaire Influenceur',
            '+221771801199',
            'partner771801199@test.com',
            'password123',
            'https://via.placeholder.com/150',
            'seller',
            true,
            'INFLUENCEUR771',
            NOW()
        )
        RETURNING id, name INTO v_partner_id, v_partner_name;
        
        RAISE NOTICE 'Utilisateur créé: % (ID: %)', v_partner_name, v_partner_id;
    ELSE
        RAISE NOTICE 'Partenaire trouvé: % (ID: %)', v_partner_name, v_partner_id;
        
        -- S'assurer qu'il est bien partenaire
        UPDATE users
        SET is_partner = true,
            partner_referral_code = COALESCE(
                partner_referral_code, 
                'INFLUENCEUR771'
            )
        WHERE id = v_partner_id;
        
        RAISE NOTICE 'Statut partenaire activé';
    END IF;
END $$;

-- 2. NETTOYER LES ANCIENNES FONCTIONS
DROP FUNCTION IF EXISTS get_partner_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commissions(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commission_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_referred_clients(UUID) CASCADE;

-- 3. FONCTION: Statistiques du partenaire
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

-- 4. FONCTION: Liste des commissions
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

-- 5. FONCTION: Stats des commissions
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

-- 6. FONCTION: Clients référés
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

-- 7. RECRÉER LE TRIGGER POUR LES COMMISSIONS
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
            
            IF NOT EXISTS (
                SELECT 1 FROM partner_commissions 
                WHERE product_id = NEW.id
            ) THEN
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
                    '🎉 Nouvelle commission !',
                    format('Commission de %s FCFA pour "%s"', 
                           ROUND(v_commission_amount)::text, 
                           NEW.title),
                    jsonb_build_object(
                        'product_id', NEW.id,
                        'commission_amount', v_commission_amount
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

-- 8. CRÉER UN PRODUIT TEST AVEC COMMISSION
DO $$
DECLARE
    v_partner_id UUID;
    v_partner_code TEXT;
    v_test_product_id UUID;
    v_commission_rate NUMERIC;
    v_commission_amount NUMERIC;
BEGIN
    -- Récupérer le partenaire
    SELECT id, partner_referral_code 
    INTO v_partner_id, v_partner_code
    FROM users
    WHERE phone = '+221771801199' AND is_partner = true;
    
    IF v_partner_id IS NULL THEN
        RAISE EXCEPTION 'Partenaire +221771801199 introuvable';
    END IF;
    
    RAISE NOTICE 'Création produit test pour: % (code: %)', v_partner_id, v_partner_code;
    
    -- Taux de commission
    SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
    FROM global_settings
    LIMIT 1;
    
    -- Créer un produit test APPROUVÉ
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
        created_at
    )
    VALUES (
        gen_random_uuid(),
        'TEST - Produit Commission ' || to_char(NOW(), 'DD/MM HH24:MI'),
        'Produit de test pour commission partenaire',
        50000,
        'Électronique',
        'client-test-' || gen_random_uuid()::text,
        'Client Test',
        '+221771234567',
        'https://via.placeholder.com/150',
        'Dakar, Sénégal',
        'https://via.placeholder.com/400',
        'approved',
        v_partner_id::text,
        true,
        2500,
        NOW()
    )
    RETURNING id INTO v_test_product_id;
    
    RAISE NOTICE 'Produit créé: %', v_test_product_id;
    
    -- Attendre le trigger
    PERFORM pg_sleep(0.5);
    
    -- Vérifier et créer la commission si nécessaire
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
        
        RAISE NOTICE 'Commission créée: % FCFA', v_commission_amount;
    END IF;
    
    RAISE NOTICE '✅ Produit test et commission créés';
END $$;

-- 9. VÉRIFICATION FINALE
DO $$
DECLARE
    v_partner_id UUID;
    v_partner_code TEXT;
    v_total_clients BIGINT;
    v_total_sales BIGINT;
    v_total_commission NUMERIC;
    v_count_commissions BIGINT;
    v_count_products BIGINT;
BEGIN
    SELECT id, partner_referral_code 
    INTO v_partner_id, v_partner_code
    FROM users 
    WHERE phone = '+221771801199';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VÉRIFICATION FINALE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Partenaire ID: %', v_partner_id;
    RAISE NOTICE 'Code partenaire: %', v_partner_code;
    
    -- Compter les produits avec ce partenaire
    SELECT COUNT(*) INTO v_count_products
    FROM products
    WHERE partner_id = v_partner_id::text
        AND discount_code_applied = true;
    
    RAISE NOTICE 'Produits avec code: %', v_count_products;
    
    -- Compter les commissions
    SELECT COUNT(*) INTO v_count_commissions
    FROM partner_commissions
    WHERE partner_user_id = v_partner_id;
    
    RAISE NOTICE 'Commissions créées: %', v_count_commissions;
    
    -- Stats via la fonction
    SELECT total_clients, total_sales, total_commission_earned
    INTO v_total_clients, v_total_sales, v_total_commission
    FROM get_partner_stats(v_partner_id);
    
    RAISE NOTICE 'Stats - Clients: %, Ventes: %, Total: % FCFA', 
                 v_total_clients, v_total_sales, v_total_commission;
    RAISE NOTICE '========================================';
    
    IF v_total_commission > 0 THEN
        RAISE NOTICE '✅ SUCCÈS - Le tableau de bord devrait afficher les données';
    ELSE
        RAISE NOTICE '⚠️ Aucune commission trouvée - Vérifier les données';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;
