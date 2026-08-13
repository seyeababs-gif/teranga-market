-- Table pour tracer les commissions des partenaires
CREATE TABLE IF NOT EXISTS partner_commissions (
  id TEXT PRIMARY KEY,
  partner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(partner_user_id, order_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_order ON partner_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);

-- Function pour calculer et créer la commission partenaire lors de la validation d'une commande
CREATE OR REPLACE FUNCTION create_partner_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_partner_id TEXT;
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
  v_product_record RECORD;
BEGIN
  -- Seulement si le statut passe à 'validated'
  IF NEW.status = 'validated' AND (OLD.status IS NULL OR OLD.status != 'validated') THEN
    
    -- Pour chaque produit de la commande
    FOR v_product_record IN 
      SELECT DISTINCT 
        (item->>'product')::jsonb->>'id' as product_id
      FROM jsonb_array_elements(NEW.items) AS item
    LOOP
      -- Trouver le partenaire via le code de réduction utilisé dans le produit
      SELECT 
        p.seller_id as partner_id,
        COALESCE(gs.partner_commission_rate, 5) as commission_rate
      INTO v_partner_id, v_commission_rate
      FROM products p
      LEFT JOIN discount_codes dc ON p.discount_code = dc.code AND p.discount_code_applied = true
      LEFT JOIN global_settings gs ON true
      WHERE p.id = v_product_record.product_id
        AND dc.partner_user_id IS NOT NULL;
      
      -- Si un partenaire est trouvé, créer la commission
      IF v_partner_id IS NOT NULL THEN
        -- Calculer le montant de la commission
        v_commission_amount := NEW.total_amount * (v_commission_rate / 100);
        
        -- Insérer la commission (si elle n'existe pas déjà)
        INSERT INTO partner_commissions (
          id,
          partner_user_id,
          order_id,
          commission_amount,
          status,
          created_at
        ) VALUES (
          'comm-' || gen_random_uuid()::text,
          v_partner_id,
          NEW.id,
          v_commission_amount,
          'pending',
          NOW()
        )
        ON CONFLICT (partner_user_id, order_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour créer automatiquement les commissions
DROP TRIGGER IF EXISTS trigger_create_partner_commission ON orders;
CREATE TRIGGER trigger_create_partner_commission
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION create_partner_commission();

-- Fonction pour valider les commissions (appelée quand l'admin valide le paiement)
CREATE OR REPLACE FUNCTION validate_partner_commissions(p_order_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE partner_commissions
  SET 
    status = 'paid',
    paid_at = NOW()
  WHERE order_id = p_order_id
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les statistiques du partenaire (mettre à jour)
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id TEXT)
RETURNS TABLE (
  total_sales BIGINT,
  total_commission NUMERIC,
  total_referrals BIGINT,
  active_discount_codes BIGINT,
  pending_commission NUMERIC,
  paid_commission NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END)::BIGINT as total_sales,
    COALESCE(SUM(CASE WHEN pc.status = 'paid' THEN pc.commission_amount ELSE 0 END), 0) as total_commission,
    COUNT(DISTINCT u.id)::BIGINT as total_referrals,
    COUNT(DISTINCT CASE WHEN dc.is_active = true THEN dc.id END)::BIGINT as active_discount_codes,
    COALESCE(SUM(CASE WHEN pc.status = 'pending' THEN pc.commission_amount ELSE 0 END), 0) as pending_commission,
    COALESCE(SUM(CASE WHEN pc.status = 'paid' THEN pc.commission_amount ELSE 0 END), 0) as paid_commission
  FROM users partner_user
  LEFT JOIN users u ON u.referred_by_partner_id = partner_user.id
  LEFT JOIN discount_codes dc ON dc.partner_user_id = partner_user.id
  LEFT JOIN partner_commissions pc ON pc.partner_user_id = partner_user.id
  LEFT JOIN orders o ON o.id = pc.order_id
  WHERE partner_user.id = partner_user_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour notifier le partenaire quand son code est utilisé
CREATE OR REPLACE FUNCTION notify_partner_on_code_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_partner_id TEXT;
  v_partner_name TEXT;
BEGIN
  -- Si un code de réduction est appliqué
  IF NEW.discount_code_applied = true AND NEW.discount_code IS NOT NULL THEN
    -- Trouver le partenaire
    SELECT 
      dc.partner_user_id,
      u.name
    INTO v_partner_id, v_partner_name
    FROM discount_codes dc
    JOIN users u ON u.id = dc.partner_user_id
    WHERE dc.code = NEW.discount_code
      AND dc.partner_user_id IS NOT NULL;
    
    -- Si un partenaire est trouvé, créer une notification
    IF v_partner_id IS NOT NULL THEN
      INSERT INTO notifications (
        id,
        user_id,
        type,
        title,
        message,
        data,
        created_at,
        read
      ) VALUES (
        'notif-' || gen_random_uuid()::text,
        v_partner_id,
        'partner_code_used',
        'Code utilisé ! 🎉',
        NEW.seller_name || ' a utilisé votre code ' || NEW.discount_code || ' pour publier "' || NEW.title || '"',
        jsonb_build_object(
          'productId', NEW.id,
          'sellerId', NEW.seller_id,
          'sellerName', NEW.seller_name,
          'code', NEW.discount_code
        ),
        NOW(),
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour notifier le partenaire
DROP TRIGGER IF EXISTS trigger_notify_partner_on_code_usage ON products;
CREATE TRIGGER trigger_notify_partner_on_code_usage
AFTER INSERT OR UPDATE OF discount_code_applied ON products
FOR EACH ROW
WHEN (NEW.discount_code_applied = true)
EXECUTE FUNCTION notify_partner_on_code_usage();

-- RLS policies pour partner_commissions
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

-- Les partenaires peuvent voir leurs propres commissions
CREATE POLICY "Partners can view own commissions"
ON partner_commissions FOR SELECT
USING (partner_user_id = auth.uid());

-- Les admins peuvent tout voir et modifier
CREATE POLICY "Admins can manage all commissions"
ON partner_commissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND (users.is_admin = true OR users.is_super_admin = true)
  )
);
