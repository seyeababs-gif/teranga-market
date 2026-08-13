-- Ajouter le champ is_partner aux utilisateurs
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE;

-- Index pour les partenaires
CREATE INDEX IF NOT EXISTS idx_users_is_partner ON users(is_partner);

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
    COALESCE(SUM(dc.partner_commission_earned), 0)::numeric as total_commission_earned,
    COUNT(DISTINCT dcu.product_id)::integer as total_sales,
    u.joined_date as created_at
  FROM users u
  LEFT JOIN discount_codes dc ON dc.partner_user_id = u.id
  LEFT JOIN discount_code_usage dcu ON dcu.discount_code_id = dc.id AND dcu.user_id = u.id
  WHERE u.is_partner = TRUE
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.joined_date
  ORDER BY u.joined_date DESC;
END;
$$;

-- Migrer les partenaires existants de la table partners vers users
DO $$
DECLARE
  partner_record RECORD;
  user_exists BOOLEAN;
BEGIN
  FOR partner_record IN SELECT * FROM partners WHERE is_active = TRUE LOOP
    -- Vérifier si un utilisateur avec ce téléphone existe
    SELECT EXISTS(SELECT 1 FROM users WHERE phone = partner_record.phone) INTO user_exists;
    
    IF user_exists THEN
      -- Mettre à jour l'utilisateur existant
      UPDATE users 
      SET is_partner = TRUE 
      WHERE phone = partner_record.phone;
    END IF;
  END LOOP;
END $$;

-- Modifier la table discount_codes pour référencer directement les utilisateurs
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS partner_user_id TEXT REFERENCES users(id);

-- Migrer les partner_id existants vers partner_user_id
UPDATE discount_codes dc
SET partner_user_id = u.id
FROM partners p
JOIN users u ON u.phone = p.phone
WHERE dc.partner_id = p.id AND dc.partner_user_id IS NULL;

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

COMMENT ON COLUMN users.is_partner IS 'Indique si l''utilisateur est un partenaire/influenceur qui peut avoir des codes promo associés';
