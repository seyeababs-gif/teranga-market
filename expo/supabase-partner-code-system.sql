-- ============================================
-- SYSTÈME DE CODES PARTENAIRES COMPLET
-- ============================================

-- 1. S'assurer que la colonne partner_code existe dans les utilisateurs
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS partner_code VARCHAR(50) UNIQUE;

-- 2. Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_partner_code ON users(partner_code) WHERE partner_code IS NOT NULL;

-- 3. Fonction pour générer un code unique
CREATE OR REPLACE FUNCTION generate_partner_code()
RETURNS VARCHAR(20) AS $$
DECLARE
  new_code VARCHAR(20);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Génère un code de 8 caractères alphanumériques
    new_code := 'PART' || UPPER(substring(md5(random()::text) from 1 for 8));
    
    -- Vérifie si le code existe déjà
    SELECT EXISTS(SELECT 1 FROM users WHERE partner_code = new_code) INTO code_exists;
    
    -- Sort de la boucle si le code est unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger pour auto-générer un code lors de la promotion en partenaire
CREATE OR REPLACE FUNCTION set_partner_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Si l'utilisateur devient partenaire et n'a pas encore de code
  IF NEW.is_partner = true AND (OLD.is_partner = false OR OLD.is_partner IS NULL) AND NEW.partner_code IS NULL THEN
    NEW.partner_code := generate_partner_code();
  END IF;
  
  -- Si l'utilisateur n'est plus partenaire, on garde le code (pour historique)
  -- mais il ne sera plus actif
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_partner_code ON users;
CREATE TRIGGER trigger_set_partner_code
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_partner_code();

-- 5. Générer des codes pour les partenaires existants qui n'en ont pas
UPDATE users 
SET partner_code = generate_partner_code()
WHERE is_partner = true AND partner_code IS NULL;

-- 6. Fonction pour valider un code partenaire lors de la publication
CREATE OR REPLACE FUNCTION validate_partner_code(code VARCHAR(50))
RETURNS TABLE(
  is_valid BOOLEAN,
  partner_id TEXT,
  partner_name TEXT,
  discount_percent NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as is_valid,
    u.id::TEXT as partner_id,
    u.name as partner_name,
    gs.discount_reduction as discount_percent
  FROM users u
  CROSS JOIN global_settings gs
  WHERE u.partner_code = code 
    AND u.is_partner = true
  LIMIT 1;
  
  -- Si aucun résultat, retourner false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, 0::NUMERIC;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Mettre à jour la table products pour tracker le partenaire
ALTER TABLE products
ADD COLUMN IF NOT EXISTS partner_id TEXT REFERENCES users(id),
ADD COLUMN IF NOT EXISTS partner_code_used VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_products_partner_id ON products(partner_id) WHERE partner_id IS NOT NULL;

-- 8. Fonction améliorée pour obtenir les stats d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id TEXT)
RETURNS TABLE(
  total_sales BIGINT,
  total_commission NUMERIC,
  total_referrals BIGINT,
  active_discount_codes BIGINT,
  total_users_with_code BIGINT,
  pending_commission NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Nombre total de ventes générées via le code partenaire
    COUNT(DISTINCT p.id)::BIGINT as total_sales,
    
    -- Commission totale gagnée (seulement sur produits payés)
    COALESCE(SUM(
      CASE 
        WHEN p.status IN ('approved', 'pending') 
          AND p.payment_confirmed_at IS NOT NULL
        THEN p.commission_amount * (gs.partner_commission_rate / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as total_commission,
    
    -- Nombre d'utilisateurs référés (qui ont utilisé le code)
    COUNT(DISTINCT p.seller_id)::BIGINT as total_referrals,
    
    -- Nombre de codes actifs (pour ce partenaire)
    (SELECT COUNT(*)::BIGINT FROM discount_codes 
     WHERE partner_user_id = $1 AND is_active = true) as active_discount_codes,
    
    -- Nombre total d'utilisateurs ayant utilisé le code
    COUNT(DISTINCT CASE WHEN p.partner_code_used IS NOT NULL THEN p.seller_id END)::BIGINT as total_users_with_code,
    
    -- Commission en attente (produits approuvés mais paiement non confirmé)
    COALESCE(SUM(
      CASE 
        WHEN p.status IN ('approved', 'pending') 
          AND p.payment_confirmed_at IS NULL
        THEN p.commission_amount * (gs.partner_commission_rate / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as pending_commission
  FROM products p
  CROSS JOIN global_settings gs
  WHERE p.partner_id = partner_user_id;
END;
$$ LANGUAGE plpgsql;

-- 9. Fonction pour obtenir les produits utilisant le code d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_products(partner_user_id TEXT)
RETURNS TABLE(
  id TEXT,
  title TEXT,
  price NUMERIC,
  commission_amount NUMERIC,
  partner_commission NUMERIC,
  seller_id TEXT,
  seller_name TEXT,
  seller_phone TEXT,
  seller_avatar TEXT,
  status product_status,
  created_at TIMESTAMPTZ,
  payment_confirmed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.price,
    p.commission_amount,
    (p.commission_amount * gs.partner_commission_rate / 100.0)::NUMERIC as partner_commission,
    p.seller_id,
    p.seller_name,
    p.seller_phone,
    p.seller_avatar,
    p.status,
    p.created_at,
    p.payment_confirmed_at
  FROM products p
  CROSS JOIN global_settings gs
  WHERE p.partner_id = partner_user_id
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 10. Fonction pour lister tous les codes partenaires d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_partner_codes(user_id TEXT)
RETURNS TABLE(
  code_type TEXT,
  code_value VARCHAR(50),
  description TEXT,
  discount_percent NUMERIC,
  times_used BIGINT,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  -- Code personnel du partenaire
  SELECT 
    'personal'::TEXT as code_type,
    u.partner_code as code_value,
    'Code de parrainage personnel'::TEXT as description,
    gs.discount_reduction as discount_percent,
    (SELECT COUNT(*)::BIGINT FROM products WHERE partner_code_used = u.partner_code) as times_used,
    u.is_partner as is_active
  FROM users u
  CROSS JOIN global_settings gs
  WHERE u.id = user_id AND u.partner_code IS NOT NULL
  
  UNION ALL
  
  -- Codes promo créés pour ce partenaire
  SELECT 
    'promo'::TEXT as code_type,
    dc.code as code_value,
    COALESCE(dc.description, 'Code promotionnel')::TEXT as description,
    dc.discount_percent as discount_percent,
    dc.times_used::BIGINT as times_used,
    dc.is_active as is_active
  FROM discount_codes dc
  WHERE dc.partner_user_id = user_id AND dc.is_active = true
  
  ORDER BY is_active DESC, times_used DESC;
END;
$$ LANGUAGE plpgsql;

-- 11. Fonction pour le super admin : mettre à jour le code d'un partenaire
CREATE OR REPLACE FUNCTION update_partner_code(
  partner_id TEXT,
  new_code VARCHAR(50)
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  code_exists BOOLEAN;
BEGIN
  -- Vérifier si le code existe déjà
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE partner_code = new_code AND id != partner_id
  ) INTO code_exists;
  
  IF code_exists THEN
    RETURN QUERY SELECT false, 'Ce code est déjà utilisé par un autre partenaire'::TEXT;
    RETURN;
  END IF;
  
  -- Mettre à jour le code
  UPDATE users 
  SET partner_code = UPPER(new_code)
  WHERE id = partner_id AND is_partner = true;
  
  IF FOUND THEN
    RETURN QUERY SELECT true, 'Code mis à jour avec succès'::TEXT;
  ELSE
    RETURN QUERY SELECT false, 'Partenaire non trouvé ou utilisateur non partenaire'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 12. Vue pour le dashboard admin : vue d'ensemble des partenaires
CREATE OR REPLACE VIEW partner_dashboard_summary AS
SELECT 
  u.id,
  u.name,
  u.phone,
  u.email,
  u.avatar,
  u.partner_code,
  u.is_partner,
  COUNT(DISTINCT p.id) as total_products,
  COUNT(DISTINCT p.seller_id) as unique_sellers,
  COALESCE(SUM(p.commission_amount * gs.partner_commission_rate / 100.0), 0) as total_commission,
  COUNT(DISTINCT CASE WHEN p.payment_confirmed_at IS NOT NULL THEN p.id END) as paid_products,
  COUNT(DISTINCT CASE WHEN p.payment_confirmed_at IS NULL THEN p.id END) as pending_products
FROM users u
CROSS JOIN global_settings gs
LEFT JOIN products p ON p.partner_id = u.id
WHERE u.is_partner = true
GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.partner_code, u.is_partner, gs.partner_commission_rate;

-- 13. Fonction de notification lors de l'utilisation d'un code partenaire
CREATE OR REPLACE FUNCTION notify_partner_code_used()
RETURNS TRIGGER AS $$
BEGIN
  -- Si un code partenaire a été utilisé
  IF NEW.partner_id IS NOT NULL AND NEW.partner_code_used IS NOT NULL THEN
    INSERT INTO notifications (
      id,
      user_id,
      type,
      title,
      message,
      data,
      is_read,
      created_at
    )
    VALUES (
      'notif-' || gen_random_uuid()::TEXT,
      NEW.partner_id,
      'partner_code_used',
      'Code partenaire utilisé ! 🎉',
      'Votre code ' || NEW.partner_code_used || ' a été utilisé par ' || NEW.seller_name || ' pour publier une annonce.',
      jsonb_build_object(
        'product_id', NEW.id,
        'product_title', NEW.title,
        'seller_id', NEW.seller_id,
        'seller_name', NEW.seller_name,
        'commission_potential', (NEW.commission_amount * (SELECT partner_commission_rate FROM global_settings LIMIT 1) / 100.0)
      ),
      false,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_partner_code_used ON products;
CREATE TRIGGER trigger_notify_partner_code_used
AFTER INSERT ON products
FOR EACH ROW
WHEN (NEW.partner_id IS NOT NULL)
EXECUTE FUNCTION notify_partner_code_used();

-- 14. Vérifier la configuration
DO $$
BEGIN
  RAISE NOTICE '✅ Système de codes partenaires configuré avec succès';
  RAISE NOTICE 'Partenaires actifs: %', (SELECT COUNT(*) FROM users WHERE is_partner = true);
  RAISE NOTICE 'Codes générés: %', (SELECT COUNT(*) FROM users WHERE partner_code IS NOT NULL);
END $$;
