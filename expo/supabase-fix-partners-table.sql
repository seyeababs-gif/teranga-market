-- Supprimer les références à l'ancienne table partners
DROP TABLE IF EXISTS partners CASCADE;

-- Ajouter le champ is_partner aux utilisateurs
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE;

-- Index pour les partenaires
CREATE INDEX IF NOT EXISTS idx_users_is_partner ON users(is_partner);

-- Modifier la table discount_codes pour référencer directement les utilisateurs
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS partner_user_id TEXT REFERENCES users(id);

-- Supprimer l'ancienne colonne partner_id si elle existe
ALTER TABLE discount_codes DROP COLUMN IF EXISTS partner_id;

-- Fonction pour obtenir tous les partenaires actifs
CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS TABLE (
  id TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  avatar TEXT,
  bio TEXT,
  total_commission_earned NUMERIC,
  total_sales INTEGER,
  created_at TIMESTAMPTZ
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.phone,
    u.email,
    u.avatar,
    u.bio,
    COALESCE(SUM(dcu.partner_commission), 0)::numeric as total_commission_earned,
    COUNT(DISTINCT dcu.product_id)::integer as total_sales,
    u.joined_date as created_at
  FROM users u
  LEFT JOIN discount_codes dc ON dc.partner_user_id = u.id
  LEFT JOIN discount_code_usage dcu ON dcu.code_id = dc.id
  WHERE u.is_partner = TRUE
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.joined_date
  ORDER BY u.joined_date DESC;
END;
$$;

-- Fonction pour créer un code de réduction avec partenaire utilisateur
CREATE OR REPLACE FUNCTION create_discount_code_for_partner(
  p_code TEXT,
  p_partner_user_id TEXT,
  p_description TEXT DEFAULT NULL,
  p_discount_rate NUMERIC DEFAULT 5,
  p_usage_limit INTEGER DEFAULT NULL,
  p_created_by TEXT DEFAULT NULL
)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_code_id TEXT;
BEGIN
  -- Vérifier que l'utilisateur est bien un partenaire
  IF NOT EXISTS(SELECT 1 FROM users WHERE id = p_partner_user_id AND is_partner = TRUE) THEN
    RAISE EXCEPTION 'L''utilisateur n''est pas un partenaire';
  END IF;
  
  v_code_id := 'discount-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000);
  
  INSERT INTO discount_codes (
    id,
    code,
    partner_user_id,
    description,
    discount_rate,
    usage_limit,
    times_used,
    is_active,
    created_by,
    partner_commission_rate
  ) VALUES (
    v_code_id,
    UPPER(p_code),
    p_partner_user_id,
    p_description,
    p_discount_rate,
    p_usage_limit,
    0,
    TRUE,
    p_created_by,
    5
  );
  
  RETURN v_code_id;
END;
$$;

-- Fonction pour calculer la commission sur un produit (mise à jour)
CREATE OR REPLACE FUNCTION calculate_product_commission(
  p_price NUMERIC,
  p_user_type TEXT,
  p_discount_code TEXT DEFAULT NULL
)
RETURNS TABLE(
  commission_amount NUMERIC,
  final_rate NUMERIC,
  partner_commission NUMERIC,
  partner_user_id TEXT
) AS $$
DECLARE
  v_base_rate NUMERIC;
  v_discount_reduction NUMERIC;
  v_partner_rate NUMERIC;
  v_code discount_codes%ROWTYPE;
  v_final_rate NUMERIC;
  v_commission NUMERIC;
  v_partner_commission NUMERIC := 0;
  v_partner_user_id TEXT := NULL;
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
        IF v_code.partner_user_id IS NOT NULL THEN
          v_partner_user_id := v_code.partner_user_id;
          v_partner_commission := p_price * (v_partner_rate / 100);
        END IF;
      END IF;
    END IF;
    
    v_commission := p_price * (v_final_rate / 100);
  END IF;
  
  RETURN QUERY SELECT v_commission, v_final_rate, v_partner_commission, v_partner_user_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour enregistrer l'utilisation d'un code avec commission partenaire (mise à jour)
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
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN users.is_partner IS 'Indique si l''utilisateur est un partenaire/influenceur qui peut avoir des codes promo associés';
