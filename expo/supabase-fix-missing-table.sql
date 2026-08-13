-- ============================================
-- CORRECTION: Création de la table partner_commissions
-- ============================================

-- 1. Créer la table partner_commissions
CREATE TABLE IF NOT EXISTS partner_commissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  partner_user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  commission_amount NUMERIC(10, 2) NOT NULL,
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  paid_by TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_product ON partner_commissions(product_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_created ON partner_commissions(created_at DESC);

-- 3. Activer RLS
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

-- 4. Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Partners can view own commissions" ON partner_commissions;
DROP POLICY IF EXISTS "Admins can manage all commissions" ON partner_commissions;

-- 5. Créer les politiques RLS
CREATE POLICY "Partners can view own commissions"
ON partner_commissions FOR SELECT
USING (
  partner_user_id = (SELECT auth.uid()::TEXT)
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = (SELECT auth.uid()::TEXT) 
    AND (users.is_admin = true OR users.is_super_admin = true)
  )
);

CREATE POLICY "Admins can manage all commissions"
ON partner_commissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = (SELECT auth.uid()::TEXT) 
    AND (users.is_admin = true OR users.is_super_admin = true)
  )
);

-- 6. Créer un trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_partner_commissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partner_commissions_updated_at ON partner_commissions;
CREATE TRIGGER partner_commissions_updated_at
  BEFORE UPDATE ON partner_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_partner_commissions_updated_at();

-- 7. Fonction pour obtenir les commissions d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_commission_history(p_partner_user_id TEXT)
RETURNS TABLE (
  id TEXT,
  partner_user_id TEXT,
  product_id TEXT,
  product_title TEXT,
  product_price NUMERIC,
  seller_name TEXT,
  commission_amount NUMERIC,
  commission_rate NUMERIC,
  status TEXT,
  paid_at TIMESTAMPTZ,
  paid_by TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id,
    pc.partner_user_id,
    pc.product_id,
    p.title AS product_title,
    p.price AS product_price,
    p.seller_name,
    pc.commission_amount,
    pc.commission_rate,
    pc.status,
    pc.paid_at,
    pc.paid_by,
    pc.cancelled_at,
    pc.cancelled_by,
    pc.created_at
  FROM partner_commissions pc
  LEFT JOIN products p ON p.id = pc.product_id
  WHERE pc.partner_user_id = p_partner_user_id
  ORDER BY pc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Créer ou remplacer la fonction get_active_user_partners
CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS TABLE (
  id TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  avatar TEXT,
  bio TEXT,
  partner_referral_code TEXT,
  total_commission_earned NUMERIC,
  total_sales BIGINT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.phone,
    u.email,
    u.avatar,
    u.bio,
    u.partner_referral_code,
    COALESCE(SUM(pc.commission_amount) FILTER (WHERE pc.status IN ('pending', 'paid')), 0) AS total_commission_earned,
    COUNT(DISTINCT pc.product_id)::BIGINT AS total_sales,
    u.created_at
  FROM users u
  LEFT JOIN partner_commissions pc ON pc.partner_user_id = u.id
  WHERE u.is_partner = true
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.partner_referral_code, u.created_at
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Fonction pour obtenir les stats d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id TEXT)
RETURNS TABLE (
  total_sales BIGINT,
  total_commission_earned NUMERIC,
  pending_commission NUMERIC,
  paid_commission NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT pc.product_id)::BIGINT AS total_sales,
    COALESCE(SUM(pc.commission_amount) FILTER (WHERE pc.status IN ('pending', 'paid')), 0) AS total_commission_earned,
    COALESCE(SUM(pc.commission_amount) FILTER (WHERE pc.status = 'pending'), 0) AS pending_commission,
    COALESCE(SUM(pc.commission_amount) FILTER (WHERE pc.status = 'paid'), 0) AS paid_commission
  FROM partner_commissions pc
  WHERE pc.partner_user_id = get_partner_stats.partner_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Migrer les données depuis commission_payments si elle existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'commission_payments') THEN
    INSERT INTO partner_commissions (
      id,
      partner_user_id,
      product_id,
      commission_amount,
      commission_rate,
      status,
      paid_at,
      paid_by,
      created_at,
      updated_at
    )
    SELECT 
      id,
      partner_user_id,
      product_id,
      commission_amount,
      commission_rate,
      status,
      paid_at,
      paid_by,
      created_at,
      updated_at
    FROM commission_payments
    WHERE NOT EXISTS (
      SELECT 1 FROM partner_commissions pc 
      WHERE pc.id = commission_payments.id
    );
    
    RAISE NOTICE 'Migration des données depuis commission_payments terminée';
  END IF;
END $$;

-- 11. Vérifier la création
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM partner_commissions;
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Table partner_commissions créée';
  RAISE NOTICE 'ℹ️  Nombre de commissions: %', v_count;
  RAISE NOTICE '========================================';
END $$;
