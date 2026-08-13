-- ============================================
-- CORRECTION COMPLETE SYSTÈME PARTENAIRES
-- One-Shot Fix - Tout en un seul fichier
-- ============================================

-- 1. FONCTION: Récupérer les clients référés par un partenaire
CREATE OR REPLACE FUNCTION get_partner_referred_clients(partner_user_id UUID)
RETURNS TABLE (
  id UUID,
  seller_id UUID,
  seller_name TEXT,
  seller_phone TEXT,
  seller_avatar TEXT,
  seller_email TEXT,
  first_use_date TIMESTAMP WITH TIME ZONE,
  total_products BIGINT,
  total_discount_received NUMERIC,
  products JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH client_products AS (
    SELECT 
      p.seller_id,
      COUNT(p.id) as product_count,
      SUM(COALESCE(p.original_price, 0) - COALESCE(p.price, 0)) as total_discount,
      MIN(p.created_at) as first_use,
      jsonb_agg(
        jsonb_build_object(
          'product_id', p.id,
          'product_title', p.title,
          'product_price', p.price,
          'original_price', p.original_price,
          'discount_applied', p.discount_code_applied,
          'created_at', p.created_at,
          'status', p.status
        ) ORDER BY p.created_at DESC
      ) as products_list
    FROM products p
    INNER JOIN users partner ON partner.id = partner_user_id AND partner.is_partner = true
    WHERE p.seller_id != partner_user_id
      AND (
        (p.discount_code IS NOT NULL AND p.discount_code_applied = true 
         AND EXISTS (
           SELECT 1 FROM discount_codes dc 
           WHERE dc.id = p.discount_code::uuid 
           AND dc.partner_user_id = partner_user_id
         ))
        OR 
        (p.partner_id = partner_user_id)
      )
    GROUP BY p.seller_id
  )
  SELECT 
    gen_random_uuid() as id,
    u.id as seller_id,
    u.name as seller_name,
    u.phone as seller_phone,
    COALESCE(u.avatar, '') as seller_avatar,
    COALESCE(u.email, '') as seller_email,
    cp.first_use as first_use_date,
    cp.product_count as total_products,
    COALESCE(cp.total_discount, 0) as total_discount_received,
    cp.products_list as products
  FROM client_products cp
  INNER JOIN users u ON u.id = cp.seller_id
  ORDER BY cp.first_use DESC;
END;
$$;

-- 2. FONCTION: Récupérer les statistiques d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id UUID)
RETURNS TABLE (
  total_clients BIGINT,
  total_sales BIGINT,
  total_commission_earned NUMERIC,
  total_pending_commission NUMERIC,
  total_paid_commission NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Nombre de clients uniques qui ont utilisé le code du partenaire
    (SELECT COUNT(DISTINCT p.seller_id)
     FROM products p
     WHERE p.seller_id != partner_user_id
       AND (
         (p.discount_code IS NOT NULL AND p.discount_code_applied = true 
          AND EXISTS (
            SELECT 1 FROM discount_codes dc 
            WHERE dc.id = p.discount_code::uuid 
            AND dc.partner_user_id = partner_user_id
          ))
         OR 
         (p.partner_id = partner_user_id)
       )) as total_clients,
    
    -- Nombre total de produits publiés avec le code
    (SELECT COUNT(*)
     FROM products p
     WHERE p.seller_id != partner_user_id
       AND (
         (p.discount_code IS NOT NULL AND p.discount_code_applied = true 
          AND EXISTS (
            SELECT 1 FROM discount_codes dc 
            WHERE dc.id = p.discount_code::uuid 
            AND dc.partner_user_id = partner_user_id
          ))
         OR 
         (p.partner_id = partner_user_id)
       )) as total_sales,
    
    -- Commission totale gagnée
    (SELECT COALESCE(SUM(pc.commission_amount), 0)
     FROM partner_commissions pc
     WHERE pc.partner_user_id = partner_user_id) as total_commission_earned,
    
    -- Commission en attente
    (SELECT COALESCE(SUM(pc.commission_amount), 0)
     FROM partner_commissions pc
     WHERE pc.partner_user_id = partner_user_id
       AND pc.status = 'pending') as total_pending_commission,
    
    -- Commission payée
    (SELECT COALESCE(SUM(pc.commission_amount), 0)
     FROM partner_commissions pc
     WHERE pc.partner_user_id = partner_user_id
       AND pc.status = 'paid') as total_paid_commission;
END;
$$;

-- 3. FONCTION: Récupérer les commissions d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_commissions(partner_user_id UUID)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  product_title TEXT,
  product_price NUMERIC,
  seller_id UUID,
  seller_name TEXT,
  commission_amount NUMERIC,
  commission_rate NUMERIC,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id,
    pc.product_id,
    p.title as product_title,
    p.price as product_price,
    p.seller_id,
    p.seller_name,
    pc.commission_amount,
    pc.commission_rate,
    pc.status,
    pc.created_at,
    pc.paid_at
  FROM partner_commissions pc
  INNER JOIN products p ON p.id = pc.product_id
  WHERE pc.partner_user_id = partner_user_id
  ORDER BY pc.created_at DESC;
END;
$$;

-- 4. FONCTION: Récupérer les statistiques de commissions
CREATE OR REPLACE FUNCTION get_partner_commission_stats(partner_user_id UUID)
RETURNS TABLE (
  total_earned NUMERIC,
  total_pending NUMERIC,
  total_paid NUMERIC,
  commission_count BIGINT
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
    COUNT(*) as commission_count
  FROM partner_commissions
  WHERE partner_user_id = partner_user_id;
END;
$$;

-- 5. TRIGGER: Créer automatiquement une commission quand un produit est approuvé
CREATE OR REPLACE FUNCTION create_partner_commission_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id UUID;
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
  v_product_price NUMERIC;
BEGIN
  -- Vérifier si le produit vient d'être approuvé
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Trouver le partenaire via le code de réduction ou le champ partner_id
    IF NEW.discount_code IS NOT NULL AND NEW.discount_code_applied = true THEN
      SELECT dc.partner_user_id INTO v_partner_id
      FROM discount_codes dc
      WHERE dc.id = NEW.discount_code::uuid;
    ELSIF NEW.partner_id IS NOT NULL THEN
      v_partner_id := NEW.partner_id;
    END IF;
    
    -- Si un partenaire est trouvé et qu'il ne s'agit pas du vendeur lui-même
    IF v_partner_id IS NOT NULL AND v_partner_id != NEW.seller_id THEN
      
      -- Récupérer le taux de commission
      SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
      FROM global_settings
      LIMIT 1;
      
      -- Calculer le montant de la commission
      v_product_price := COALESCE(NEW.price, 0);
      v_commission_amount := (v_product_price * v_commission_rate) / 100;
      
      -- Créer la commission si elle n'existe pas déjà
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
        NEW.id,
        v_commission_amount,
        v_commission_rate,
        'pending',
        NOW()
      )
      ON CONFLICT (partner_user_id, product_id) DO NOTHING;
      
      -- Créer une notification pour le partenaire
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
        'partner_code_used',
        '🎉 Nouveau client référé !',
        format('Un client a publié "%s" avec votre code. Commission: %s FCFA', 
               NEW.title, 
               ROUND(v_commission_amount)::text),
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
  END IF;
  
  RETURN NEW;
END;
$$;

-- Supprimer l'ancien trigger s'il existe et en créer un nouveau
DROP TRIGGER IF EXISTS trigger_create_partner_commission ON products;
CREATE TRIGGER trigger_create_partner_commission
  AFTER INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION create_partner_commission_on_approval();

-- 6. FONCTION: Récupérer les partenaires actifs
CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS TABLE (
  id UUID,
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
    COALESCE(u.email, '') as email,
    COALESCE(u.avatar, '') as avatar,
    COALESCE(u.bio, '') as bio,
    COALESCE(u.partner_referral_code, '') as partner_referral_code,
    COALESCE((
      SELECT SUM(pc.commission_amount)
      FROM partner_commissions pc
      WHERE pc.partner_user_id = u.id
    ), 0) as total_commission_earned,
    COALESCE((
      SELECT COUNT(*)
      FROM products p
      WHERE p.partner_id = u.id
         OR (p.discount_code IS NOT NULL 
             AND p.discount_code_applied = true
             AND EXISTS (
               SELECT 1 FROM discount_codes dc 
               WHERE dc.id = p.discount_code::uuid 
               AND dc.partner_user_id = u.id
             ))
    ), 0) as total_sales,
    u.created_at
  FROM users u
  WHERE u.is_partner = true
  ORDER BY u.created_at DESC;
END;
$$;

-- 7. INDEX pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_products_partner_id ON products(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_discount_code ON products(discount_code) WHERE discount_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_discount_applied ON products(discount_code_applied) WHERE discount_code_applied = true;
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);
CREATE INDEX IF NOT EXISTS idx_discount_codes_partner ON discount_codes(partner_user_id);

-- 8. Permissions RLS (si nécessaire)
-- Autoriser les partenaires à voir leurs propres données
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view their own commissions" ON partner_commissions;
CREATE POLICY "Partners can view their own commissions"
  ON partner_commissions
  FOR SELECT
  USING (
    partner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (is_admin = true OR is_super_admin = true)
    )
  );

-- FIN DU SCRIPT
-- Ce script corrige complètement le système de partenaires
-- Les partenaires peuvent maintenant voir:
-- 1. Les clients qui utilisent leur code
-- 2. Les produits publiés avec leur code
-- 3. Les commissions générées
-- 4. Les statistiques complètes
