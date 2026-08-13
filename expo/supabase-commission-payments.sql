-- ============================================
-- SYSTÈME DE GESTION DES PAIEMENTS DE COMMISSIONS
-- ============================================

-- 1. Créer la table des paiements de commissions
CREATE TABLE IF NOT EXISTS commission_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  commission_amount NUMERIC(10, 2) NOT NULL,
  commission_rate NUMERIC(5, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  paid_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_commission_payments_partner ON commission_payments(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_product ON commission_payments(product_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_status ON commission_payments(status);
CREATE INDEX IF NOT EXISTS idx_commission_payments_created ON commission_payments(created_at DESC);

-- 3. Activer RLS
ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;

-- 4. Créer les politiques RLS
DROP POLICY IF EXISTS "Tous peuvent voir les paiements" ON commission_payments;
CREATE POLICY "Tous peuvent voir les paiements" ON commission_payments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Seulement super admin peut créer des paiements" ON commission_payments;
CREATE POLICY "Seulement super admin peut créer des paiements" ON commission_payments
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Seulement super admin peut modifier des paiements" ON commission_payments;
CREATE POLICY "Seulement super admin peut modifier des paiements" ON commission_payments
  FOR UPDATE USING (true);

-- 5. Créer une fonction pour obtenir les statistiques de commission d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_commission_stats_v2(p_partner_id UUID)
RETURNS TABLE (
  total_earned NUMERIC,
  total_pending NUMERIC,
  total_paid NUMERIC,
  total_products BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(commission_amount), 0) as total_earned,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as total_pending,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0) as total_paid,
    COUNT(*)::BIGINT as total_products
  FROM commission_payments
  WHERE partner_user_id = p_partner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Créer une fonction trigger pour créer automatiquement un paiement de commission
CREATE OR REPLACE FUNCTION create_commission_payment_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
  v_partner_uuid UUID;
BEGIN
  IF NEW.status = 'approved' 
     AND NEW.partner_id IS NOT NULL 
     AND NEW.discount_code_applied = true
     AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    BEGIN
      v_partner_uuid := NEW.partner_id::UUID;
      
      SELECT COALESCE(partner_commission_rate, 5) INTO v_commission_rate
      FROM global_settings
      LIMIT 1;
      
      v_commission_amount := (NEW.price * v_commission_rate) / 100;
      
      IF NOT EXISTS (
        SELECT 1 FROM commission_payments 
        WHERE product_id = NEW.id
      ) THEN
        INSERT INTO commission_payments (
          partner_user_id,
          product_id,
          commission_amount,
          commission_rate,
          status,
          created_at,
          updated_at
        )
        VALUES (
          v_partner_uuid,
          NEW.id,
          v_commission_amount,
          v_commission_rate,
          'pending',
          NOW(),
          NOW()
        );
        
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
          NEW.partner_id,
          'partner_commission',
          '🎉 Nouvelle commission !',
          format('Commission de %s FCFA générée pour le produit "%s"', 
                 ROUND(v_commission_amount)::text, 
                 NEW.title),
          jsonb_build_object(
            'product_id', NEW.id,
            'product_title', NEW.title,
            'commission_amount', v_commission_amount,
            'seller_name', NEW.seller_name
          ),
          false,
          NOW()
        );
        
        RAISE NOTICE 'Paiement de commission créé: % FCFA pour le produit %', 
                     v_commission_amount, NEW.id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erreur lors de la création du paiement de commission: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Supprimer l'ancien trigger s'il existe et créer le nouveau
DROP TRIGGER IF EXISTS trigger_create_commission_payment ON products;
CREATE TRIGGER trigger_create_commission_payment
  AFTER INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION create_commission_payment_on_approval();

-- 8. Fonction pour marquer une commission comme payée
CREATE OR REPLACE FUNCTION mark_commission_as_paid(
  p_payment_id UUID,
  p_paid_by TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_partner_id TEXT;
  v_product_title TEXT;
  v_commission_amount NUMERIC;
BEGIN
  UPDATE commission_payments
  SET status = 'paid',
      paid_at = NOW(),
      paid_by = p_paid_by,
      updated_at = NOW()
  WHERE id = p_payment_id
  RETURNING partner_user_id::TEXT, commission_amount INTO v_partner_id, v_commission_amount;
  
  IF FOUND THEN
    SELECT p.title INTO v_product_title
    FROM products p
    JOIN commission_payments cp ON cp.product_id = p.id
    WHERE cp.id = p_payment_id;
    
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
      'commission_paid',
      '💰 Commission payée !',
      format('Votre commission de %s FCFA a été payée pour "%s"', 
             ROUND(v_commission_amount)::text, 
             v_product_title),
      jsonb_build_object(
        'payment_id', p_payment_id,
        'commission_amount', v_commission_amount,
        'product_title', v_product_title
      ),
      false,
      NOW()
    );
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Migrer les données existantes si nécessaire
INSERT INTO commission_payments (partner_user_id, product_id, commission_amount, commission_rate, status, created_at, updated_at)
SELECT 
  p.partner_id::UUID,
  p.id,
  (p.price * COALESCE((SELECT partner_commission_rate FROM global_settings LIMIT 1), 5)) / 100,
  COALESCE((SELECT partner_commission_rate FROM global_settings LIMIT 1), 5),
  'pending',
  p.approved_at,
  p.approved_at
FROM products p
WHERE p.status = 'approved'
  AND p.partner_id IS NOT NULL
  AND p.discount_code_applied = true
  AND NOT EXISTS (
    SELECT 1 FROM commission_payments cp WHERE cp.product_id = p.id
  )
ON CONFLICT DO NOTHING;

-- 10. Vérification
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM commission_payments;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration terminée !';
  RAISE NOTICE 'Nombre de paiements de commissions: %', v_count;
  RAISE NOTICE '========================================';
END $$;
