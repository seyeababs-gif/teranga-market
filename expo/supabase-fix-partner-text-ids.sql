-- ============================================
-- CORRECTION COMPLÈTE - IDS TEXT
-- ============================================
-- Note: users.id est de type TEXT, pas UUID

DO $$
DECLARE
  v_partner_id TEXT;
  v_partner_phone TEXT;
  v_commission_rate NUMERIC;
  v_product RECORD;
  v_commission RECORD;
  v_products_count INT := 0;
  v_commissions_count INT := 0;
  v_commission_amount NUMERIC;
BEGIN
  RAISE NOTICE '=========================================';
  RAISE NOTICE '1. RECHERCHE DU PARTENAIRE';
  RAISE NOTICE '=========================================';
  
  -- Chercher le partenaire avec les numéros possibles
  SELECT id, phone, name, partner_referral_code INTO v_partner_id, v_partner_phone
  FROM users 
  WHERE (phone LIKE '%651104669%' OR phone LIKE '%771801199%')
  AND is_partner = true 
  LIMIT 1;
  
  IF v_partner_id IS NULL THEN
    RAISE NOTICE '❌ Aucun partenaire trouvé avec ces numéros';
    RAISE NOTICE '';
    RAISE NOTICE 'Liste de TOUS les partenaires:';
    
    FOR v_product IN 
      SELECT id, name, phone, partner_referral_code, is_partner
      FROM users 
      WHERE is_partner = true
    LOOP
      RAISE NOTICE '  ✓ % | % | % | Code: %', 
        v_product.id,
        v_product.name,
        v_product.phone,
        COALESCE(v_product.partner_referral_code, 'Aucun');
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Si aucun partenaire n''est listé, aucun utilisateur n''a is_partner = true';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Partenaire trouvé:';
  RAISE NOTICE '   ID: %', v_partner_id;
  
  SELECT name, phone, partner_referral_code
  INTO v_product
  FROM users WHERE id = v_partner_id;
  
  RAISE NOTICE '   Nom: %', v_product.name;
  RAISE NOTICE '   Téléphone: %', v_product.phone;
  RAISE NOTICE '   Code promo: %', COALESCE(v_product.partner_referral_code, 'Aucun');
  
  -- Récupérer le taux de commission
  SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
  FROM global_settings
  LIMIT 1;
  
  IF v_commission_rate IS NULL THEN
    v_commission_rate := 10;
  END IF;
  
  RAISE NOTICE '   Taux commission: %%%', v_commission_rate;
  
  RAISE NOTICE '';
  RAISE NOTICE '=========================================';
  RAISE NOTICE '2. PRODUITS AVEC CODE PARTENAIRE';
  RAISE NOTICE '=========================================';
  
  -- Compter et lister les produits avec le code partenaire
  FOR v_product IN 
    SELECT p.id, p.title, p.price, p.status, p.seller_name, 
           p.discount_code_applied, p.partner_id, p.created_at
    FROM products p
    WHERE p.partner_id = v_partner_id
    AND p.discount_code_applied = true
    ORDER BY p.created_at DESC
  LOOP
    v_products_count := v_products_count + 1;
    
    RAISE NOTICE '  📦 Produit #%:', v_products_count;
    RAISE NOTICE '     ID: %', v_product.id;
    RAISE NOTICE '     Titre: %', v_product.title;
    RAISE NOTICE '     Prix: % FCFA', v_product.price;
    RAISE NOTICE '     Status: %', v_product.status;
    RAISE NOTICE '     Vendeur: %', v_product.seller_name;
    RAISE NOTICE '     Date: %', v_product.created_at;
    RAISE NOTICE '';
  END LOOP;
  
  IF v_products_count = 0 THEN
    RAISE NOTICE '  ❌ Aucun produit trouvé avec le code partenaire appliqué';
    RAISE NOTICE '';
    RAISE NOTICE '  ℹ️  Vérifiez que:';
    RAISE NOTICE '     - Des vendeurs ont utilisé le code promo';
    RAISE NOTICE '     - Le champ partner_id = ''%''', v_partner_id;
    RAISE NOTICE '     - Le champ discount_code_applied = true';
  ELSE
    RAISE NOTICE '  ✅ Total: % produit(s) trouvé(s)', v_products_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=========================================';
  RAISE NOTICE '3. COMMISSIONS EXISTANTES';
  RAISE NOTICE '=========================================';
  
  -- Lister les commissions existantes
  FOR v_commission IN 
    SELECT pc.id, pc.product_id, pc.commission_amount, pc.commission_rate, 
           pc.status, pc.created_at,
           p.title as product_title, p.price as product_price
    FROM partner_commissions pc
    JOIN products p ON p.id = pc.product_id
    WHERE pc.partner_user_id = v_partner_id
    ORDER BY pc.created_at DESC
  LOOP
    v_commissions_count := v_commissions_count + 1;
    
    RAISE NOTICE '  💰 Commission #%:', v_commissions_count;
    RAISE NOTICE '     ID: %', v_commission.id;
    RAISE NOTICE '     Produit: %', v_commission.product_title;
    RAISE NOTICE '     Prix produit: % FCFA', v_commission.product_price;
    RAISE NOTICE '     Montant: % FCFA', v_commission.commission_amount;
    RAISE NOTICE '     Taux: %%%', v_commission.commission_rate;
    RAISE NOTICE '     Status: %', v_commission.status;
    RAISE NOTICE '     Date: %', v_commission.created_at;
    RAISE NOTICE '';
  END LOOP;
  
  IF v_commissions_count = 0 THEN
    RAISE NOTICE '  ❌ Aucune commission trouvée';
  ELSE
    RAISE NOTICE '  ✅ Total: % commission(s) trouvée(s)', v_commissions_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=========================================';
  RAISE NOTICE '4. CRÉATION DES COMMISSIONS MANQUANTES';
  RAISE NOTICE '=========================================';
  
  v_commissions_count := 0;
  
  -- Créer les commissions pour les produits approuvés sans commission
  FOR v_product IN 
    SELECT p.id, p.title, p.price, p.seller_name
    FROM products p
    WHERE p.partner_id = v_partner_id
    AND p.discount_code_applied = true
    AND p.status = 'approved'
    AND NOT EXISTS (
      SELECT 1 FROM partner_commissions pc 
      WHERE pc.product_id = p.id
    )
  LOOP
    BEGIN
      v_commission_amount := (v_product.price * v_commission_rate) / 100;
      
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
        v_product.id,
        v_commission_amount,
        v_commission_rate,
        'pending',
        NOW()
      );
      
      v_commissions_count := v_commissions_count + 1;
      
      RAISE NOTICE '  ✅ Commission créée #%:', v_commissions_count;
      RAISE NOTICE '     Produit: %', v_product.title;
      RAISE NOTICE '     Montant: % FCFA', v_commission_amount;
      RAISE NOTICE '';
      
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
        v_partner_id,
        'partner_commission',
        '🎉 Nouvelle commission !',
        format('Commission de %s FCFA générée pour le produit "%s"', 
               ROUND(v_commission_amount)::text, 
               v_product.title),
        jsonb_build_object(
          'product_id', v_product.id,
          'product_title', v_product.title,
          'commission_amount', v_commission_amount,
          'seller_name', v_product.seller_name
        ),
        false,
        NOW()
      );
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ Erreur création commission pour %: %', v_product.title, SQLERRM;
    END;
  END LOOP;
  
  IF v_commissions_count = 0 THEN
    RAISE NOTICE '  ℹ️  Aucune nouvelle commission à créer';
    RAISE NOTICE '     (Soit toutes les commissions existent déjà,';
    RAISE NOTICE '      soit aucun produit n''est encore approuvé)';
  ELSE
    RAISE NOTICE '  ✅ % nouvelle(s) commission(s) créée(s)', v_commissions_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=========================================';
  RAISE NOTICE '5. STATISTIQUES FINALES';
  RAISE NOTICE '=========================================';
  
  -- Calculer les stats
  DECLARE
    v_total_clients BIGINT;
    v_total_sales BIGINT;
    v_total_earned NUMERIC;
    v_total_pending NUMERIC;
    v_total_paid NUMERIC;
  BEGIN
    -- Stats des ventes
    SELECT 
      COUNT(DISTINCT p.seller_id),
      COUNT(p.id),
      COALESCE(SUM(pc.commission_amount), 0)
    INTO v_total_clients, v_total_sales, v_total_earned
    FROM products p
    LEFT JOIN partner_commissions pc ON pc.product_id = p.id
    WHERE p.partner_id = v_partner_id
    AND p.discount_code_applied = true;
    
    -- Stats des commissions
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0)
    INTO v_total_pending, v_total_paid
    FROM partner_commissions
    WHERE partner_user_id = v_partner_id;
    
    RAISE NOTICE '  👥 Clients référés: %', v_total_clients;
    RAISE NOTICE '  📦 Total ventes: %', v_total_sales;
    RAISE NOTICE '  💰 Commission totale: % FCFA', v_total_earned;
    RAISE NOTICE '  ⏳ En attente: % FCFA', v_total_pending;
    RAISE NOTICE '  ✅ Payées: % FCFA', v_total_paid;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ❌ Erreur calcul stats: %', SQLERRM;
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE '=========================================';
  RAISE NOTICE '✅ VÉRIFICATION TERMINÉE';
  RAISE NOTICE '=========================================';
  
END $$;
