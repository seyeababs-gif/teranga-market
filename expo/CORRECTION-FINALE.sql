-- ===============================================
-- CORRECTION FINALE POUR L'APPLICATION MARKETPLACE
-- À exécuter dans le Supabase SQL Editor
-- ===============================================

-- Étape 1: Corriger la contrainte de statut des produits
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check 
  CHECK (status IN ('pending_payment', 'pending', 'approved', 'rejected'));

-- Étape 2: Ajouter les colonnes manquantes pour les commissions
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS wave_payment_reference TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_confirmed_by TEXT;

-- Étape 3: Ajouter la colonne is_super_admin si elle n'existe pas
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Étape 4: Définir votre numéro comme super administrateur
UPDATE users 
SET is_super_admin = TRUE, is_admin = TRUE 
WHERE phone = '+33651104669';

-- Étape 5: Mettre à jour les politiques RLS pour les produits
DROP POLICY IF EXISTS "Users can view products" ON products;
CREATE POLICY "Users can view products" ON products FOR SELECT USING (
  status = 'approved' OR 
  seller_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

-- Étape 6: Mettre à jour les politiques RLS pour les users
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (
  auth.uid()::text = id OR 
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

-- Étape 7: Créer une fonction pour vérifier si l'utilisateur est super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 8: Créer une fonction pour modifier le statut admin (seulement par le super admin)
CREATE OR REPLACE FUNCTION can_modify_admin_status()
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Seul le super administrateur peut modifier les permissions admin';
  END IF;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 9: Vérifier que tout fonctionne
SELECT 'Configuration terminée!' as status,
       EXISTS(SELECT 1 FROM users WHERE phone = '+33651104669' AND is_super_admin = true) as super_admin_configured,
       EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'commission_amount') as commission_column_exists;
