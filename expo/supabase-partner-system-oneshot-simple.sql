-- ============================================
-- SYSTÈME PARTENAIRE SIMPLIFIÉ - ONE SHOT
-- ============================================

-- ÉTAPE 1: Nettoyer et recréer le système
DROP TRIGGER IF EXISTS trigger_create_partner_commission ON products CASCADE;
DROP FUNCTION IF EXISTS create_partner_commission_on_approval() CASCADE;
DROP FUNCTION IF EXISTS get_partner_commissions(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commission_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_referred_clients(UUID) CASCADE;

-- ÉTAPE 2: Créer la fonction trigger
CREATE OR REPLACE FUNCTION create_partner_commission_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id UUID;
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
  v_existing_commission UUID;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    IF NEW.partner_id IS NOT NULL AND NEW.partner_id != '' THEN
      BEGIN
        v_partner_id := NEW.partner_id::uuid;
      EXCEPTION WHEN OTHERS THEN
        RETURN NEW;
      END;
      
      IF v_partner_id::text = NEW.seller_id THEN
        RETURN NEW;
      END IF;
      
      SELECT id INTO v_existing_commission
      FROM partner_commissions
      WHERE partner_user_id = v_partner_id
        AND product_id = NEW.id;
      
      IF v_existing_commission IS NOT NULL THEN
        RETURN NEW;
      END IF;
      
      SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
      FROM global_settings
      LIMIT 1;
      
      IF v_commission_rate IS NULL THEN
        v_commission_rate := 10;
      END IF;
      
      v_commission_amount := (NEW.price * v_commission_rate) / 100;
      
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
      );
      
      BEGIN
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
          format('Le produit "%s" a été validé. Vous gagnez %s FCFA de commission !', 
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
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- ÉTAPE 3: Créer le trigger
CREATE TRIGGER trigger_create_partner_commission
  AFTER INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION create_partner_commission_on_approval();

-- ÉTAPE 4: Fonction pour récupérer les commissions d'un partenaire
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
  created_at TIMESTAMP WITH TIME ZONE
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
    p.seller_name,
    pc.commission_amount,
    pc.commission_rate,
    pc.status,
    pc.created_at
  FROM partner_commissions pc
  LEFT JOIN products p ON p.id = pc.product_id
  WHERE pc.partner_user_id = get_partner_commissions.partner_user_id
  ORDER BY pc.created_at DESC;
END;
$$;

-- ÉTAPE 5: Fonction pour les statistiques de commissions
CREATE OR REPLACE FUNCTION get_partner_commission_stats(partner_user_id UUID)
RETURNS TABLE (
  total_earned NUMERIC,
  total_pending NUMERIC,
  total_paid NUMERIC,
  commission_count INTEGER
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
    COUNT(*)::INTEGER as commission_count
  FROM partner_commissions
  WHERE partner_commissions.partner_user_id = get_partner_commission_stats.partner_user_id;
END;
$$;

-- ÉTAPE 6: Fonction pour récupérer les clients référés
CREATE OR REPLACE FUNCTION get_partner_referred_clients(partner_user_id UUID)
RETURNS TABLE (
  id TEXT,
  seller_id TEXT,
  seller_name TEXT,
  seller_phone TEXT,
  seller_avatar TEXT,
  total_products INTEGER,
  total_discount_received NUMERIC,
  first_use_date TIMESTAMP WITH TIME ZONE,
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
      p.seller_name,
      p.seller_phone,
      p.seller_avatar,
      COUNT(p.id) as product_count,
      SUM(COALESCE(p.discount_amount, 0)) as total_discount,
      MIN(p.created_at) as first_use,
      jsonb_agg(
        jsonb_build_object(
          'product_id', p.id,
          'product_title', p.title,
          'product_price', p.price,
          'created_at', p.created_at
        ) ORDER BY p.created_at DESC
      ) as products_json
    FROM products p
    WHERE p.partner_id = get_partner_referred_clients.partner_user_id::text
      AND p.discount_code_applied = true
    GROUP BY p.seller_id, p.seller_name, p.seller_phone, p.seller_avatar
  )
  SELECT 
    cp.seller_id as id,
    cp.seller_id,
    cp.seller_name,
    cp.seller_phone,
    cp.seller_avatar,
    cp.product_count::INTEGER as total_products,
    cp.total_discount::NUMERIC as total_discount_received,
    cp.first_use as first_use_date,
    cp.products_json as products
  FROM client_products cp
  ORDER BY cp.first_use DESC;
END;
$$;

-- ÉTAPE 7: Créer les commissions manquantes pour les produits déjà approuvés
DO $$
DECLARE
  v_product RECORD;
  v_partner_id UUID;
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
  v_existing_commission UUID;
  v_created_count INTEGER := 0;
BEGIN
  SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
  FROM global_settings
  LIMIT 1;
  
  IF v_commission_rate IS NULL THEN
    v_commission_rate := 10;
  END IF;
  
  FOR v_product IN 
    SELECT * FROM products 
    WHERE status = 'approved' 
      AND partner_id IS NOT NULL 
      AND partner_id != ''
  LOOP
    BEGIN
      v_partner_id := v_product.partner_id::uuid;
      
      IF v_partner_id::text = v_product.seller_id THEN
        CONTINUE;
      END IF;
      
      SELECT id INTO v_existing_commission
      FROM partner_commissions
      WHERE partner_user_id = v_partner_id
        AND product_id = v_product.id;
      
      IF v_existing_commission IS NOT NULL THEN
        CONTINUE;
      END IF;
      
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
      
      v_created_count := v_created_count + 1;
      
      BEGIN
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
          '🎉 Commission créée !',
          format('Commission créée pour le produit "%s": %s FCFA', 
                 v_product.title, 
                 ROUND(v_commission_amount)::text),
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
        NULL;
      END;
      
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ÉTAPE 8: Activer RLS sur partner_commissions si pas déjà fait
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own commissions" ON partner_commissions;
CREATE POLICY "Users can view their own commissions" ON partner_commissions
  FOR SELECT
  USING (partner_user_id::text = auth.uid()::text);

DROP POLICY IF EXISTS "Admins can view all commissions" ON partner_commissions;
CREATE POLICY "Admins can view all commissions" ON partner_commissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
        AND (is_admin = true OR is_super_admin = true)
    )
  );

DROP POLICY IF EXISTS "Admins can update commissions" ON partner_commissions;
CREATE POLICY "Admins can update commissions" ON partner_commissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
        AND (is_admin = true OR is_super_admin = true)
    )
  );
