-- ============================================
-- VÉRIFICATION DU PARTENAIRE +221651104669
-- ============================================

-- 1. Vérifier que le partenaire existe et a un code
SELECT 
  id,
  name,
  phone,
  is_partner,
  partner_referral_code,
  created_at
FROM users
WHERE phone LIKE '%651104669%';

-- 2. Vérifier les produits qui utilisent le code de ce partenaire
SELECT 
  p.id,
  p.title,
  p.price,
  p.status,
  p.discount_code_applied,
  p.partner_id,
  p.partner_code_used,
  p.seller_name,
  p.seller_phone,
  p.created_at,
  p.approved_at
FROM products p
WHERE p.partner_id IN (
  SELECT id::text FROM users WHERE phone LIKE '%651104669%' AND is_partner = true
)
ORDER BY p.created_at DESC;

-- 3. Vérifier les commissions générées pour ce partenaire
SELECT 
  pc.id,
  pc.product_id,
  pc.commission_amount,
  pc.commission_rate,
  pc.status,
  pc.created_at,
  p.title as product_title,
  p.status as product_status,
  p.seller_name
FROM partner_commissions pc
JOIN products p ON p.id = pc.product_id
WHERE pc.partner_user_id IN (
  SELECT id FROM users WHERE phone LIKE '%651104669%' AND is_partner = true
)
ORDER BY pc.created_at DESC;

-- 4. Statistiques du partenaire
SELECT 
  COUNT(DISTINCT p.seller_id) as total_clients,
  COUNT(p.id) as total_products,
  COUNT(CASE WHEN p.status = 'approved' THEN 1 END) as approved_products,
  COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending_products,
  COALESCE(SUM(pc.commission_amount), 0) as total_commission
FROM products p
LEFT JOIN partner_commissions pc ON pc.product_id = p.id
WHERE p.partner_id IN (
  SELECT id::text FROM users WHERE phone LIKE '%651104669%' AND is_partner = true
);

-- 5. Vérifier les codes de réduction créés pour ce partenaire
SELECT 
  dc.id,
  dc.code,
  dc.discount_percent,
  dc.is_active,
  dc.times_used,
  dc.created_at
FROM discount_codes dc
WHERE dc.partner_user_id IN (
  SELECT id FROM users WHERE phone LIKE '%651104669%' AND is_partner = true
)
ORDER BY dc.created_at DESC;
