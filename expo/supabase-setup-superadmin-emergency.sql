-- Script d'urgence pour définir le super admin
-- À exécuter dans Supabase SQL Editor si vous êtes déjà inscrit

-- ÉTAPE 1: Désactiver temporairement le trigger qui bloque les modifications
ALTER TABLE users DISABLE TRIGGER check_admin_modification;

-- ÉTAPE 2: Définir le super admin par numéro de téléphone
UPDATE users 
SET 
  is_super_admin = TRUE,
  is_admin = TRUE
WHERE phone = '+33651104669';

-- ÉTAPE 3: Vérifier que la modification a bien été effectuée
-- (cette requête doit retourner 1 ligne avec is_super_admin = true)
SELECT id, name, phone, is_admin, is_super_admin 
FROM users 
WHERE phone = '+33651104669';

-- ÉTAPE 4: Réactiver le trigger
ALTER TABLE users ENABLE TRIGGER check_admin_modification;

-- ÉTAPE 5: Afficher le résultat final
SELECT 
  'Super admin configuré avec succès!' as message,
  name,
  phone,
  is_admin,
  is_super_admin
FROM users 
WHERE phone = '+33651104669';
