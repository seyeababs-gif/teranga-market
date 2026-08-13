-- ============================================
-- DEBUG ET SIMULATION POUR PARTENAIRE 77651104669
-- ============================================

-- 1. VÉRIFIER SI LE PARTENAIRE EXISTE
SELECT 
  id,
  name,
  phone,
  is_partner,
  partner_referral_code
FROM users
WHERE phone = '77651104669';

-- 2. VÉRIFIER LES PRODUITS AVEC CE CODE PARTENAIRE
SELECT 
  p.id,
  p.title,
  p.price,
  p.status,
  p.seller_name,
  p.seller_id,
  p.partner_id,
  p.discount_code_applied,
  p.created_at
FROM products p
WHERE p.partner_id = (SELECT id FROM users WHERE phone = '77651104669')::text
ORDER BY p.created_at DESC;

-- 3. VÉRIFIER LES COMMISSIONS EXISTANTES
SELECT 
  pc.id,
  pc.product_id,
  pc.commission_amount,
  pc.commission_rate,
  pc.status,
  pc.created_at,
  p.title as product_title,
  p.status as product_status
FROM partner_commissions pc
LEFT JOIN products p ON p.id = pc.product_id
WHERE pc.partner_user_id = (SELECT id FROM users WHERE phone = '77651104669')
ORDER BY pc.created_at DESC;

-- 4. CRÉER UN PRODUIT TEST POUR SIMULATION
DO $$
DECLARE
  v_partner_id UUID;
  v_test_product_id UUID;
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
BEGIN
  -- Récupérer l'ID du partenaire
  SELECT id INTO v_partner_id
  FROM users
  WHERE phone = '77651104669';
  
  IF v_partner_id IS NULL THEN
    RAISE NOTICE 'Partenaire 77651104669 introuvable !';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Partenaire trouvé: %', v_partner_id;
  
  -- Récupérer le taux de commission
  SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
  FROM global_settings
  LIMIT 1;
  
  RAISE NOTICE 'Taux de commission: % %%', v_commission_rate;
  
  -- Créer un produit test
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
    'Produit Test - Commission Partenaire',
    'Produit de test pour vérifier le système de commissions',
    50000,
    'Électronique',
    'seller-test-' || gen_random_uuid()::text,
    'Vendeur Test',
    '771234567',
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
  
  RAISE NOTICE 'Produit test créé: %', v_test_product_id;
  
  -- Calculer la commission
  v_commission_amount := (50000 * v_commission_rate) / 100;
  
  -- Créer la commission
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
    '🎉 Commission Test créée !',
    format('Commission test: %s FCFA pour le produit de test', ROUND(v_commission_amount)::text),
    jsonb_build_object(
      'product_id', v_test_product_id,
      'product_title', 'Produit Test - Commission Partenaire',
      'commission_amount', v_commission_amount,
      'seller_name', 'Vendeur Test'
    ),
    false,
    NOW()
  );
  
  RAISE NOTICE 'Notification créée';
  
END $$;

-- 5. TESTER LES FONCTIONS RPC
SELECT 'TEST get_partner_stats:' as test;
SELECT * FROM get_partner_stats((SELECT id FROM users WHERE phone = '77651104669'));

SELECT 'TEST get_partner_commissions:' as test;
SELECT * FROM get_partner_commissions((SELECT id FROM users WHERE phone = '77651104669'));

SELECT 'TEST get_partner_commission_stats:' as test;
SELECT * FROM get_partner_commission_stats((SELECT id FROM users WHERE phone = '77651104669'));

SELECT 'TEST get_partner_referred_clients:' as test;
SELECT * FROM get_partner_referred_clients((SELECT id FROM users WHERE phone = '77651104669'));

-- 6. RÉSUMÉ FINAL
SELECT 
  'RÉSUMÉ FINAL' as section,
  (SELECT COUNT(*) FROM products WHERE partner_id = (SELECT id FROM users WHERE phone = '77651104669')::text) as total_produits,
  (SELECT COUNT(*) FROM products WHERE partner_id = (SELECT id FROM users WHERE phone = '77651104669')::text AND status = 'approved') as produits_approuves,
  (SELECT COUNT(*) FROM partner_commissions WHERE partner_user_id = (SELECT id FROM users WHERE phone = '77651104669')) as total_commissions,
  (SELECT SUM(commission_amount) FROM partner_commissions WHERE partner_user_id = (SELECT id FROM users WHERE phone = '77651104669')) as total_gains;
