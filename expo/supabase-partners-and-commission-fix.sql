-- Mise à jour de la commission par défaut à 15%
UPDATE products 
SET commission_amount = price * 0.15 
WHERE commission_amount IS NOT NULL;

-- Table pour les partenaires/influenceurs
CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  avatar TEXT,
  bio TEXT,
  total_commission_earned NUMERIC DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_active ON partners(is_active);
CREATE INDEX IF NOT EXISTS idx_partners_created ON partners(created_at DESC);

-- Modifier la table discount_codes pour ajouter le lien avec les partenaires
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS partner_id TEXT REFERENCES partners(id);
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS partner_commission_rate NUMERIC DEFAULT 5;

-- Modifier discount_code_usage pour suivre les commissions des partenaires
ALTER TABLE discount_code_usage ADD COLUMN IF NOT EXISTS partner_commission NUMERIC DEFAULT 0;

-- Table pour les paramètres globaux
CREATE TABLE IF NOT EXISTS global_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  commission_rate NUMERIC DEFAULT 15,
  discount_reduction NUMERIC DEFAULT 5,
  partner_commission_rate NUMERIC DEFAULT 5,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id)
);

-- Insérer les paramètres par défaut
INSERT INTO global_settings (id, commission_rate, discount_reduction, partner_commission_rate)
VALUES ('default', 15, 5, 5)
ON CONFLICT (id) DO UPDATE SET
  commission_rate = 15,
  discount_reduction = 5,
  partner_commission_rate = 5;

-- Fonction pour obtenir le taux de commission actuel
CREATE OR REPLACE FUNCTION get_current_commission_rate()
RETURNS NUMERIC AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  SELECT commission_rate INTO v_rate FROM global_settings WHERE id = 'default';
  RETURN COALESCE(v_rate, 15);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer la commission sur un produit
CREATE OR REPLACE FUNCTION calculate_product_commission(
  p_price NUMERIC,
  p_user_type TEXT,
  p_discount_code TEXT DEFAULT NULL
)
RETURNS TABLE(
  commission_amount NUMERIC,
  final_rate NUMERIC,
  partner_commission NUMERIC,
  partner_id TEXT
) AS $$
DECLARE
  v_base_rate NUMERIC;
  v_discount_reduction NUMERIC;
  v_partner_rate NUMERIC;
  v_code discount_codes%ROWTYPE;
  v_final_rate NUMERIC;
  v_commission NUMERIC;
  v_partner_commission NUMERIC := 0;
  v_partner_id TEXT := NULL;
BEGIN
  -- Récupérer les paramètres globaux
  SELECT gs.commission_rate, gs.discount_reduction, gs.partner_commission_rate
  INTO v_base_rate, v_discount_reduction, v_partner_rate
  FROM global_settings gs WHERE id = 'default';
  
  -- Par défaut 15%
  v_base_rate := COALESCE(v_base_rate, 15);
  v_discount_reduction := COALESCE(v_discount_reduction, 5);
  v_partner_rate := COALESCE(v_partner_rate, 5);
  
  -- Si premium, 0% de commission
  IF p_user_type = 'premium' THEN
    v_final_rate := 0;
    v_commission := 0;
  ELSE
    v_final_rate := v_base_rate;
    
    -- Appliquer la réduction si code promo valide
    IF p_discount_code IS NOT NULL THEN
      SELECT * INTO v_code FROM discount_codes WHERE code = p_discount_code AND is_active = true;
      
      IF FOUND THEN
        -- Réduire la commission (15% - 5% = 10%)
        v_final_rate := v_base_rate - v_discount_reduction;
        
        -- Si le code est lié à un partenaire, calculer sa commission
        IF v_code.partner_id IS NOT NULL THEN
          v_partner_id := v_code.partner_id;
          v_partner_commission := p_price * (v_partner_rate / 100);
        END IF;
      END IF;
    END IF;
    
    v_commission := p_price * (v_final_rate / 100);
  END IF;
  
  RETURN QUERY SELECT v_commission, v_final_rate, v_partner_commission, v_partner_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour enregistrer l'utilisation d'un code avec commission partenaire
CREATE OR REPLACE FUNCTION record_discount_code_usage(
  p_code TEXT,
  p_user_id TEXT,
  p_product_id TEXT,
  p_commission_saved NUMERIC,
  p_partner_commission NUMERIC DEFAULT 0
)
RETURNS BOOLEAN AS $$
DECLARE
  v_code discount_codes%ROWTYPE;
BEGIN
  -- Récupérer le code
  SELECT * INTO v_code FROM discount_codes WHERE code = p_code;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Enregistrer l'utilisation
  INSERT INTO discount_code_usage (
    id,
    code_id,
    user_id,
    product_id,
    commission_saved,
    partner_commission
  ) VALUES (
    'usage-' || gen_random_uuid()::TEXT,
    v_code.id,
    p_user_id,
    p_product_id,
    p_commission_saved,
    p_partner_commission
  );
  
  -- Incrémenter le compteur d'utilisation
  UPDATE discount_codes 
  SET times_used = times_used + 1 
  WHERE id = v_code.id;
  
  -- Mettre à jour les statistiques du partenaire si applicable
  IF v_code.partner_id IS NOT NULL AND p_partner_commission > 0 THEN
    UPDATE partners
    SET 
      total_commission_earned = total_commission_earned + p_partner_commission,
      total_sales = total_sales + 1,
      updated_at = NOW()
    WHERE id = v_code.partner_id;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Politiques RLS pour partners
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active partners" ON partners
  FOR SELECT USING (is_active = true);

CREATE POLICY "SuperAdmins can manage partners" ON partners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Politiques RLS pour global_settings
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view global settings" ON global_settings
  FOR SELECT USING (true);

CREATE POLICY "SuperAdmins can manage global settings" ON global_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
  );
