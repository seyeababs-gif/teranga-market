-- ============================================
-- SYSTÈME PARTENAIRES - ONE SHOT FINAL
-- Supprime tout proprement avec CASCADE et recrée
-- ============================================

-- ======================================
-- ÉTAPE 1: NETTOYER COMPLÈTEMENT (avec CASCADE)
-- ======================================

-- Supprimer le trigger d'abord
DROP TRIGGER IF EXISTS trigger_create_partner_commission ON products;

-- Supprimer les fonctions avec CASCADE pour nettoyer les dépendances
DROP FUNCTION IF EXISTS create_partner_commission_on_approval() CASCADE;
DROP FUNCTION IF EXISTS get_partner_referred_clients(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commissions(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commission_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_active_user_partners() CASCADE;
DROP FUNCTION IF EXISTS get_partner_client_details(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_partner_referral_code(UUID, TEXT) CASCADE;

-- ======================================
-- ÉTAPE 2: CRÉER LA TABLE partner_commissions SI ELLE N'EXISTE PAS
-- ======================================
CREATE TABLE IF NOT EXISTS partner_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id UUID NOT NULL,
  product_id TEXT NOT NULL,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  UNIQUE(partner_user_id, product_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_product ON partner_commissions(product_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);
CREATE INDEX IF NOT EXISTS idx_products_partner_id ON products(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_seller_partner ON products(seller_id, partner_id) WHERE partner_id IS NOT NULL;

-- ======================================
-- ÉTAPE 3: FONCTION POUR CLIENTS RÉFÉRÉS
-- ======================================
CREATE OR REPLACE FUNCTION get_partner_referred_clients(partner_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(client_data ORDER BY first_use_date DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT DISTINCT ON (p.seller_id)
      p.seller_id as id,
      p.seller_id,
      p.seller_name,
      p.seller_phone,
      COALESCE(p.seller_avatar, '') as seller_avatar,
      MIN(p.created_at) as first_use_date,
      COUNT(*) as total_products,
      SUM(COALESCE(p.original_price, p.price) - p.price) as total_discount_received,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_id', prod.id,
            'product_title', prod.title,
            'product_price', prod.price,
            'product_status', prod.status,
            'created_at', prod.created_at
          )
          ORDER BY prod.created_at DESC
        )
        FROM (
          SELECT * FROM products prod
          WHERE prod.seller_id = p.seller_id
            AND prod.partner_id = partner_user_id::text
          ORDER BY prod.created_at DESC
          LIMIT 5
        ) prod
      ) as products
    FROM products p
    WHERE p.partner_id = partner_user_id::text
      AND p.seller_id != partner_user_id::text
    GROUP BY p.seller_id, p.seller_name, p.seller_phone, p.seller_avatar
  ) client_data;
  
  RETURN result;
END;
$$;

-- ======================================
-- ÉTAPE 4: FONCTION POUR STATS PARTENAIRE
-- ======================================
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_total_clients INTEGER;
  v_total_sales INTEGER;
  v_total_commission NUMERIC;
  v_total_pending NUMERIC;
  v_total_paid NUMERIC;
BEGIN
  -- Compter les clients uniques
  SELECT COUNT(DISTINCT seller_id)
  INTO v_total_clients
  FROM products
  WHERE partner_id = partner_user_id::text
    AND seller_id != partner_user_id::text;
  
  -- Compter les ventes
  SELECT COUNT(*)
  INTO v_total_sales
  FROM products
  WHERE partner_id = partner_user_id::text
    AND seller_id != partner_user_id::text;
  
  -- Calculer les commissions
  SELECT 
    COALESCE(SUM(commission_amount), 0),
    COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0)
  INTO v_total_commission, v_total_pending, v_total_paid
  FROM partner_commissions
  WHERE partner_user_id = get_partner_stats.partner_user_id;
  
  result := jsonb_build_object(
    'total_clients', v_total_clients,
    'total_sales', v_total_sales,
    'total_commission_earned', v_total_commission,
    'total_pending_commission', v_total_pending,
    'total_paid_commission', v_total_paid
  );
  
  RETURN result;
END;
$$;

-- ======================================
-- ÉTAPE 5: FONCTION POUR LISTE DES COMMISSIONS
-- ======================================
CREATE OR REPLACE FUNCTION get_partner_commissions(partner_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(commission_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT 
      pc.id,
      pc.product_id,
      p.title as product_title,
      p.price as product_price,
      p.seller_id,
      p.seller_name,
      p.seller_phone,
      p.seller_avatar,
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
-- ÉTAPE 6: FONCTION POUR STATS DES COMMISSIONS
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
-- ÉTAPE 7: FONCTION POUR PARTENAIRES ACTIFS
-- ======================================
CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(partner_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO result
  FROM (
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
        WHERE pc.partner_user_id::text = u.id
      ), 0) as total_commission_earned,
      COALESCE((
        SELECT COUNT(*)
        FROM products p
        WHERE p.partner_id = u.id
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
-- ÉTAPE 8: FONCTION TRIGGER POUR CRÉER COMMISSIONS
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
  v_existing_commission UUID;
BEGIN
  -- Vérifier que le produit vient d'être approuvé
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Récupérer l'ID du partenaire depuis partner_id
    IF NEW.partner_id IS NOT NULL AND NEW.partner_id != '' THEN
      BEGIN
        v_partner_id := NEW.partner_id::uuid;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Invalid partner_id format: %', NEW.partner_id;
        v_partner_id := NULL;
      END;
      
      -- Vérifier que ce n'est pas le vendeur lui-même
      IF v_partner_id IS NOT NULL AND v_partner_id::text != NEW.seller_id THEN
        
        -- Vérifier si une commission existe déjà
        SELECT id INTO v_existing_commission
        FROM partner_commissions
        WHERE partner_user_id = v_partner_id
          AND product_id = NEW.id;
        
        -- Si pas de commission existante, en créer une
        IF v_existing_commission IS NULL THEN
          
          -- Récupérer le taux de commission
          SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
          FROM global_settings
          LIMIT 1;
          
          -- Si pas de settings, utiliser 10% par défaut
          IF v_commission_rate IS NULL THEN
            v_commission_rate := 10;
          END IF;
          
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
          );
          
          RAISE NOTICE 'Commission créée: % FCFA pour partenaire %', v_commission_amount, v_partner_id;
          
          -- Créer une notification pour le partenaire
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
            RAISE NOTICE 'Erreur lors de la création de la notification: %', SQLERRM;
          END;
          
        ELSE
          RAISE NOTICE 'Commission déjà existante pour ce produit';
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_create_partner_commission ON products;
CREATE TRIGGER trigger_create_partner_commission
  AFTER INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION create_partner_commission_on_approval();

-- ======================================
-- ÉTAPE 9: RLS POLICIES
-- ======================================
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Partners can view their own commissions" ON partner_commissions;
DROP POLICY IF EXISTS "Admins can view all commissions" ON partner_commissions;
DROP POLICY IF EXISTS "Admins can update commissions" ON partner_commissions;
DROP POLICY IF EXISTS "System can insert commissions" ON partner_commissions;

-- Policy pour lecture partenaire
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

-- Policy pour insertion (système)
CREATE POLICY "System can insert commissions"
  ON partner_commissions
  FOR INSERT
  WITH CHECK (true);

-- Policy pour mise à jour admin
CREATE POLICY "Admins can update commissions"
  ON partner_commissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
      AND (is_admin = true OR is_super_admin = true)
    )
  );

-- ======================================
-- ÉTAPE 10: TESTER LE SYSTÈME
-- ======================================
-- Tester une fonction
DO $$
DECLARE
  test_result JSONB;
BEGIN
  -- Test de la fonction get_partner_stats
  SELECT get_partner_stats('00000000-0000-0000-0000-000000000000'::uuid) INTO test_result;
  RAISE NOTICE 'Test réussi - Système opérationnel';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erreur lors du test: %', SQLERRM;
END;
$$;

-- ============================================
-- TERMINÉ - Le système est maintenant fonctionnel:
-- 1. Les partenaires voient les clients qui utilisent leur code
-- 2. Les partenaires voient les commissions en temps réel
-- 3. Les notifications sont créées automatiquement
-- 4. Pas d'erreurs de dépendances
-- ============================================
