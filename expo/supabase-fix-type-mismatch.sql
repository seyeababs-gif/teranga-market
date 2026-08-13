-- ============================================
-- FIX TYPE MISMATCH TEXT vs UUID
-- ============================================
-- Ce script corrige tous les problèmes de types entre TEXT et UUID

-- 1. D'abord, vérifier le type actuel de users.id
DO $$ 
DECLARE
  user_id_type TEXT;
BEGIN
  SELECT data_type INTO user_id_type
  FROM information_schema.columns
  WHERE table_name = 'users' AND column_name = 'id';
  
  RAISE NOTICE 'Type de users.id: %', user_id_type;
END $$;

-- 2. Supprimer les contraintes problématiques avant de changer les types
ALTER TABLE IF EXISTS discount_codes DROP CONSTRAINT IF EXISTS fk_discount_codes_partner;
ALTER TABLE IF EXISTS discount_codes DROP CONSTRAINT IF EXISTS discount_codes_partner_user_id_fkey;
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_referred_by_partner_id_fkey;
ALTER TABLE IF EXISTS partner_commissions DROP CONSTRAINT IF EXISTS partner_commissions_partner_user_id_fkey;

-- 3. Modifier partner_user_id dans discount_codes pour qu'il soit TEXT (pas UUID)
DO $$ 
BEGIN
  -- Si la colonne existe et est de type UUID, la convertir en TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_user_id'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE discount_codes 
      ALTER COLUMN partner_user_id TYPE TEXT USING partner_user_id::TEXT;
    RAISE NOTICE '✓ discount_codes.partner_user_id converti de UUID vers TEXT';
  END IF;
  
  -- Si la colonne n'existe pas, la créer comme TEXT
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_user_id'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN partner_user_id TEXT;
    RAISE NOTICE '✓ discount_codes.partner_user_id créé comme TEXT';
  END IF;
END $$;

-- 4. Modifier referred_by_partner_id dans users pour qu'il soit TEXT (pas UUID)
DO $$ 
BEGIN
  -- Si la colonne existe et est de type UUID, la convertir en TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'referred_by_partner_id'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE users 
      ALTER COLUMN referred_by_partner_id TYPE TEXT USING referred_by_partner_id::TEXT;
    RAISE NOTICE '✓ users.referred_by_partner_id converti de UUID vers TEXT';
  END IF;
  
  -- Si la colonne n'existe pas, la créer comme TEXT
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'referred_by_partner_id'
  ) THEN
    ALTER TABLE users ADD COLUMN referred_by_partner_id TEXT;
    RAISE NOTICE '✓ users.referred_by_partner_id créé comme TEXT';
  END IF;
END $$;

-- 5. Recréer les contraintes de clés étrangères avec le bon type (TEXT)
DO $$ 
BEGIN
  -- Contrainte pour discount_codes.partner_user_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_discount_codes_partner_text'
  ) THEN
    ALTER TABLE discount_codes 
      ADD CONSTRAINT fk_discount_codes_partner_text 
      FOREIGN KEY (partner_user_id) 
      REFERENCES users(id) 
      ON DELETE SET NULL;
    RAISE NOTICE '✓ Contrainte fk_discount_codes_partner_text créée';
  END IF;
  
  -- Contrainte pour users.referred_by_partner_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_users_referred_by_partner_text'
  ) THEN
    ALTER TABLE users 
      ADD CONSTRAINT fk_users_referred_by_partner_text 
      FOREIGN KEY (referred_by_partner_id) 
      REFERENCES users(id) 
      ON DELETE SET NULL;
    RAISE NOTICE '✓ Contrainte fk_users_referred_by_partner_text créée';
  END IF;
END $$;

-- 6. Recréer la fonction get_partner_stats avec le bon type TEXT
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

-- 7. Recréer la fonction get_active_user_partners avec le bon type TEXT
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

-- 8. Recréer la fonction generate_partner_code avec le bon type TEXT
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

-- 9. Recréer la fonction apply_partner_referral avec le bon type TEXT
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

-- 10. Créer ou remplacer partner_commissions avec le bon type TEXT
CREATE TABLE IF NOT EXISTS partner_commissions (
  id TEXT PRIMARY KEY,
  partner_user_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  UNIQUE(partner_user_id, order_id),
  CONSTRAINT fk_partner_commissions_partner 
    FOREIGN KEY (partner_user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_partner_commissions_order 
    FOREIGN KEY (order_id) 
    REFERENCES orders(id) 
    ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_order ON partner_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);

-- 11. RLS pour partner_commissions
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

-- 12. Mettre à jour ou créer la fonction notify_partner_on_code_usage
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

-- 13. Créer le trigger pour notifier le partenaire
DROP TRIGGER IF EXISTS trigger_notify_partner_on_code_usage ON products;
CREATE TRIGGER trigger_notify_partner_on_code_usage
AFTER INSERT OR UPDATE OF discount_code_applied ON products
FOR EACH ROW
WHEN (NEW.discount_code_applied = true)
EXECUTE FUNCTION notify_partner_on_code_usage();

-- 14. Mettre à jour les partenaires existants avec un code de référence
UPDATE users 
SET partner_referral_code = generate_partner_code(name, id)
WHERE is_partner = TRUE AND partner_referral_code IS NULL;

-- 15. Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Correction des types TEXT vs UUID terminée !';
  RAISE NOTICE '✅ Toutes les colonnes partenaires utilisent maintenant TEXT';
  RAISE NOTICE '✅ Contraintes de clés étrangères recréées correctement';
  RAISE NOTICE '✅ Fonctions SQL mises à jour avec les bons types';
  RAISE NOTICE '✅ Triggers de notification créés';
  RAISE NOTICE '✅ Codes de référence générés pour les partenaires existants';
END $$;
