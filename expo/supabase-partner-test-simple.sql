-- SOLUTION SIMPLE POUR LE PARTENAIRE 77651104669
-- Cette requête va créer des données de test et vérifier le système

-- Étape 1: Vérifier que le partenaire existe
DO $$
DECLARE
  v_partner_id UUID;
  v_partner_code TEXT;
  v_test_product_id UUID;
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
BEGIN
  -- Récupérer le partenaire
  SELECT id, partner_referral_code INTO v_partner_id, v_partner_code
  FROM users
  WHERE phone = '77651104669' AND is_partner = true;
  
  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Partenaire 77651104669 introuvable. Vérifiez que is_partner = true';
  END IF;
  
  RAISE NOTICE '✅ Partenaire trouvé: % avec code: %', v_partner_id, v_partner_code;
  
  -- Récupérer le taux de commission
  SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
  FROM global_settings
  LIMIT 1;
  
  RAISE NOTICE '✅ Taux de commission: %', v_commission_rate;
  
  -- Créer un produit test approuvé
  INSERT INTO products (
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
    discount_amount
  )
  VALUES (
    'TEST - Produit Commission',
    'Produit de test pour vérifier les commissions du partenaire',
    100000,
    'Électronique',
    'test-seller-' || gen_random_uuid()::text,
    'Client Test',
    '771111111',
    'https://via.placeholder.com/150',
    'Dakar',
    'https://via.placeholder.com/400',
    'approved',
    v_partner_id::text,
    true,
    5000
  )
  RETURNING id INTO v_test_product_id;
  
  RAISE NOTICE '✅ Produit test créé: %', v_test_product_id;
  
  -- Calculer et créer la commission
  v_commission_amount := (100000 * v_commission_rate) / 100;
  
  INSERT INTO partner_commissions (
    partner_user_id,
    product_id,
    commission_amount,
    commission_rate,
    status
  )
  VALUES (
    v_partner_id,
    v_test_product_id,
    v_commission_amount,
    v_commission_rate,
    'pending'
  );
  
  RAISE NOTICE '✅ Commission créée: % FCFA', v_commission_amount;
  
  -- Créer une notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    is_read
  )
  VALUES (
    v_partner_id::text,
    'partner_commission',
    '💰 Nouvelle commission',
    format('Vous avez gagné %s FCFA de commission sur un produit', ROUND(v_commission_amount)::text),
    jsonb_build_object(
      'product_id', v_test_product_id,
      'product_title', 'TEST - Produit Commission',
      'commission_amount', v_commission_amount,
      'seller_name', 'Client Test'
    ),
    false
  );
  
  RAISE NOTICE '✅ Notification créée';
  
  -- Afficher un résumé
  RAISE NOTICE '';
  RAISE NOTICE '=== RÉSUMÉ ===';
  RAISE NOTICE 'Partenaire: %', v_partner_id;
  RAISE NOTICE 'Code partenaire: %', v_partner_code;
  RAISE NOTICE 'Produit test: %', v_test_product_id;
  RAISE NOTICE 'Commission: % FCFA', v_commission_amount;
  
END $$;

-- Vérifier les résultats
SELECT 
  'VÉRIFICATION FINALE' as section,
  (SELECT COUNT(*) FROM products WHERE partner_id = (SELECT id::text FROM users WHERE phone = '77651104669')) as total_produits,
  (SELECT COUNT(*) FROM products WHERE partner_id = (SELECT id::text FROM users WHERE phone = '77651104669') AND status = 'approved') as produits_approuves,
  (SELECT COUNT(*) FROM partner_commissions WHERE partner_user_id = (SELECT id FROM users WHERE phone = '77651104669')) as total_commissions,
  (SELECT COALESCE(SUM(commission_amount), 0) FROM partner_commissions WHERE partner_user_id = (SELECT id FROM users WHERE phone = '77651104669')) as total_gains;
