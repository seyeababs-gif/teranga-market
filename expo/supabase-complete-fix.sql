-- ===============================================
-- CORRECTION COMPLÈTE DE L'APPLICATION MARKETPLACE
-- ===============================================
-- Ce script résout toutes les erreurs:
-- 1. Erreur de fonction existante
-- 2. Erreur commission_amount
-- 3. Erreur products_status_check
-- 4. Configuration du super administrateur
-- ===============================================

-- ÉTAPE 1: NETTOYER LES FONCTIONS ET TRIGGERS EXISTANTS
-- ===============================================

-- Supprimer le trigger d'abord
DROP TRIGGER IF EXISTS check_admin_modification ON users;

-- Supprimer les fonctions existantes
DROP FUNCTION IF EXISTS can_modify_admin_status() CASCADE;
DROP FUNCTION IF EXISTS is_super_admin() CASCADE;

-- ÉTAPE 2: CORRIGER LA TABLE PRODUCTS
-- ===============================================

-- Supprimer l'ancienne contrainte de statut
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;

-- Ajouter la nouvelle contrainte avec le statut 'pending_payment'
ALTER TABLE products ADD CONSTRAINT products_status_check 
  CHECK (status IN ('pending_payment', 'pending', 'approved', 'rejected'));

-- Ajouter les colonnes manquantes pour les commissions
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS wave_payment_reference TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_confirmed_by TEXT;

-- ÉTAPE 3: CONFIGURER LE SUPER ADMINISTRATEUR
-- ===============================================

-- Ajouter la colonne is_super_admin si elle n'existe pas
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_super_admin ON users(is_super_admin);

-- Définir le numéro +33651104669 comme super administrateur
UPDATE users 
SET is_super_admin = TRUE, is_admin = TRUE 
WHERE phone = '+33651104669';

-- ÉTAPE 4: CRÉER LES NOUVELLES FONCTIONS
-- ===============================================

-- Fonction pour vérifier si l'utilisateur est super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT COALESCE(is_super_admin, FALSE) FROM users WHERE id = auth.uid()::text LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction trigger pour protéger les permissions admin
CREATE OR REPLACE FUNCTION can_modify_admin_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Si l'utilisateur essaie de modifier le champ is_admin ou is_super_admin
  IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin) THEN
    -- Vérifier si l'utilisateur actuel est le super admin
    IF NOT EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::text 
      AND is_super_admin = true
    ) THEN
      RAISE EXCEPTION 'Seul le super administrateur peut modifier les permissions admin';
    END IF;
  END IF;
  
  -- Empêcher la suppression du statut super admin
  IF OLD.is_super_admin = true AND NEW.is_super_admin = false THEN
    RAISE EXCEPTION 'Le statut de super administrateur ne peut pas être retiré';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger
CREATE TRIGGER check_admin_modification
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION can_modify_admin_status();

-- ÉTAPE 5: METTRE À JOUR LES POLITIQUES RLS
-- ===============================================

-- Politiques pour les produits
DROP POLICY IF EXISTS "Users can view products" ON products;
CREATE POLICY "Users can view products" ON products FOR SELECT USING (
  status = 'approved' OR 
  seller_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

DROP POLICY IF EXISTS "Users can update products" ON products;
CREATE POLICY "Users can update products" ON products FOR UPDATE USING (
  seller_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

DROP POLICY IF EXISTS "Users can delete products" ON products;
CREATE POLICY "Users can delete products" ON products FOR DELETE USING (
  seller_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

-- Politiques pour les users
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (
  auth.uid()::text = id OR 
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users" ON users FOR DELETE USING (
  ((SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
   (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true) AND
  -- Le super admin ne peut pas être supprimé
  id != (SELECT id FROM users WHERE is_super_admin = true LIMIT 1)
);

-- ÉTAPE 6: VÉRIFICATION
-- ===============================================

-- Afficher le résultat de la configuration
SELECT 
  'Configuration terminée avec succès!' as status,
  EXISTS(SELECT 1 FROM users WHERE phone = '+33651104669' AND is_super_admin = true) as super_admin_configured,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'commission_amount') as commission_column_exists,
  (SELECT status FROM products LIMIT 1) as test_product_status;

-- Afficher les informations du super admin
SELECT 
  id, 
  name, 
  phone, 
  is_admin, 
  is_super_admin,
  'Super Admin OK' as message
FROM users 
WHERE phone = '+33651104669';
