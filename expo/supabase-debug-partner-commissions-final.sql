-- ============================================
-- DEBUG ET CORRECTION SYSTÈME PARTENAIRE
-- ============================================

DO $$
DECLARE
  v_partner_id UUID;
  v_partner_phone TEXT := '221651104669';
  v_commission_rate NUMERIC;
  v_products_count INT;
  v_commissions_count INT;
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'ÉTAPE 1: RECHERCHE DU PARTENAIRE';
  RAISE NOTICE '=================================================';
  
  -- Chercher le partenaire
  SELECT id INTO v_partner_id 
  FROM users 
  WHERE phone LIKE '%651104669%' 
  AND is_partner = true 
  LIMIT 1;
  
  IF v_partner_id IS NULL THEN
    RAISE NOTICE '❌ Partenaire introuvable avec phone contenant 651104669';
    
    -- Lister tous les partenaires
    RAISE NOTICE '';
    RAISE NOTICE 'Liste des partenaires existants:';
    FOR v_partner_id IN 
      SELECT id FROM users WHERE is_partner = true
    LOOP
      RAISE NOTICE '  - ID: % | Phone: % | Name: %', 
        v_partner_id,
        (SELECT phone FROM users WHERE id = v_partner_id),
        (SELECT name FROM users WHERE id = v_partner_id);
    END LOOP;
    
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Partenaire trouvé:';
  RAISE NOTICE '  - ID: %', v_partner_id;
  RAISE NOTICE '  - Name: %', (SELECT name FROM users WHERE id = v_partner_id);
  RAISE NOTICE '  - Phone: %', (SELECT phone FROM users WHERE id = v_partner_id);
  RAISE NOTICE '  - Code: %', (SELECT partner_referral_code FROM users WHERE id = v_partner_id);
  
  -- Récupérer le taux de commission
  SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
  FROM global_settings
  LIMIT 1;
  
  RAISE NOTICE '  - Taux commission: %', v_commission_rate || '%';
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'ÉTAPE 2: ANALYSE DES PRODUITS';
  RAISE NOTICE '=================================================';
  
  -- Compter les produits liés au partenaire
  SELECT COUNT(*) INTO v_products_count
  FROM products
  WHERE partner_id = v_partner_id::text
  AND discount_code_applied = true;
  
  RAISE NOTICE '📦 Produits avec code partenaire appliqué: %', v_products_count;
  
  -- Détailler les produits
  FOR v_products_count IN 
    SELECT p.id, p.title, p.price, p.status, p.seller_name, p.created_at
    FROM products p
    WHERE p.partner_id = v_partner_id::text
    AND p.discount_code_applied = true
    ORDER BY p.created_at DESC
  LOOP
    RAISE NOTICE '  - % | % | Prix: % FCFA | Status: % | Vendeur: %',
      v_products_count.id,
      v_products_count.title,
      v_products_count.price,
      v_products_count.status,
      v_products_count.seller_name;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'ÉTAPE 3: ANALYSE DES COMMISSIONS';
  RAISE NOTICE '=================================================';
  
  -- Compter les commissions existantes
  SELECT COUNT(*) INTO v_commissions_count
  FROM partner_commissions
  WHERE partner_user_id = v_partner_id;
  
  RAISE NOTICE '💰 Commissions existantes: %', v_commissions_count;
  
  -- Détailler les commissions
  IF v_commissions_count > 0 THEN
    FOR v_commissions_count IN 
      SELECT pc.id, pc.product_id, pc.commission_amount, pc.status, pc.created_at,
             p.title as product_title, p.price as product_price
      FROM partner_commissions pc
      JOIN products p ON p.id = pc.product_id
      WHERE pc.partner_user_id = v_partner_id
      ORDER BY pc.created_at DESC
    LOOP
      RAISE NOTICE '  - % | Produit: % | Montant: % FCFA | Status: %',
        v_commissions_count.id,
        v_commissions_count.product_title,
        v_commissions_count.commission_amount,
        v_commissions_count.status;
    END LOOP;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'ÉTAPE 4: CRÉATION DES COMMISSIONS MANQUANTES';
  RAISE NOTICE '=================================================';
  
  -- Créer les commissions pour les produits approuvés sans commission
  FOR v_products_count IN 
    SELECT p.id, p.title, p.price, p.seller_name
    FROM products p
    WHERE p.partner_id = v_partner_id::text
    AND p.discount_code_applied = true
    AND p.status = 'approved'
    AND NOT EXISTS (
      SELECT 1 FROM partner_commissions pc 
      WHERE pc.product_id = p.id
    )
  LOOP
    DECLARE
      v_commission_amount NUMERIC;
      v_new_commission_id UUID;
    BEGIN
      v_commission_amount := (v_products_count.price * v_commission_rate) / 100;
      
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
        v_products_count.id,
        v_commission_amount,
        v_commission_rate,
        'pending',
        NOW()
      )
      RETURNING id INTO v_new_commission_id;
      
      RAISE NOTICE '✅ Commission créée: ID % | Produit: % | Montant: % FCFA',
        v_new_commission_id,
        v_products_count.title,
        v_commission_amount;
        
      -- Créer une notification
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
        v_partner_id::text,
        'partner_commission',
        '🎉 Nouvelle commission !',
        format('Commission de %s FCFA générée pour le produit "%s"', 
               ROUND(v_commission_amount)::text, 
               v_products_count.title),
        jsonb_build_object(
          'product_id', v_products_count.id,
          'product_title', v_products_count.title,
          'commission_amount', v_commission_amount,
          'seller_name', v_products_count.seller_name
        ),
        false,
        NOW()
      );
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '❌ Erreur création commission pour %: %', v_products_count.title, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'ÉTAPE 5: VÉRIFICATION FINALE';
  RAISE NOTICE '=================================================';
  
  -- Vérifier les stats
  DECLARE
    v_stats RECORD;
  BEGIN
    SELECT * INTO v_stats FROM get_partner_stats(v_partner_id);
    
    RAISE NOTICE '📊 Statistiques partenaire:';
    RAISE NOTICE '  - Total clients: %', v_stats.total_clients;
    RAISE NOTICE '  - Total ventes: %', v_stats.total_sales;
    RAISE NOTICE '  - Commission totale: % FCFA', v_stats.total_commission_earned;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Erreur récupération stats: %', SQLERRM;
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '✅ DEBUG ET CORRECTION TERMINÉS';
  RAISE NOTICE '=================================================';
  
END $$;
