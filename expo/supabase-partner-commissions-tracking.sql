-- 🎯 Système de tracking des commissions partenaires
-- Ce script crée la table de suivi des commissions et met à jour les triggers

-- 1. Créer la table de commissions
CREATE TABLE IF NOT EXISTS partner_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  product_title TEXT NOT NULL,
  product_price DECIMAL(10, 2) NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL,
  commission_amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Index pour les requêtes rapides
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_product ON partner_commissions(product_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_created ON partner_commissions(created_at DESC);

-- Enable RLS
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

-- Politique: Les partenaires peuvent voir leurs propres commissions
DROP POLICY IF EXISTS "Partners can view own commissions" ON partner_commissions;
CREATE POLICY "Partners can view own commissions"
ON partner_commissions FOR SELECT
USING (
  partner_id IN (
    SELECT id FROM users WHERE id = auth.uid()::TEXT
  )
);

-- Politique: Super admin peut tout voir et modifier
DROP POLICY IF EXISTS "Super admin full access to commissions" ON partner_commissions;
CREATE POLICY "Super admin full access to commissions"
ON partner_commissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid()::TEXT 
    AND is_super_admin = true
  )
);

-- 2. Fonction pour enregistrer une commission quand un produit est approuvé
CREATE OR REPLACE FUNCTION record_partner_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_partner_id TEXT;
  v_commission_rate DECIMAL(5, 2);
  v_commission_amount DECIMAL(10, 2);
BEGIN
  -- Vérifier si le produit vient d'être approuvé et a un partner_id
  IF NEW.status = 'approved' 
     AND OLD.status != 'approved' 
     AND NEW.partner_id IS NOT NULL 
     AND NEW.partner_id != '' THEN
    
    -- Récupérer le taux de commission global
    SELECT partner_commission_rate INTO v_commission_rate
    FROM global_settings
    LIMIT 1;
    
    -- Si pas trouvé, utiliser 10% par défaut
    IF v_commission_rate IS NULL THEN
      v_commission_rate := 10.0;
    END IF;
    
    -- Calculer la commission
    v_commission_amount := (NEW.price * v_commission_rate / 100)::DECIMAL(10, 2);
    
    -- Insérer dans la table de commissions
    INSERT INTO partner_commissions (
      partner_id,
      product_id,
      seller_id,
      seller_name,
      product_title,
      product_price,
      commission_rate,
      commission_amount,
      status
    ) VALUES (
      NEW.partner_id,
      NEW.id,
      NEW.seller_id,
      NEW.seller_name,
      NEW.title,
      NEW.price,
      v_commission_rate,
      v_commission_amount,
      'pending'
    );
    
    RAISE NOTICE 'Commission enregistrée pour partenaire % : % FCFA', NEW.partner_id, v_commission_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trigger_record_partner_commission ON products;

-- Créer le trigger
CREATE TRIGGER trigger_record_partner_commission
AFTER UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION record_partner_commission();

-- 3. Fonction RPC pour récupérer les commissions d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_commissions(partner_user_id TEXT)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  seller_id TEXT,
  seller_name TEXT,
  product_title TEXT,
  product_price DECIMAL(10, 2),
  commission_rate DECIMAL(5, 2),
  commission_amount DECIMAL(10, 2),
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id,
    pc.product_id,
    pc.seller_id,
    pc.seller_name,
    pc.product_title,
    pc.product_price,
    pc.commission_rate,
    pc.commission_amount,
    pc.status,
    pc.created_at,
    pc.paid_at,
    pc.notes
  FROM partner_commissions pc
  WHERE pc.partner_id = partner_user_id
  ORDER BY pc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fonction pour marquer une commission comme payée (super admin uniquement)
CREATE OR REPLACE FUNCTION mark_commission_paid(commission_id UUID, payment_notes TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  -- Vérifier si l'utilisateur est super admin
  SELECT is_super_admin INTO v_is_super_admin
  FROM users
  WHERE id = auth.uid()::TEXT;
  
  IF NOT COALESCE(v_is_super_admin, false) THEN
    RETURN json_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  -- Mettre à jour la commission
  UPDATE partner_commissions
  SET 
    status = 'paid',
    paid_at = NOW(),
    notes = COALESCE(payment_notes, notes)
  WHERE id = commission_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Commission non trouvée');
  END IF;
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fonction pour obtenir les statistiques de commissions
CREATE OR REPLACE FUNCTION get_partner_commission_stats(partner_user_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_total_pending DECIMAL(10, 2);
  v_total_paid DECIMAL(10, 2);
  v_total_commissions INTEGER;
BEGIN
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0),
    COUNT(*)
  INTO v_total_pending, v_total_paid, v_total_commissions
  FROM partner_commissions
  WHERE partner_id = partner_user_id;
  
  RETURN json_build_object(
    'total_pending', v_total_pending,
    'total_paid', v_total_paid,
    'total_commissions', v_total_commissions,
    'total_earned', v_total_pending + v_total_paid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ Script terminé !
