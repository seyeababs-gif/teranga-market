-- ============================================
-- SCRIPT DE VÉRIFICATION
-- ============================================
-- Exécutez ce script pour vérifier que tout est en ordre

-- 1. Vérifier que la table global_settings existe et contient des données
SELECT 'Vérification global_settings' as verification;
SELECT * FROM global_settings;

-- 2. Vérifier que la table discount_codes existe
SELECT 'Vérification discount_codes' as verification;
SELECT COUNT(*) as nombre_codes FROM discount_codes;

-- 3. Vérifier que la table announcement_banners existe
SELECT 'Vérification announcement_banners' as verification;
SELECT COUNT(*) as nombre_banners FROM announcement_banners;

-- 4. Vérifier que la table global_premium_mode existe
SELECT 'Vérification global_premium_mode' as verification;
SELECT COUNT(*) as nombre_premium_modes FROM global_premium_mode;

-- 5. Vérifier que les colonnes is_partner et is_super_admin existent
SELECT 'Vérification colonnes users' as verification;
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('is_partner', 'is_super_admin');

-- 6. Vérifier les fonctions SQL
SELECT 'Vérification fonctions SQL' as verification;
SELECT 
  routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('get_active_banners', 'get_active_user_partners');

-- 7. Compter les super admins
SELECT 'Nombre de super admins' as info, COUNT(*) as nombre 
FROM users 
WHERE is_super_admin = TRUE;

-- 8. Vérifier les policies RLS
SELECT 'Vérification policies' as verification;
SELECT 
  tablename, 
  policyname 
FROM pg_policies 
WHERE tablename IN ('global_settings', 'discount_codes', 'announcement_banners', 'global_premium_mode')
ORDER BY tablename, policyname;

-- 9. Test de la fonction get_active_banners
SELECT 'Test get_active_banners' as test;
SELECT * FROM get_active_banners();

-- 10. Test de la fonction get_active_user_partners
SELECT 'Test get_active_user_partners' as test;
SELECT * FROM get_active_user_partners();

-- RÉSULTAT ATTENDU :
-- ✅ global_settings doit contenir 1 ligne avec id='default', commission_rate=15
-- ✅ Les autres tables doivent exister (peuvent être vides)
-- ✅ Les colonnes is_partner et is_super_admin doivent exister dans users
-- ✅ Les 2 fonctions SQL doivent exister
-- ✅ Au moins 4 policies par table doivent exister
