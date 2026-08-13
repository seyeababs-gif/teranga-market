-- =====================================================
-- FIX: Ajouter les colonnes manquantes pour les paiements de commission partenaire
-- =====================================================

-- Ajouter la colonne partner_commission_paid à la table products si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'partner_commission_paid'
  ) THEN
    ALTER TABLE products ADD COLUMN partner_commission_paid BOOLEAN DEFAULT false;
    RAISE NOTICE 'Colonne partner_commission_paid ajoutée à products';
  ELSE
    RAISE NOTICE 'Colonne partner_commission_paid existe déjà';
  END IF;
END $$;

-- Ajouter la colonne partner_commission_paid_at à la table products si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'partner_commission_paid_at'
  ) THEN
    ALTER TABLE products ADD COLUMN partner_commission_paid_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Colonne partner_commission_paid_at ajoutée à products';
  ELSE
    RAISE NOTICE 'Colonne partner_commission_paid_at existe déjà';
  END IF;
END $$;

-- Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_products_partner_commission_paid 
ON products(partner_commission_paid) 
WHERE partner_commission_paid = false;

-- Analyser la table pour optimiser
ANALYZE products;
