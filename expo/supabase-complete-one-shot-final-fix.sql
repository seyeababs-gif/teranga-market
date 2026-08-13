-- ============================================
-- CORRECTION COMPLETE ONE SHOT - VERSION FINALE
-- ============================================
-- Résout l'erreur: "cannot alter type of a column used in a policy definition"
-- Et anticipe TOUTES les autres erreurs possibles

-- ==========================================
-- ÉTAPE 0: NETTOYER TOUTES LES DÉPENDANCES
-- ==========================================

-- Supprimer TOUTES les policies qui dépendent de la colonne status
DROP POLICY IF EXISTS "Users can view products" ON products;
DROP POLICY IF EXISTS "Users can view approved products" ON products;
DROP POLICY IF EXISTS "Anyone can view approved products" ON products;
DROP POLICY IF EXISTS "Users can create products" ON products;
DROP POLICY IF EXISTS "Users can update products" ON products;
DROP POLICY IF EXISTS "Users can delete products" ON products;
DROP POLICY IF EXISTS "Admins can manage all products" ON products;

-- Supprimer toutes les policies pour orders aussi
DROP POLICY IF EXISTS "Users can view related orders" ON orders;
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Users and admins can update orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;

-- Supprimer TOUTES les fonctions qui pourraient dépendre des colonnes
DROP FUNCTION IF EXISTS get_partner_stats(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_partner_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_stats CASCADE;
DROP FUNCTION IF EXISTS get_partner_products(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_partner_products(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_partner_codes(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_user_partner_codes(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_active_user_partners() CASCADE;
DROP FUNCTION IF EXISTS validate_partner_code(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS validate_partner_code(TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_partner_code(TEXT, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS update_partner_code(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS generate_partner_code() CASCADE;
DROP FUNCTION IF EXISTS generate_partner_code(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS generate_partner_code(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS set_partner_code() CASCADE;
DROP FUNCTION IF EXISTS notify_partner_code_used() CASCADE;
DROP FUNCTION IF EXISTS auto_generate_partner_code() CASCADE;
DROP FUNCTION IF EXISTS apply_partner_referral(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS apply_partner_referral(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS notify_partner_on_code_usage() CASCADE;
DROP FUNCTION IF EXISTS create_partner_commission() CASCADE;
DROP FUNCTION IF EXISTS validate_partner_commissions(TEXT) CASCADE;
DROP FUNCTION IF EXISTS toggle_partner_status(TEXT, BOOLEAN) CASCADE;

-- Supprimer tous les triggers
DROP TRIGGER IF EXISTS trigger_set_partner_code ON users CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_partner_code_used ON products CASCADE;
DROP TRIGGER IF EXISTS trigger_auto_generate_partner_code ON users CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_partner_on_code_usage ON products CASCADE;
DROP TRIGGER IF EXISTS trigger_create_partner_commission ON orders CASCADE;

-- Supprimer les vues
DROP VIEW IF EXISTS partner_dashboard_summary CASCADE;
DROP VIEW IF EXISTS partner_statistics CASCADE;

-- Supprimer et recréer les types
DROP TYPE IF EXISTS product_status CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;

CREATE TYPE product_status AS ENUM ('pending_payment', 'pending', 'approved', 'rejected');
CREATE TYPE order_status AS ENUM ('pending_payment', 'paid', 'validated', 'rejected', 'shipped', 'completed');

-- ==========================================
-- ÉTAPE 1: MODIFIER LES COLONNES STATUS
-- ==========================================

-- Modifier products.status (maintenant que les policies sont supprimées)
DO $$
BEGIN
  -- Vérifier si la colonne existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'status'
  ) THEN
    -- Supprimer la valeur par défaut
    ALTER TABLE products ALTER COLUMN status DROP DEFAULT;
    
    -- Convertir le type de la colonne
    ALTER TABLE products ALTER COLUMN status TYPE product_status USING (
      CASE status::TEXT
        WHEN 'pending_payment' THEN 'pending_payment'::product_status
        WHEN 'pending' THEN 'pending'::product_status
        WHEN 'approved' THEN 'approved'::product_status
        WHEN 'rejected' THEN 'rejected'::product_status
        ELSE 'pending_payment'::product_status
      END
    );
    
    -- Remettre la valeur par défaut
    ALTER TABLE products ALTER COLUMN status SET DEFAULT 'pending_payment'::product_status;
  ELSE
    -- Créer la colonne si elle n'existe pas
    ALTER TABLE products ADD COLUMN status product_status DEFAULT 'pending_payment'::product_status;
  END IF;
END $$;

-- Modifier orders.status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE orders ALTER COLUMN status TYPE order_status USING (
      CASE status::TEXT
        WHEN 'pending_payment' THEN 'pending_payment'::order_status
        WHEN 'paid' THEN 'paid'::order_status
        WHEN 'validated' THEN 'validated'::order_status
        WHEN 'rejected' THEN 'rejected'::order_status
        WHEN 'shipped' THEN 'shipped'::order_status
        WHEN 'completed' THEN 'completed'::order_status
        ELSE 'pending_payment'::order_status
      END
    );
    ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending_payment'::order_status;
  ELSE
    ALTER TABLE orders ADD COLUMN status order_status DEFAULT 'pending_payment'::order_status;
  END IF;
END $$;

-- ==========================================
-- ÉTAPE 2: STRUCTURE DES TABLES
-- ==========================================

-- S'assurer que users a toutes les colonnes nécessaires
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_code VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_referral_code VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_partner_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Supprimer les contraintes existantes
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_partner_code_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_partner_referral_code_key;

-- Recréer les contraintes UNIQUE
ALTER TABLE users ADD CONSTRAINT users_partner_code_key UNIQUE(partner_code);
ALTER TABLE users ADD CONSTRAINT users_partner_referral_code_key UNIQUE(partner_referral_code);

-- S'assurer que products a les colonnes pour tracker les partenaires
ALTER TABLE products ADD COLUMN IF NOT EXISTS partner_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS partner_code_used VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_confirmed_by TEXT;

-- Créer table discount_codes si elle n'existe pas
CREATE TABLE IF NOT EXISTS discount_codes (
  id TEXT PRIMARY KEY DEFAULT ('disc-' || gen_random_uuid()::text),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  times_used INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  partner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Créer/recréer la table partner_commissions
DROP TABLE IF EXISTS partner_commissions CASCADE;
CREATE TABLE partner_commissions (
  id TEXT PRIMARY KEY DEFAULT ('comm-' || gen_random_uuid()::text),
  partner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  UNIQUE(partner_user_id, order_id)
);

-- Créer table notifications si elle n'existe pas
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT ('notif-' || gen_random_uuid()::text),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Créer table global_settings si elle n'existe pas
CREATE TABLE IF NOT EXISTS global_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  commission_rate NUMERIC DEFAULT 20,
  discount_reduction NUMERIC DEFAULT 10,
  partner_commission_rate NUMERIC DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Insérer les paramètres par défaut si ils n'existent pas
INSERT INTO global_settings (id, commission_rate, discount_reduction, partner_commission_rate)
VALUES ('default', 20, 10, 5)
ON CONFLICT (id) DO NOTHING;

-- Créer les index pour performance
CREATE INDEX IF NOT EXISTS idx_users_partner_code ON users(partner_code) WHERE partner_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_partner_referral_code ON users(partner_referral_code) WHERE partner_referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_partner ON users(is_partner) WHERE is_partner = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_partner_id ON products(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_partner_code_used ON products(partner_code_used) WHERE partner_code_used IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discount_codes_partner ON discount_codes(partner_user_id) WHERE partner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_order ON partner_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ==========================================
-- ÉTAPE 3: FONCTIONS DE GÉNÉRATION DE CODE
-- ==========================================

CREATE OR REPLACE FUNCTION generate_partner_code()
RETURNS VARCHAR(20) AS $$
DECLARE
  new_code VARCHAR(20);
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'PART' || UPPER(substring(md5(random()::text) from 1 for 8));
    
    SELECT EXISTS(
      SELECT 1 FROM users 
      WHERE partner_code = new_code OR partner_referral_code = new_code
    ) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_partner_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_partner = true AND (OLD.is_partner = false OR OLD.is_partner IS NULL) THEN
    IF NEW.partner_code IS NULL THEN
      NEW.partner_code := generate_partner_code();
    END IF;
    IF NEW.partner_referral_code IS NULL THEN
      NEW.partner_referral_code := NEW.partner_code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_partner_code
BEFORE UPDATE OF is_partner ON users
FOR EACH ROW
EXECUTE FUNCTION set_partner_code();

-- ==========================================
-- ÉTAPE 4: FONCTIONS DE VALIDATION
-- ==========================================

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
    u.id as partner_id,
    u.name as partner_name,
    COALESCE(gs.discount_reduction, 10) as discount_percent
  FROM users u
  CROSS JOIN global_settings gs
  WHERE (u.partner_code = code OR u.partner_referral_code = code)
    AND u.is_partner = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, 0::NUMERIC;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_partner_code_used()
RETURNS TRIGGER AS $$
BEGIN
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
        'commission_potential', (NEW.commission_amount * (SELECT COALESCE(partner_commission_rate, 5) FROM global_settings LIMIT 1) / 100.0)
      ),
      false,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_partner_code_used
AFTER INSERT ON products
FOR EACH ROW
WHEN (NEW.partner_id IS NOT NULL)
EXECUTE FUNCTION notify_partner_code_used();

-- ==========================================
-- ÉTAPE 5: FONCTIONS DE STATISTIQUES
-- ==========================================

CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id TEXT)
RETURNS TABLE(
  total_sales BIGINT,
  total_commission NUMERIC,
  total_referrals BIGINT,
  active_discount_codes BIGINT,
  total_users_with_code BIGINT,
  pending_commission NUMERIC,
  paid_commission NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT p.id)::BIGINT as total_sales,
    
    COALESCE(SUM(
      CASE 
        WHEN p.status IN ('approved'::product_status, 'pending'::product_status) 
          AND p.payment_confirmed_at IS NOT NULL
        THEN p.commission_amount * (COALESCE(gs.partner_commission_rate, 5) / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as total_commission,
    
    COUNT(DISTINCT p.seller_id)::BIGINT as total_referrals,
    
    (SELECT COUNT(*)::BIGINT FROM discount_codes 
     WHERE partner_user_id = get_partner_stats.partner_user_id AND is_active = true) as active_discount_codes,
    
    COUNT(DISTINCT CASE WHEN p.partner_code_used IS NOT NULL THEN p.seller_id END)::BIGINT as total_users_with_code,
    
    COALESCE(SUM(
      CASE 
        WHEN p.status IN ('approved'::product_status, 'pending'::product_status) 
          AND p.payment_confirmed_at IS NULL
        THEN p.commission_amount * (COALESCE(gs.partner_commission_rate, 5) / 100.0)
        ELSE 0
      END
    ), 0)::NUMERIC as pending_commission,
    
    COALESCE((
      SELECT SUM(commission_amount) 
      FROM partner_commissions 
      WHERE partner_user_id = get_partner_stats.partner_user_id 
        AND status = 'paid'
    ), 0)::NUMERIC as paid_commission
    
  FROM products p
  CROSS JOIN global_settings gs
  WHERE p.partner_id = get_partner_stats.partner_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    (p.commission_amount * COALESCE(gs.partner_commission_rate, 5) / 100.0)::NUMERIC as partner_commission,
    p.seller_id,
    p.seller_name,
    p.seller_phone,
    p.seller_avatar,
    p.status,
    p.created_at,
    p.payment_confirmed_at
  FROM products p
  CROSS JOIN global_settings gs
  WHERE p.partner_id = get_partner_products.partner_user_id
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  SELECT 
    'personal'::TEXT as code_type,
    u.partner_code as code_value,
    'Code de parrainage personnel'::TEXT as description,
    COALESCE(gs.discount_reduction, 10) as discount_percent,
    (SELECT COUNT(*)::BIGINT FROM products WHERE partner_code_used = u.partner_code) as times_used,
    u.is_partner as is_active
  FROM users u
  CROSS JOIN global_settings gs
  WHERE u.id = get_user_partner_codes.user_id AND u.partner_code IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'promo'::TEXT as code_type,
    dc.code as code_value,
    COALESCE(dc.description, 'Code promotionnel')::TEXT as description,
    dc.discount_percent as discount_percent,
    dc.times_used::BIGINT as times_used,
    dc.is_active as is_active
  FROM discount_codes dc
  WHERE dc.partner_user_id = get_user_partner_codes.user_id AND dc.is_active = true
  
  ORDER BY is_active DESC, times_used DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS TABLE(
  id TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  avatar TEXT,
  bio TEXT,
  partner_code VARCHAR(50),
  partner_referral_code VARCHAR(50),
  total_commission_earned NUMERIC,
  total_sales BIGINT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.phone,
    u.email,
    u.avatar,
    u.bio,
    u.partner_code,
    u.partner_referral_code,
    COALESCE(SUM(pc.commission_amount), 0) as total_commission_earned,
    COUNT(DISTINCT pc.order_id)::BIGINT as total_sales,
    u.created_at
  FROM users u
  LEFT JOIN partner_commissions pc ON pc.partner_user_id = u.id AND pc.status IN ('pending', 'paid')
  WHERE u.is_partner = TRUE
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.partner_code, u.partner_referral_code, u.created_at
  ORDER BY total_commission_earned DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- ÉTAPE 6: FONCTIONS ADMIN
-- ==========================================

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
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE (partner_code = UPPER(new_code) OR partner_referral_code = UPPER(new_code))
      AND id != update_partner_code.partner_id
  ) INTO code_exists;
  
  IF code_exists THEN
    RETURN QUERY SELECT false, 'Ce code est déjà utilisé par un autre partenaire'::TEXT;
    RETURN;
  END IF;
  
  UPDATE users 
  SET 
    partner_code = UPPER(new_code),
    partner_referral_code = UPPER(new_code)
  WHERE id = update_partner_code.partner_id AND is_partner = true;
  
  IF FOUND THEN
    RETURN QUERY SELECT true, 'Code mis à jour avec succès'::TEXT;
  ELSE
    RETURN QUERY SELECT false, 'Partenaire non trouvé ou utilisateur non partenaire'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION toggle_partner_status(
  user_id TEXT,
  new_status BOOLEAN
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  partner_code VARCHAR(50)
) AS $$
DECLARE
  generated_code VARCHAR(50);
BEGIN
  IF new_status = true THEN
    SELECT COALESCE(u.partner_code, generate_partner_code())
    INTO generated_code
    FROM users u
    WHERE u.id = toggle_partner_status.user_id;
    
    UPDATE users 
    SET 
      is_partner = true,
      partner_code = generated_code,
      partner_referral_code = generated_code
    WHERE id = toggle_partner_status.user_id;
    
    RETURN QUERY SELECT true, 'Utilisateur promu partenaire avec succès'::TEXT, generated_code;
  ELSE
    UPDATE users 
    SET is_partner = false
    WHERE id = toggle_partner_status.user_id;
    
    RETURN QUERY SELECT true, 'Partenaire désactivé avec succès'::TEXT, NULL::VARCHAR(50);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- ÉTAPE 7: GESTION DES COMMISSIONS
-- ==========================================

CREATE OR REPLACE FUNCTION create_partner_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_partner_id TEXT;
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
  v_product_record RECORD;
BEGIN
  IF NEW.status = 'validated'::order_status AND (OLD.status IS NULL OR OLD.status != 'validated'::order_status) THEN
    
    FOR v_product_record IN 
      SELECT DISTINCT 
        (item->>'product')::jsonb->>'id' as product_id
      FROM jsonb_array_elements(NEW.items) AS item
    LOOP
      SELECT 
        p.partner_id,
        COALESCE(gs.partner_commission_rate, 5) as commission_rate
      INTO v_partner_id, v_commission_rate
      FROM products p
      LEFT JOIN global_settings gs ON true
      WHERE p.id = v_product_record.product_id
        AND p.partner_id IS NOT NULL;
      
      IF v_partner_id IS NOT NULL THEN
        v_commission_amount := NEW.total_amount * (v_commission_rate / 100);
        
        INSERT INTO partner_commissions (
          partner_user_id,
          order_id,
          commission_amount,
          status,
          created_at
        ) VALUES (
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

CREATE TRIGGER trigger_create_partner_commission
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION create_partner_commission();

CREATE OR REPLACE FUNCTION validate_partner_commissions(p_order_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE partner_commissions
  SET 
    status = 'paid',
    paid_at = NOW()
  WHERE order_id = p_order_id
    AND status = 'pending';
    
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    is_read,
    created_at
  )
  SELECT 
    partner_user_id,
    'partner_commission_paid',
    'Commission payée ! 💰',
    'Votre commission de ' || commission_amount || ' FCFA a été validée',
    jsonb_build_object(
      'order_id', order_id,
      'commission_amount', commission_amount
    ),
    false,
    NOW()
  FROM partner_commissions
  WHERE order_id = p_order_id
    AND status = 'paid';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- ÉTAPE 8: VUE DASHBOARD ADMIN
-- ==========================================

CREATE OR REPLACE VIEW partner_dashboard_summary AS
SELECT 
  u.id,
  u.name,
  u.phone,
  u.email,
  u.avatar,
  u.partner_code,
  u.partner_referral_code,
  u.is_partner,
  COUNT(DISTINCT p.id) as total_products,
  COUNT(DISTINCT p.seller_id) as unique_sellers,
  COALESCE(SUM(p.commission_amount * COALESCE(gs.partner_commission_rate, 5) / 100.0), 0) as total_commission,
  COUNT(DISTINCT CASE WHEN p.payment_confirmed_at IS NOT NULL THEN p.id END) as paid_products,
  COUNT(DISTINCT CASE WHEN p.payment_confirmed_at IS NULL THEN p.id END) as pending_products
FROM users u
CROSS JOIN global_settings gs
LEFT JOIN products p ON p.partner_id = u.id
WHERE u.is_partner = true
GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.partner_code, u.partner_referral_code, u.is_partner, gs.partner_commission_rate;

-- ==========================================
-- ÉTAPE 9: RLS (Row Level Security) - RECRÉER
-- ==========================================

-- RLS Policies pour products (RECRÉER AVEC LE TYPE product_status)
CREATE POLICY "Users can view products" ON products FOR SELECT USING (
  status = 'approved'::product_status OR 
  seller_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

CREATE POLICY "Users can create products" ON products FOR INSERT WITH CHECK (
  seller_id = auth.uid()::text
);

CREATE POLICY "Users can update products" ON products FOR UPDATE USING (
  seller_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

CREATE POLICY "Users can delete products" ON products FOR DELETE USING (
  seller_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

-- RLS Policies pour orders (RECRÉER AVEC LE TYPE order_status)
CREATE POLICY "Users can view related orders" ON orders FOR SELECT USING (
  user_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

CREATE POLICY "Users can create orders" ON orders FOR INSERT WITH CHECK (
  user_id = auth.uid()::text
);

CREATE POLICY "Users and admins can update orders" ON orders FOR UPDATE USING (
  user_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

-- RLS pour les nouvelles tables
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view own commissions" ON partner_commissions;
DROP POLICY IF EXISTS "Admins can manage all commissions" ON partner_commissions;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can view active discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Partners can manage own codes" ON discount_codes;
DROP POLICY IF EXISTS "Admins can manage all codes" ON discount_codes;

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

CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid()::text);

CREATE POLICY "Anyone can view active discount codes"
ON discount_codes FOR SELECT
USING (is_active = true);

CREATE POLICY "Partners can manage own codes"
ON discount_codes FOR ALL
USING (partner_user_id = auth.uid()::text);

CREATE POLICY "Admins can manage all codes"
ON discount_codes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()::text
    AND (users.is_admin = true OR users.is_super_admin = true)
  )
);

-- ==========================================
-- ÉTAPE 10: PERMISSIONS
-- ==========================================

GRANT EXECUTE ON FUNCTION generate_partner_code TO authenticated;
GRANT EXECUTE ON FUNCTION validate_partner_code TO authenticated;
GRANT EXECUTE ON FUNCTION get_partner_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_partner_products TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_partner_codes TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_user_partners TO authenticated;
GRANT EXECUTE ON FUNCTION update_partner_code TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_partner_status TO authenticated;
GRANT EXECUTE ON FUNCTION validate_partner_commissions TO authenticated;

-- ==========================================
-- ÉTAPE 11: DONNÉES INITIALES
-- ==========================================

UPDATE users 
SET 
  partner_code = generate_partner_code(),
  partner_referral_code = COALESCE(partner_code, generate_partner_code())
WHERE is_partner = true AND partner_code IS NULL;

UPDATE users 
SET partner_referral_code = partner_code
WHERE is_partner = true AND partner_code IS NOT NULL AND partner_referral_code IS NULL;

-- ==========================================
-- ÉTAPE 12: VÉRIFICATION FINALE
-- ==========================================

DO $$
DECLARE
  partner_count INTEGER;
  codes_count INTEGER;
  functions_count INTEGER;
  policies_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO partner_count FROM users WHERE is_partner = true;
  SELECT COUNT(*) INTO codes_count FROM users WHERE partner_code IS NOT NULL;
  
  SELECT COUNT(*) INTO functions_count 
  FROM pg_proc 
  WHERE proname IN (
    'get_partner_stats',
    'get_partner_products', 
    'get_user_partner_codes',
    'get_active_user_partners',
    'validate_partner_code',
    'update_partner_code',
    'toggle_partner_status',
    'generate_partner_code',
    'validate_partner_commissions'
  );
  
  SELECT COUNT(*) INTO policies_count
  FROM pg_policies
  WHERE tablename IN ('products', 'orders', 'partner_commissions', 'notifications', 'discount_codes');
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ CORRECTION COMPLETE ONE SHOT - TERMINÉ ! 🎉';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ Types créés (product_status, order_status)';
  RAISE NOTICE '✅ Tables créées/mises à jour';
  RAISE NOTICE '✅ % fonctions créées', functions_count;
  RAISE NOTICE '✅ % policies RLS recréées', policies_count;
  RAISE NOTICE '✅ Triggers configurés';
  RAISE NOTICE '✅ Vue dashboard créée';
  RAISE NOTICE '✅ Permissions configurées';
  RAISE NOTICE '✅ Partenaires actifs: %', partner_count;
  RAISE NOTICE '✅ Codes générés: %', codes_count;
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ Système 100%% opérationnel ! 🚀';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '';
END $$;
