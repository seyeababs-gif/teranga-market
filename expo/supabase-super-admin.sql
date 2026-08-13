-- Ajouter le champ is_super_admin à la table users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_super_admin ON users(is_super_admin);

-- Fonction pour définir le super admin par numéro de téléphone
-- Le super admin est défini comme +33651104669
UPDATE users SET is_super_admin = TRUE WHERE phone = '+33651104669';

-- Politique RLS pour protéger le profil du super admin
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (
  auth.uid()::text = id OR 
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true
) WITH CHECK (
  -- Empêcher la modification du super admin par d'autres
  (id != (SELECT id FROM users WHERE is_super_admin = true LIMIT 1)) OR
  (auth.uid()::text = id)
);

-- Politique pour empêcher la suppression du super admin
DROP POLICY IF EXISTS "Admins can delete users" ON users;

CREATE POLICY "Admins can delete users" ON users FOR DELETE USING (
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true AND
  -- Le super admin ne peut pas être supprimé
  id != (SELECT id FROM users WHERE is_super_admin = true LIMIT 1)
);

-- Politique pour que seul le super admin puisse modifier le champ is_admin
CREATE OR REPLACE FUNCTION can_modify_admin_status() RETURNS TRIGGER AS $$
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

DROP TRIGGER IF EXISTS check_admin_modification ON users;
CREATE TRIGGER check_admin_modification
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION can_modify_admin_status();
