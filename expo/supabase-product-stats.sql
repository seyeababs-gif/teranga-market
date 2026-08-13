-- Table pour les statistiques produits (vues, contacts WhatsApp, favoris)
CREATE TABLE IF NOT EXISTS product_stats (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  view_count INTEGER DEFAULT 0,
  whatsapp_click_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour les requêtes par vendeur (via jointure products)
CREATE INDEX IF NOT EXISTS idx_product_stats_product_id ON product_stats(product_id);

-- RLS policies
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

-- Fonction pour incrémenter/décrémenter une statistique
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

-- Fonction pour obtenir les stats d'un vendeur
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
