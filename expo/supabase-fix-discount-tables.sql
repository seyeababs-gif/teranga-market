-- ======================================================================
-- CORRECTION COMPLÈTE DES TABLES DE CODES DE RÉDUCTION
-- ======================================================================

-- 1. Supprimer les tables existantes si elles existent (ordre important)
DROP TABLE IF EXISTS discount_code_usage CASCADE;
DROP TABLE IF EXISTS discount_codes CASCADE;
DROP TABLE IF EXISTS announcement_banners CASCADE;
DROP TABLE IF EXISTS global_premium_mode CASCADE;

-- 2. Créer la table discount_codes
CREATE TABLE discount_codes (
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
  created_by TEXT REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour accélérer les recherches
CREATE INDEX idx_discount_codes_code ON discount_codes(code);
CREATE INDEX idx_discount_codes_active ON discount_codes(is_active);

-- 3. Créer la table discount_code_usage
CREATE TABLE discount_code_usage (
  id TEXT PRIMARY KEY,
  code_id TEXT REFERENCES discount_codes(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT NOW(),
  commission_saved NUMERIC
);

CREATE INDEX idx_discount_usage_user ON discount_code_usage(user_id);
CREATE INDEX idx_discount_usage_code ON discount_code_usage(code_id);

-- 4. Créer la table announcement_banners
CREATE TABLE announcement_banners (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  background_color TEXT DEFAULT '#FF6B35',
  text_color TEXT DEFAULT '#FFFFFF',
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT REFERENCES users(id) ON DELETE CASCADE,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP
);

CREATE INDEX idx_banners_active ON announcement_banners(is_active);
CREATE INDEX idx_banners_priority ON announcement_banners(priority DESC);

-- 5. Créer la table global_premium_mode
CREATE TABLE global_premium_mode (
  id TEXT PRIMARY KEY,
  is_active BOOLEAN DEFAULT false,
  event_name TEXT,
  event_description TEXT,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_global_premium_active ON global_premium_mode(is_active);

-- 6. Ajouter les colonnes aux tables products et orders si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='products' AND column_name='discount_code') THEN
    ALTER TABLE products ADD COLUMN discount_code TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='products' AND column_name='discount_code_applied') THEN
    ALTER TABLE products ADD COLUMN discount_code_applied BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='orders' AND column_name='discount_code') THEN
    ALTER TABLE orders ADD COLUMN discount_code TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='orders' AND column_name='commission_saved') THEN
    ALTER TABLE orders ADD COLUMN commission_saved NUMERIC DEFAULT 0;
  END IF;
END
$$;

-- 7. Créer ou remplacer la fonction pour vérifier la validité d'un code
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

-- 8. Créer ou remplacer la fonction pour vérifier le mode premium global
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

-- 9. Créer ou remplacer la fonction pour obtenir les bannières actives
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

-- 10. Activer RLS sur toutes les tables
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_premium_mode ENABLE ROW LEVEL SECURITY;

-- 11. Supprimer les politiques existantes si elles existent
DROP POLICY IF EXISTS "Anyone can view active discount codes" ON discount_codes;
DROP POLICY IF EXISTS "SuperAdmins can manage discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Users can view their discount usage" ON discount_code_usage;
DROP POLICY IF EXISTS "System can insert discount usage" ON discount_code_usage;
DROP POLICY IF EXISTS "Anyone can view active banners" ON announcement_banners;
DROP POLICY IF EXISTS "SuperAdmins can manage banners" ON announcement_banners;
DROP POLICY IF EXISTS "Anyone can view global premium mode" ON global_premium_mode;
DROP POLICY IF EXISTS "SuperAdmins can manage global premium mode" ON global_premium_mode;

-- 12. Créer les politiques RLS

-- Politiques pour discount_codes
CREATE POLICY "Anyone can view active discount codes" ON discount_codes
  FOR SELECT USING (is_active = true);

CREATE POLICY "SuperAdmins can manage discount codes" ON discount_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND is_super_admin = true)
  );

-- Politiques pour discount_code_usage
CREATE POLICY "Users can view their discount usage" ON discount_code_usage
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "System can insert discount usage" ON discount_code_usage
  FOR INSERT WITH CHECK (true);

-- Politiques pour announcement_banners
CREATE POLICY "Anyone can view active banners" ON announcement_banners
  FOR SELECT USING (
    is_active = true
    AND (valid_from IS NULL OR NOW() >= valid_from)
    AND (valid_until IS NULL OR NOW() <= valid_until)
  );

CREATE POLICY "SuperAdmins can manage banners" ON announcement_banners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND is_super_admin = true)
  );

-- Politiques pour global_premium_mode
CREATE POLICY "Anyone can view global premium mode" ON global_premium_mode
  FOR SELECT USING (true);

CREATE POLICY "SuperAdmins can manage global premium mode" ON global_premium_mode
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND is_super_admin = true)
  );

-- 13. Message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Tables de codes de réduction créées avec succès!';
  RAISE NOTICE 'Tables créées: discount_codes, discount_code_usage, announcement_banners, global_premium_mode';
  RAISE NOTICE 'Fonctions créées: is_discount_code_valid, is_global_premium_active, get_active_banners';
END
$$;
