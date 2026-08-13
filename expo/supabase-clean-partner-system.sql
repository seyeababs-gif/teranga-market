-- ============================================
-- SYSTÈME PARTENAIRES - VERSION PROPRE ET SIMPLE
-- ============================================

-- 1. NETTOYAGE COMPLET
-- ============================================

-- Supprimer tous les anciens triggers qui pourraient référencer partner_id
DO $$ 
DECLARE
  trigger_record RECORD;
BEGIN
  FOR trigger_record IN 
    SELECT event_object_table, trigger_name
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE', 
                   trigger_record.trigger_name, 
                   trigger_record.event_object_table);
  END LOOP;
END $$;

-- Supprimer toutes les anciennes fonctions
DROP FUNCTION IF EXISTS toggle_partner_status CASCADE;
DROP FUNCTION IF EXISTS get_active_user_partners CASCADE;
DROP FUNCTION IF EXISTS get_partner_stats CASCADE;
DROP FUNCTION IF EXISTS update_partner_referral_code CASCADE;
DROP FUNCTION IF EXISTS get_partner_commissions CASCADE;
DROP FUNCTION IF EXISTS get_partner_commission_stats CASCADE;
DROP FUNCTION IF EXISTS notify_partner_code_used CASCADE;

-- 2. STRUCTURE DES TABLES
-- ============================================

-- Vérifier que la table users a les bonnes colonnes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'is_partner') THEN
    ALTER TABLE users ADD COLUMN is_partner BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'partner_referral_code') THEN
    ALTER TABLE users ADD COLUMN partner_referral_code TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'referred_by_partner_id') THEN
    ALTER TABLE users ADD COLUMN referred_by_partner_id TEXT;
  END IF;
END $$;

-- Créer la table discount_codes si elle n'existe pas
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_percent NUMERIC DEFAULT 5,
  partner_user_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  times_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Créer la table partner_commissions si elle n'existe pas
CREATE TABLE IF NOT EXISTS partner_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  seller_name TEXT,
  product_title TEXT,
  product_price NUMERIC NOT NULL,
  commission_rate NUMERIC DEFAULT 10,
  commission_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Vérifier que products a les bonnes colonnes pour les codes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'discount_code') THEN
    ALTER TABLE products ADD COLUMN discount_code TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'discount_code_applied') THEN
    ALTER TABLE products ADD COLUMN discount_code_applied BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 3. INDEX POUR LES PERFORMANCES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_is_partner ON users(is_partner) WHERE is_partner = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_partner_code ON users(partner_referral_code) WHERE partner_referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discount_codes_partner ON discount_codes(partner_user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_products_discount_code ON products(discount_code) WHERE discount_code IS NOT NULL;

-- 4. FONCTIONS PRINCIPALES
-- ============================================

-- Fonction pour obtenir la liste des partenaires actifs
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
    u.partner_referral_code,
    COALESCE(SUM(pc.commission_amount), 0) as total_commission_earned,
    COUNT(DISTINCT pc.product_id) as total_sales,
    u.created_at
  FROM users u
  LEFT JOIN partner_commissions pc ON pc.partner_user_id = u.id
  WHERE u.is_partner = TRUE
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.partner_referral_code, u.created_at
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les stats d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id TEXT)
RETURNS TABLE (
  total_referrals BIGINT,
  total_sales BIGINT,
  total_commission_earned NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM users WHERE referred_by_partner_id = partner_user_id)::BIGINT as total_referrals,
    (SELECT COUNT(DISTINCT product_id) FROM partner_commissions WHERE partner_commissions.partner_user_id = get_partner_stats.partner_user_id)::BIGINT as total_sales,
    (SELECT COALESCE(SUM(commission_amount), 0) FROM partner_commissions WHERE partner_commissions.partner_user_id = get_partner_stats.partner_user_id) as total_commission_earned;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour le code de parrainage
CREATE OR REPLACE FUNCTION update_partner_referral_code(
  partner_user_id TEXT,
  new_code TEXT
)
RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
DECLARE
  code_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE partner_referral_code = new_code 
    AND id != partner_user_id
  ) INTO code_exists;

  IF code_exists THEN
    RETURN QUERY SELECT FALSE, 'Ce code existe déjà';
    RETURN;
  END IF;

  UPDATE users 
  SET partner_referral_code = new_code,
      updated_at = NOW()
  WHERE id = partner_user_id;

  RETURN QUERY SELECT TRUE, 'Code mis à jour';
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les commissions d'un partenaire
CREATE OR REPLACE FUNCTION get_partner_commissions(partner_user_id TEXT)
RETURNS TABLE (
  id UUID,
  product_id TEXT,
  seller_id TEXT,
  seller_name TEXT,
  product_title TEXT,
  product_price NUMERIC,
  commission_rate NUMERIC,
  commission_amount NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id,
    pc.product_id,
    pc.seller_id,
    pc.seller_name,
    pc.product_title,
    pc.product_price,
    pc.commission_rate,
    pc.commission_amount,
    pc.status,
    pc.created_at,
    pc.paid_at
  FROM partner_commissions pc
  WHERE pc.partner_user_id = get_partner_commissions.partner_user_id
  ORDER BY pc.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les statistiques de commission
CREATE OR REPLACE FUNCTION get_partner_commission_stats(partner_user_id TEXT)
RETURNS TABLE (
  total_earned NUMERIC,
  total_pending NUMERIC,
  total_paid NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(commission_amount), 0) as total_earned,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as total_pending,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0) as total_paid
  FROM partner_commissions
  WHERE partner_commissions.partner_user_id = get_partner_commission_stats.partner_user_id;
END;
$$ LANGUAGE plpgsql;

-- 5. TRIGGER POUR CRÉER UNE COMMISSION QUAND UN PRODUIT EST APPROUVÉ
-- ============================================

CREATE OR REPLACE FUNCTION create_partner_commission_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  partner_id TEXT;
  discount_code_id TEXT;
  partner_commission_rate NUMERIC;
  commission_amt NUMERIC;
BEGIN
  -- Vérifier si le produit vient d'être approuvé et a un code de réduction
  IF NEW.status = 'approved' AND OLD.status != 'approved' 
     AND NEW.discount_code IS NOT NULL AND NEW.discount_code_applied = TRUE THEN
    
    -- Trouver le partenaire via le code de réduction
    SELECT dc.partner_user_id, dc.id INTO partner_id, discount_code_id
    FROM discount_codes dc
    WHERE dc.code = NEW.discount_code AND dc.is_active = TRUE;
    
    IF partner_id IS NOT NULL THEN
      -- Obtenir le taux de commission (par défaut 10%)
      SELECT COALESCE(partner_commission_rate, 10) INTO partner_commission_rate
      FROM global_settings
      LIMIT 1;
      
      IF partner_commission_rate IS NULL THEN
        partner_commission_rate := 10;
      END IF;
      
      -- Calculer la commission
      commission_amt := (NEW.price * partner_commission_rate / 100);
      
      -- Créer la commission
      INSERT INTO partner_commissions (
        partner_user_id,
        product_id,
        seller_id,
        seller_name,
        product_title,
        product_price,
        commission_rate,
        commission_amount,
        status,
        created_at
      ) VALUES (
        partner_id,
        NEW.id,
        NEW.seller_id,
        NEW.seller_name,
        NEW.title,
        NEW.price,
        partner_commission_rate,
        commission_amt,
        'pending',
        NOW()
      );
      
      -- Incrémenter le compteur d'utilisation du code
      UPDATE discount_codes 
      SET times_used = COALESCE(times_used, 0) + 1
      WHERE id = discount_code_id;
      
      -- Créer une notification pour le partenaire
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        is_read,
        created_at
      ) VALUES (
        partner_id,
        'partner_code_used',
        'Code de parrainage utilisé',
        format('Votre code a été utilisé pour le produit "%s". Commission: %s FCFA', 
               NEW.title, 
               ROUND(commission_amt)),
        FALSE,
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_create_partner_commission ON products;
CREATE TRIGGER trigger_create_partner_commission
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION create_partner_commission_on_approval();

-- 6. PERMISSIONS RLS
-- ============================================

-- Activer RLS sur les nouvelles tables
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

-- Politiques pour discount_codes
DROP POLICY IF EXISTS "Tout le monde peut voir les codes actifs" ON discount_codes;
CREATE POLICY "Tout le monde peut voir les codes actifs"
  ON discount_codes FOR SELECT
  TO authenticated, anon
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Super admin peut tout faire sur les codes" ON discount_codes;
CREATE POLICY "Super admin peut tout faire sur les codes"
  ON discount_codes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::TEXT 
      AND users.is_super_admin = TRUE
    )
  );

-- Politiques pour partner_commissions
DROP POLICY IF EXISTS "Les partenaires peuvent voir leurs commissions" ON partner_commissions;
CREATE POLICY "Les partenaires peuvent voir leurs commissions"
  ON partner_commissions FOR SELECT
  TO authenticated
  USING (
    partner_user_id = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::TEXT 
      AND (users.is_super_admin = TRUE OR users.is_admin = TRUE)
    )
  );

DROP POLICY IF EXISTS "Admins peuvent tout faire sur les commissions" ON partner_commissions;
CREATE POLICY "Admins peuvent tout faire sur les commissions"
  ON partner_commissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::TEXT 
      AND (users.is_super_admin = TRUE OR users.is_admin = TRUE)
    )
  );

-- 7. DONNÉES DE TEST (optionnel - à supprimer en production)
-- ============================================

-- Générer automatiquement un code de parrainage pour les partenaires existants qui n'en ont pas
UPDATE users 
SET partner_referral_code = 'PARTNER' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6))
WHERE is_partner = TRUE 
AND (partner_referral_code IS NULL OR partner_referral_code = '');

-- ============================================
-- FIN DU SCRIPT
-- ============================================

-- Vérification finale
SELECT 
  'Tables créées' as step,
  COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('discount_codes', 'partner_commissions');

SELECT 
  'Fonctions créées' as step,
  COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_active_user_partners',
  'get_partner_stats', 
  'update_partner_referral_code',
  'get_partner_commissions',
  'get_partner_commission_stats',
  'create_partner_commission_on_approval'
);

SELECT 
  'Triggers créés' as step,
  COUNT(*) as count
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name = 'trigger_create_partner_commission';
