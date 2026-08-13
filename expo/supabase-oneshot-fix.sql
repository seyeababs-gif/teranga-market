-- ============================================
-- ONE SHOT FIX - Solution complète
-- ============================================
-- Ce script corrige tous les problèmes en une seule exécution

-- STEP 1: DROP toutes les fonctions problématiques
DROP FUNCTION IF EXISTS get_active_user_partners() CASCADE;
DROP FUNCTION IF EXISTS get_partner_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_stats(TEXT) CASCADE;
DROP FUNCTION IF EXISTS generate_partner_code(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS generate_partner_code(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS apply_partner_referral(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS apply_partner_referral(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS auto_generate_partner_code() CASCADE;
DROP FUNCTION IF EXISTS notify_partner_on_code_usage() CASCADE;
DROP VIEW IF EXISTS partner_statistics CASCADE;

-- STEP 2: DROP triggers
DROP TRIGGER IF EXISTS trigger_auto_generate_partner_code ON users;
DROP TRIGGER IF EXISTS trigger_notify_partner_on_code_usage ON products;

-- STEP 3: DROP contraintes problématiques
ALTER TABLE IF EXISTS discount_codes DROP CONSTRAINT IF EXISTS fk_discount_codes_partner CASCADE;
ALTER TABLE IF EXISTS discount_codes DROP CONSTRAINT IF EXISTS discount_codes_partner_user_id_fkey CASCADE;
ALTER TABLE IF EXISTS discount_codes DROP CONSTRAINT IF EXISTS fk_discount_codes_partner_text CASCADE;
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_referred_by_partner_id_fkey CASCADE;
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS fk_users_referred_by_partner_text CASCADE;
ALTER TABLE IF EXISTS partner_commissions DROP CONSTRAINT IF EXISTS partner_commissions_partner_user_id_fkey CASCADE;
ALTER TABLE IF EXISTS partner_commissions DROP CONSTRAINT IF EXISTS fk_partner_commissions_partner CASCADE;
ALTER TABLE IF EXISTS partner_commissions DROP CONSTRAINT IF EXISTS fk_partner_commissions_order CASCADE;

-- STEP 4: S'assurer que users.id est TEXT (par défaut avec Supabase)
-- On va utiliser TEXT partout pour la cohérence

-- STEP 5: Mettre à jour les colonnes partenaires dans discount_codes
DO $$ 
BEGIN
  -- Supprimer colonne si elle existe en UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_user_id'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE discount_codes DROP COLUMN partner_user_id CASCADE;
  END IF;
  
  -- Créer ou recréer comme TEXT
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_user_id'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN partner_user_id TEXT;
  ELSE
    ALTER TABLE discount_codes 
      ALTER COLUMN partner_user_id TYPE TEXT USING partner_user_id::TEXT;
  END IF;
END $$;

-- STEP 6: Mettre à jour les colonnes partenaires dans users
DO $$ 
BEGIN
  -- referred_by_partner_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'referred_by_partner_id'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE users DROP COLUMN referred_by_partner_id CASCADE;
    ALTER TABLE users ADD COLUMN referred_by_partner_id TEXT;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'referred_by_partner_id'
  ) THEN
    ALTER TABLE users ADD COLUMN referred_by_partner_id TEXT;
  ELSE
    ALTER TABLE users 
      ALTER COLUMN referred_by_partner_id TYPE TEXT USING referred_by_partner_id::TEXT;
  END IF;
  
  -- partner_referral_code
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'partner_referral_code'
  ) THEN
    ALTER TABLE users ADD COLUMN partner_referral_code TEXT UNIQUE;
  END IF;
  
  -- is_partner
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'is_partner'
  ) THEN
    ALTER TABLE users ADD COLUMN is_partner BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- STEP 7: Recréer partner_commissions avec le bon type
DROP TABLE IF EXISTS partner_commissions CASCADE;
CREATE TABLE partner_commissions (
  id TEXT PRIMARY KEY,
  partner_user_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  UNIQUE(partner_user_id, order_id)
);

-- STEP 8: Recréer les contraintes de clés étrangères
ALTER TABLE discount_codes 
  ADD CONSTRAINT fk_discount_codes_partner 
  FOREIGN KEY (partner_user_id) 
  REFERENCES users(id) 
  ON DELETE SET NULL;

ALTER TABLE users 
  ADD CONSTRAINT fk_users_referred_by_partner 
  FOREIGN KEY (referred_by_partner_id) 
  REFERENCES users(id) 
  ON DELETE SET NULL;

ALTER TABLE partner_commissions 
  ADD CONSTRAINT fk_partner_commissions_partner 
  FOREIGN KEY (partner_user_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE;

ALTER TABLE partner_commissions 
  ADD CONSTRAINT fk_partner_commissions_order 
  FOREIGN KEY (order_id) 
  REFERENCES orders(id) 
  ON DELETE CASCADE;

-- STEP 9: Créer les index pour performance
CREATE INDEX IF NOT EXISTS idx_discount_codes_partner ON discount_codes(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_users_referred_by_partner ON users(referred_by_partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_order ON partner_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);

-- STEP 10: Fonction pour générer un code partenaire
CREATE OR REPLACE FUNCTION generate_partner_code(user_name TEXT, user_id TEXT)
RETURNS TEXT 
LANGUAGE plpgsql
AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INTEGER := 1;
BEGIN
  -- Créer code de base à partir des 3 premiers caractères du nom + 4 derniers caractères de l'ID
  base_code := UPPER(
    SUBSTRING(REGEXP_REPLACE(user_name, '[^a-zA-Z]', '', 'g'), 1, 3) || 
    SUBSTRING(REPLACE(user_id, '-', ''), LENGTH(REPLACE(user_id, '-', '')) - 3)
  );
  
  final_code := base_code;
  
  -- Assurer l'unicité
  WHILE EXISTS (SELECT 1 FROM users WHERE partner_referral_code = final_code) LOOP
    final_code := base_code || counter::TEXT;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_code;
END;
$$;

-- STEP 11: Fonction pour auto-générer le code partenaire
CREATE OR REPLACE FUNCTION auto_generate_partner_code()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_partner = TRUE AND NEW.partner_referral_code IS NULL THEN
    NEW.partner_referral_code := generate_partner_code(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- STEP 12: Trigger pour auto-générer le code
CREATE TRIGGER trigger_auto_generate_partner_code
  BEFORE INSERT OR UPDATE OF is_partner ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_partner_code();

-- STEP 13: Fonction pour obtenir les statistiques d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id TEXT)
RETURNS TABLE (
  total_sales BIGINT,
  total_commission NUMERIC,
  total_referrals BIGINT,
  active_discount_codes BIGINT,
  pending_commission NUMERIC,
  paid_commission NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT CASE WHEN o.status IN ('validated', 'shipped', 'completed') THEN o.id END)::BIGINT as total_sales,
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
  WHERE partner_user.id = get_partner_stats.partner_user_id;
END;
$$;

-- STEP 14: Fonction pour obtenir tous les partenaires actifs
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
  total_sales INTEGER,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
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
    u.partner_referral_code,
    COALESCE(SUM(pc.commission_amount), 0) as total_commission_earned,
    COUNT(DISTINCT pc.order_id)::INTEGER as total_sales,
    u.created_at
  FROM users u
  LEFT JOIN partner_commissions pc ON pc.partner_user_id = u.id AND pc.status IN ('pending', 'paid')
  WHERE u.is_partner = TRUE
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.partner_referral_code, u.created_at
  ORDER BY total_commission_earned DESC;
END;
$$;

-- STEP 15: Fonction pour appliquer le code de parrainage
CREATE OR REPLACE FUNCTION apply_partner_referral(
  new_user_id TEXT,
  referral_code TEXT
)
RETURNS JSON 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  partner_id TEXT;
BEGIN
  -- Trouver le partenaire par code de référence
  SELECT id INTO partner_id
  FROM users
  WHERE partner_referral_code = UPPER(referral_code)
    AND is_partner = TRUE
  LIMIT 1;
  
  IF partner_id IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Code partenaire invalide'
    );
  END IF;
  
  -- Mettre à jour l'utilisateur avec la référence du partenaire
  UPDATE users
  SET referred_by_partner_id = partner_id
  WHERE id = new_user_id;
  
  RETURN json_build_object(
    'success', TRUE,
    'partner_id', partner_id
  );
END;
$$;

-- STEP 16: Fonction pour notifier le partenaire quand son code est utilisé
CREATE OR REPLACE FUNCTION notify_partner_on_code_usage()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
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
$$;

-- STEP 17: Créer le trigger pour notifier le partenaire
CREATE TRIGGER trigger_notify_partner_on_code_usage
AFTER INSERT OR UPDATE OF discount_code_applied ON products
FOR EACH ROW
WHEN (NEW.discount_code_applied = true)
EXECUTE FUNCTION notify_partner_on_code_usage();

-- STEP 18: RLS pour partner_commissions
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view own commissions" ON partner_commissions;
DROP POLICY IF EXISTS "Admins can manage all commissions" ON partner_commissions;

CREATE POLICY "Partners can view own commissions"
ON partner_commissions FOR SELECT
USING (partner_user_id = auth.uid()::text);

CREATE POLICY "Admins can manage all commissions"
ON partner_commissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()::text
    AND (users.is_admin = true OR users.is_super_admin = true)
  )
);

-- STEP 19: Permissions sur les fonctions
GRANT EXECUTE ON FUNCTION generate_partner_code TO authenticated;
GRANT EXECUTE ON FUNCTION get_partner_stats TO authenticated;
GRANT EXECUTE ON FUNCTION apply_partner_referral TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_user_partners TO authenticated;

-- STEP 20: Mettre à jour les partenaires existants avec un code de référence
UPDATE users 
SET partner_referral_code = generate_partner_code(name, id)
WHERE is_partner = TRUE AND partner_referral_code IS NULL;

-- STEP 21: Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ ONE SHOT FIX - TERMINÉ AVEC SUCCÈS !';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ Toutes les fonctions recréées avec TEXT';
  RAISE NOTICE '✅ Toutes les contraintes recréées correctement';
  RAISE NOTICE '✅ Tables partenaires créées/mises à jour';
  RAISE NOTICE '✅ Triggers de notification créés';
  RAISE NOTICE '✅ RLS configuré';
  RAISE NOTICE '✅ Codes de référence générés';
  RAISE NOTICE '✅ Système prêt à l''emploi !';
  RAISE NOTICE '✅ ============================================';
END $$;
