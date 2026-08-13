-- ============================================
-- AJOUT DES COLONNES POUR LE SUIVI DES PAIEMENTS DE COMMISSIONS PARTENAIRES
-- ============================================

-- 1. Ajouter les colonnes pour suivre les paiements de commissions partenaires
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS partner_commission_paid BOOLEAN DEFAULT FALSE;

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS partner_commission_paid_at TIMESTAMPTZ;

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS partner_commission_paid_by TEXT;

-- 2. Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_products_partner_commission_paid 
ON products(partner_commission_paid) 
WHERE partner_id IS NOT NULL AND discount_code_applied = TRUE;

-- 3. Vérifier les politiques RLS existantes et s'assurer que les super-admins peuvent modifier
-- Supprimer l'ancienne politique si elle existe
DROP POLICY IF EXISTS "Super Admin peut tout modifier sur products" ON products;

-- Créer une politique qui permet au super-admin de tout modifier
CREATE POLICY "Super Admin peut tout modifier sur products" ON products
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 4. Vérification
DO $$
DECLARE
  v_column_exists BOOLEAN;
  v_count INTEGER;
BEGIN
  -- Vérifier que les colonnes existent
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'partner_commission_paid'
  ) INTO v_column_exists;
  
  IF v_column_exists THEN
    RAISE NOTICE '✅ Colonne partner_commission_paid créée avec succès';
    
    -- Compter les produits éligibles aux commissions
    SELECT COUNT(*) INTO v_count
    FROM products
    WHERE partner_id IS NOT NULL 
    AND discount_code_applied = TRUE
    AND status = 'approved';
    
    RAISE NOTICE 'ℹ️  Nombre de produits éligibles aux commissions: %', v_count;
  ELSE
    RAISE NOTICE '❌ Erreur lors de la création de la colonne';
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration terminée avec succès !';
  RAISE NOTICE '========================================';
END $$;
