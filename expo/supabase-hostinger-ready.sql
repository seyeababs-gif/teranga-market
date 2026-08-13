-- Migration: Préparer Supabase pour le déploiement Hostinger 100% autonome
-- Teranga Market — modèle 100% gratuit, toutes les données dans Supabase
-- Exécute ce fichier dans l'éditeur SQL de Supabase (hPanel > Supabase > SQL Editor)

-- ───────────────────────────────────────────────────────────────
-- 1. Stats vendeur (vues, contacts WhatsApp, favoris)
-- Nécessaire pour que les compteurs de stats vendeur fonctionnent.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_stats (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  view_count INTEGER DEFAULT 0,
  whatsapp_click_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_stats_product_id ON product_stats(product_id);

ALTER TABLE product_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view product stats" ON product_stats;
CREATE POLICY "Anyone can view product stats" ON product_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can increment product stats" ON product_stats;
CREATE POLICY "Authenticated can increment product stats" ON product_stats
  FOR UPDATE USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can insert product stats" ON product_stats;
CREATE POLICY "Authenticated can insert product stats" ON product_stats
  FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION increment_product_stat(
  p_product_id UUID,
  p_stat_name TEXT,
  p_delta INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  INSERT INTO product_stats (product_id, view_count, whatsapp_click_count, favorite_count)
  VALUES (p_product_id, 0, 0, 0)
  ON CONFLICT (product_id)
  DO UPDATE SET
    view_count = CASE WHEN p_stat_name = 'view_count' THEN product_stats.view_count + p_delta ELSE product_stats.view_count END,
    whatsapp_click_count = CASE WHEN p_stat_name = 'whatsapp_click_count' THEN product_stats.whatsapp_click_count + p_delta ELSE product_stats.whatsapp_click_count END,
    favorite_count = CASE WHEN p_stat_name = 'favorite_count' THEN product_stats.favorite_count + p_delta ELSE product_stats.favorite_count END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_seller_stats(p_seller_id UUID)
RETURNS TABLE (
  total_views INTEGER,
  total_whatsapp_clicks INTEGER,
  total_favorites INTEGER,
  total_products INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(ps.view_count), 0)::INTEGER,
    COALESCE(SUM(ps.whatsapp_click_count), 0)::INTEGER,
    COALESCE(SUM(ps.favorite_count), 0)::INTEGER,
    COUNT(p.id)::INTEGER
  FROM products p
  LEFT JOIN product_stats ps ON ps.product_id = p.id
  WHERE p.seller_id = p_seller_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION increment_product_stat TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_seller_stats TO authenticated, anon;

-- ───────────────────────────────────────────────────────────────
-- 2. Nettoyage des anciens statuts Wave / pending_payment
-- L'application n'utilise plus Wave ni pending_payment. On migre
-- les anciennes données vers le nouveau statut unique 'pending'.
-- ───────────────────────────────────────────────────────────────

-- Produits : tout statut 'pending_payment' devient 'pending'
UPDATE products
SET status = 'pending'
WHERE status = 'pending_payment';

-- Ajouter les colonnes donation/sale_type si elles n'existent pas
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_donation BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'sale';

-- Ajouter la colonne email_verified si elle n'existe pas
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Commandes : tout statut 'pending_payment' ou 'paid' devient 'pending'
UPDATE orders
SET status = 'pending'
WHERE status IN ('pending_payment', 'paid');

-- ───────────────────────────────────────────────────────────────
-- 3. Configuration gratuite par défaut
-- S'assure que les paramètres globaux reflètent 0% commission.
-- ───────────────────────────────────────────────────────────────
INSERT INTO global_settings (id, commission_rate, discount_reduction, partner_commission_rate, updated_at, updated_by)
VALUES ('default', 0, 0, 0, now(), NULL)
ON CONFLICT (id) DO UPDATE SET
  commission_rate = 0,
  discount_reduction = 0,
  partner_commission_rate = 0,
  updated_at = now();

-- ───────────────────────────────────────────────────────────────
-- 4. Super admin par défaut (si la table users existe et que l'utilisateur
-- admin@terangamarket.com n'existe pas encore)
-- ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    INSERT INTO users (id, email, name, phone, password, type, is_admin, is_super_admin, is_partner, created_at)
    VALUES (
      'super-admin-001',
      'admin@terangamarket.com',
      'Admin Teranga Market',
      '+33651104669',
      'Carbabayese',
      'standard',
      true,
      true,
      false,
      now()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Si l'email existe déjà avec un autre id, on ne touche à rien.
  END IF;
END
$$;
