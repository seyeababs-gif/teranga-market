-- ============================================
-- SYSTÈME PARTENAIRES - VERSION SIMPLE QUI MARCHE
-- ============================================

-- Nettoyer les anciennes fonctions
DROP FUNCTION IF EXISTS get_partner_referred_clients(UUID);
DROP FUNCTION IF EXISTS get_partner_stats(UUID);
DROP FUNCTION IF EXISTS get_partner_commissions(UUID);
DROP FUNCTION IF EXISTS get_partner_commission_stats(UUID);
DROP FUNCTION IF EXISTS get_active_user_partners();
DROP FUNCTION IF EXISTS create_partner_commission_on_approval();
DROP TRIGGER IF EXISTS trigger_create_partner_commission ON products;

-- ======================================
-- 1. Fonction simple pour récupérer les clients qui utilisent le code
-- ======================================
CREATE OR REPLACE FUNCTION get_partner_referred_clients(partner_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Récupérer directement tous les produits utilisant le code partenaire
  SELECT COALESCE(jsonb_agg(client_data), '[]'::jsonb)
  INTO result
  FROM (
    SELECT DISTINCT ON (p.seller_id)
      p.seller_id as id,
      p.seller_id,
      p.seller_name,
      p.seller_phone,
      COALESCE(p.seller_avatar, '') as seller_avatar,
      '' as seller_email,
      MIN(p.created_at) OVER (PARTITION BY p.seller_id) as first_use_date,
      COUNT(*) OVER (PARTITION BY p.seller_id) as total_products,
      SUM(COALESCE(p.original_price, p.price) - p.price) OVER (PARTITION BY p.seller_id) as total_discount_received,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_id', prod.id,
            'product_title', prod.title,
            'product_price', prod.price,
            'created_at', prod.created_at
          )
        )
        FROM products prod
        WHERE prod.seller_id = p.seller_id
          AND prod.partner_id = partner_user_id::text
        ORDER BY prod.created_at DESC
        LIMIT 5
      ) as products
    FROM products p
    WHERE p.partner_id = partner_user_id::text
      AND p.seller_id != partner_user_id::text
    ORDER BY p.seller_id, p.created_at DESC
  ) client_data;
  
  RETURN result;
END;
$$;

-- ======================================
-- 2. Fonction simple pour les stats
-- ======================================
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_clients', (
      SELECT COUNT(DISTINCT seller_id)
      FROM products
      WHERE partner_id = partner_user_id::text
        AND seller_id != partner_user_id::text
    ),
    'total_sales', (
      SELECT COUNT(*)
      FROM products
      WHERE partner_id = partner_user_id::text
        AND seller_id != partner_user_id::text
    ),
    'total_commission_earned', COALESCE((
      SELECT SUM(commission_amount)
      FROM partner_commissions
      WHERE partner_user_id = get_partner_stats.partner_user_id
    ), 0),
    'total_pending_commission', COALESCE((
      SELECT SUM(commission_amount)
      FROM partner_commissions
      WHERE partner_user_id = get_partner_stats.partner_user_id
        AND status = 'pending'
    ), 0),
    'total_paid_commission', COALESCE((
      SELECT SUM(commission_amount)
      FROM partner_commissions
      WHERE partner_user_id = get_partner_stats.partner_user_id
        AND status = 'paid'
    ), 0)
  )
  INTO result;
  
  RETURN result;
END;
$$;

-- ======================================
-- 3. Fonction simple pour les commissions
-- ======================================
CREATE OR REPLACE FUNCTION get_partner_commissions(partner_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(commission_data), '[]'::jsonb)
  INTO result
  FROM (
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
    WHERE pc.partner_user_id = get_partner_commissions.partner_user_id
    ORDER BY pc.created_at DESC
    LIMIT 100
  ) commission_data;
  
  RETURN result;
END;
$$;

-- ======================================
-- 4. Fonction simple pour les stats de commissions
-- ======================================
CREATE OR REPLACE FUNCTION get_partner_commission_stats(partner_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_earned', COALESCE(SUM(commission_amount), 0),
    'total_pending', COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0),
    'total_paid', COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0),
    'commission_count', COUNT(*)
  )
  INTO result
  FROM partner_commissions
  WHERE partner_user_id = get_partner_commission_stats.partner_user_id;
  
  RETURN result;
END;
$$;

-- ======================================
-- 5. Fonction pour récupérer les partenaires actifs
-- ======================================
CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(partner_data), '[]'::jsonb)
  INTO result
  FROM (
    SELECT 
      u.id::uuid,
      u.name,
      u.phone,
      COALESCE(u.email, '') as email,
      COALESCE(u.avatar, '') as avatar,
      COALESCE(u.bio, '') as bio,
      COALESCE(u.partner_referral_code, '') as partner_referral_code,
      COALESCE((
        SELECT SUM(pc.commission_amount)
        FROM partner_commissions pc
        WHERE pc.partner_user_id = u.id::uuid
      ), 0) as total_commission_earned,
      COALESCE((
        SELECT COUNT(*)
        FROM products p
        WHERE p.partner_id = u.id::text
      ), 0) as total_sales,
      u.created_at
    FROM users u
    WHERE u.is_partner = true
    ORDER BY u.created_at DESC
  ) partner_data;
  
  RETURN result;
END;
$$;

-- ======================================
-- 6. TRIGGER POUR CRÉER LES COMMISSIONS AUTOMATIQUEMENT
-- ======================================
CREATE OR REPLACE FUNCTION create_partner_commission_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id UUID;
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
BEGIN
  -- Vérifier que le produit vient d'être approuvé
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Récupérer l'ID du partenaire depuis partner_id
    IF NEW.partner_id IS NOT NULL AND NEW.partner_id != '' THEN
      BEGIN
        v_partner_id := NEW.partner_id::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_partner_id := NULL;
      END;
      
      -- Vérifier que ce n'est pas le vendeur lui-même
      IF v_partner_id IS NOT NULL AND v_partner_id::text != NEW.seller_id THEN
        
        -- Récupérer le taux de commission
        SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
        FROM global_settings
        LIMIT 1;
        
        -- Calculer la commission
        v_commission_amount := (NEW.price * v_commission_rate) / 100;
        
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
          NEW.id,
          v_commission_amount,
          v_commission_rate,
          'pending',
          NOW()
        )
        ON CONFLICT (partner_user_id, product_id) DO NOTHING;
        
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
          'partner_code_used',
          '🎉 Nouveau produit référé !',
          format('"%s" a été publié avec votre code. Commission: %s FCFA', 
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
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger
CREATE TRIGGER trigger_create_partner_commission
  AFTER INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION create_partner_commission_on_approval();

-- ======================================
-- 7. INDEX POUR LA PERFORMANCE
-- ======================================
CREATE INDEX IF NOT EXISTS idx_products_partner_id ON products(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);

-- ======================================
-- 8. RLS POLICIES
-- ======================================
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view their own commissions" ON partner_commissions;
CREATE POLICY "Partners can view their own commissions"
  ON partner_commissions
  FOR SELECT
  USING (
    partner_user_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
      AND (is_admin = true OR is_super_admin = true)
    )
  );

-- ============================================
-- FIN - Le partenaire voit maintenant:
-- 1. Les clients qui utilisent son code
-- 2. Les produits publiés par ces clients
-- 3. Ses commissions en temps réel
-- ============================================
