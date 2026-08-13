-- Correction complète des paramètres globaux et partenaires

-- 1. S'assurer que global_settings existe avec les bonnes colonnes
CREATE TABLE IF NOT EXISTS global_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  commission_rate NUMERIC DEFAULT 15,
  discount_reduction NUMERIC DEFAULT 5,
  partner_commission_rate NUMERIC DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Insérer les paramètres par défaut s'ils n'existent pas
INSERT INTO global_settings (id, commission_rate, discount_reduction, partner_commission_rate)
VALUES ('default', 15, 5, 5)
ON CONFLICT (id) DO NOTHING;

-- 2. S'assurer que la colonne is_partner existe
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_is_partner ON users(is_partner);

-- 3. S'assurer que discount_code_usage existe avec les bonnes colonnes
CREATE TABLE IF NOT EXISTS discount_code_usage (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  commission_saved NUMERIC DEFAULT 0,
  partner_commission NUMERIC DEFAULT 0,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discount_code_usage_code_id ON discount_code_usage(code_id);
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_user_id ON discount_code_usage(user_id);

-- 4. S'assurer que discount_codes a la colonne partner_user_id
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS partner_user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_partner_user_id ON discount_codes(partner_user_id);

-- 5. Supprimer et recréer la fonction get_active_user_partners avec la bonne logique
DROP FUNCTION IF EXISTS get_active_user_partners();

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

-- 6. Fonction pour obtenir les bannières actives
DROP FUNCTION IF EXISTS get_active_banners();

CREATE OR REPLACE FUNCTION get_active_banners()
RETURNS TABLE (
  id TEXT,
  message TEXT,
  priority INTEGER,
  background_color TEXT,
  text_color TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.message,
    b.priority,
    b.background_color,
    b.text_color
  FROM announcement_banners b
  WHERE 
    b.is_active = TRUE
    AND (b.valid_from IS NULL OR b.valid_from <= NOW())
    AND (b.valid_until IS NULL OR b.valid_until >= NOW())
  ORDER BY b.priority DESC, b.created_at DESC;
END;
$$;

-- 7. Donner les permissions nécessaires
GRANT EXECUTE ON FUNCTION get_active_user_partners() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_banners() TO anon, authenticated;

-- 8. S'assurer que les RLS policies permettent de lire global_settings
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to global_settings" ON global_settings;
CREATE POLICY "Allow read access to global_settings" 
ON global_settings FOR SELECT 
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow update access to global_settings for admins" ON global_settings;
CREATE POLICY "Allow update access to global_settings for admins" 
ON global_settings FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid()::text 
    AND (is_super_admin = true OR is_admin = true)
  )
);

-- 9. Vérifier que announcement_banners existe
CREATE TABLE IF NOT EXISTS announcement_banners (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  background_color TEXT DEFAULT '#FF6B35',
  text_color TEXT DEFAULT '#FFFFFF',
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

ALTER TABLE announcement_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to announcement_banners" ON announcement_banners;
CREATE POLICY "Allow read access to announcement_banners" 
ON announcement_banners FOR SELECT 
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Allow insert/update/delete access to announcement_banners for admins" ON announcement_banners;
CREATE POLICY "Allow insert/update/delete access to announcement_banners for admins" 
ON announcement_banners FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid()::text 
    AND (is_super_admin = true OR is_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid()::text 
    AND (is_super_admin = true OR is_admin = true)
  )
);

-- 10. Vérifier que global_premium_mode existe
CREATE TABLE IF NOT EXISTS global_premium_mode (
  id TEXT PRIMARY KEY,
  is_active BOOLEAN DEFAULT TRUE,
  event_name TEXT,
  event_description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE global_premium_mode ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to global_premium_mode" ON global_premium_mode;
CREATE POLICY "Allow read access to global_premium_mode" 
ON global_premium_mode FOR SELECT 
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow insert/update access to global_premium_mode for admins" ON global_premium_mode;
CREATE POLICY "Allow insert/update access to global_premium_mode for admins" 
ON global_premium_mode FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid()::text 
    AND (is_super_admin = true OR is_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid()::text 
    AND (is_super_admin = true OR is_admin = true)
  )
);

-- 11. Vérifier les RLS sur discount_codes
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to discount_codes" ON discount_codes;
CREATE POLICY "Allow read access to discount_codes" 
ON discount_codes FOR SELECT 
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Allow insert/update/delete access to discount_codes for admins" ON discount_codes;
CREATE POLICY "Allow insert/update/delete access to discount_codes for admins" 
ON discount_codes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid()::text 
    AND (is_super_admin = true OR is_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid()::text 
    AND (is_super_admin = true OR is_admin = true)
  )
);

COMMENT ON TABLE global_settings IS 'Paramètres globaux de l''application (commission, réductions, etc.)';
COMMENT ON COLUMN users.is_partner IS 'Indique si l''utilisateur est un partenaire/influenceur';
