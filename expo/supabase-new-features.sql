-- Table pour les codes de réduction
CREATE TABLE IF NOT EXISTS discount_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_rate NUMERIC DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  usage_limit INTEGER,
  times_used INTEGER DEFAULT 0,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT REFERENCES users(id)
);

-- Index pour accélérer les recherches par code
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);

-- Table pour suivre l'utilisation des codes par utilisateur
CREATE TABLE IF NOT EXISTS discount_code_usage (
  id TEXT PRIMARY KEY,
  code_id TEXT REFERENCES discount_codes(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT NOW(),
  commission_saved NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_discount_usage_user ON discount_code_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_code ON discount_code_usage(code_id);

-- Table pour les messages défilants (bannières)
CREATE TABLE IF NOT EXISTS announcement_banners (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  background_color TEXT DEFAULT '#FF6B35',
  text_color TEXT DEFAULT '#FFFFFF',
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  valid_from TIMESTAMP,
  valid_until TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_banners_active ON announcement_banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_priority ON announcement_banners(priority DESC);

-- Table pour le mode "Premium pour tous" temporaire
CREATE TABLE IF NOT EXISTS global_premium_mode (
  id TEXT PRIMARY KEY,
  is_active BOOLEAN DEFAULT false,
  event_name TEXT,
  event_description TEXT,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_premium_active ON global_premium_mode(is_active);

-- Ajouter la colonne discount_code à la table products
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_code TEXT REFERENCES discount_codes(code);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_code_applied BOOLEAN DEFAULT false;

-- Ajouter la colonne discount_code à la table orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_saved NUMERIC DEFAULT 0;

-- Mettre à jour commission_amount dans products de 10% à 15%
UPDATE products 
SET commission_amount = price * 0.15 
WHERE commission_amount = price * 0.10;

-- Fonction pour vérifier si un code de réduction est valide
CREATE OR REPLACE FUNCTION is_discount_code_valid(p_code TEXT, p_user_id TEXT)
RETURNS TABLE(
  is_valid BOOLEAN,
  discount_rate NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_code discount_codes%ROWTYPE;
  v_usage_count INTEGER;
BEGIN
  -- Récupérer le code
  SELECT * INTO v_code FROM discount_codes WHERE code = p_code;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'Code invalide';
    RETURN;
  END IF;
  
  IF NOT v_code.is_active THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'Code inactif';
    RETURN;
  END IF;
  
  IF v_code.valid_from IS NOT NULL AND NOW() < v_code.valid_from THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'Code pas encore valide';
    RETURN;
  END IF;
  
  IF v_code.valid_until IS NOT NULL AND NOW() > v_code.valid_until THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'Code expiré';
    RETURN;
  END IF;
  
  IF v_code.usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_usage_count 
    FROM discount_code_usage 
    WHERE code_id = v_code.id;
    
    IF v_usage_count >= v_code.usage_limit THEN
      RETURN QUERY SELECT false, 0::NUMERIC, 'Limite d''utilisation atteinte';
      RETURN;
    END IF;
  END IF;
  
  RETURN QUERY SELECT true, v_code.discount_rate, 'Code valide'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier si le mode premium global est actif
CREATE OR REPLACE FUNCTION is_global_premium_active()
RETURNS BOOLEAN AS $$
DECLARE
  v_active BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM global_premium_mode 
    WHERE is_active = true 
    AND NOW() BETWEEN starts_at AND ends_at
  ) INTO v_active;
  
  RETURN v_active;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les bannières actives
CREATE OR REPLACE FUNCTION get_active_banners()
RETURNS TABLE(
  id TEXT,
  message TEXT,
  background_color TEXT,
  text_color TEXT,
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.message,
    b.background_color,
    b.text_color,
    b.priority
  FROM announcement_banners b
  WHERE b.is_active = true
  AND (b.valid_from IS NULL OR NOW() >= b.valid_from)
  AND (b.valid_until IS NULL OR NOW() <= b.valid_until)
  ORDER BY b.priority DESC, b.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Accorder les permissions RLS
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_premium_mode ENABLE ROW LEVEL SECURITY;

-- Politique pour discount_codes: tout le monde peut lire les codes actifs
CREATE POLICY "Anyone can view active discount codes" ON discount_codes
  FOR SELECT USING (is_active = true);

-- Politique pour discount_codes: seuls les superadmins peuvent gérer
CREATE POLICY "SuperAdmins can manage discount codes" ON discount_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Politique pour discount_code_usage: les utilisateurs voient leur utilisation
CREATE POLICY "Users can view their discount usage" ON discount_code_usage
  FOR SELECT USING (user_id = auth.uid());

-- Politique pour discount_code_usage: système peut insérer
CREATE POLICY "System can insert discount usage" ON discount_code_usage
  FOR INSERT WITH CHECK (true);

-- Politique pour announcement_banners: tout le monde peut lire les bannières actives
CREATE POLICY "Anyone can view active banners" ON announcement_banners
  FOR SELECT USING (
    is_active = true
    AND (valid_from IS NULL OR NOW() >= valid_from)
    AND (valid_until IS NULL OR NOW() <= valid_until)
  );

-- Politique pour announcement_banners: seuls les superadmins peuvent gérer
CREATE POLICY "SuperAdmins can manage banners" ON announcement_banners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Politique pour global_premium_mode: tout le monde peut lire
CREATE POLICY "Anyone can view global premium mode" ON global_premium_mode
  FOR SELECT USING (true);

-- Politique pour global_premium_mode: seuls les superadmins peuvent gérer
CREATE POLICY "SuperAdmins can manage global premium mode" ON global_premium_mode
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
  );
