-- Script de débogage pour vérifier les paramètres globaux

-- 1. Vérifier la table global_settings
SELECT 'Checking global_settings table...' as step;
SELECT * FROM global_settings;

-- 2. Vérifier les codes promo
SELECT 'Checking discount_codes...' as step;
SELECT id, code, discount_rate, is_active, times_used, partner_user_id FROM discount_codes;

-- 3. Vérifier les bannières
SELECT 'Checking announcement_banners...' as step;
SELECT id, message, is_active, background_color, text_color FROM announcement_banners;

-- 4. Vérifier le mode premium global
SELECT 'Checking global_premium_mode...' as step;
SELECT id, event_name, is_active, starts_at, ends_at FROM global_premium_mode
WHERE is_active = true;

-- 5. Vérifier la fonction get_active_banners
SELECT 'Testing get_active_banners function...' as step;
SELECT * FROM get_active_banners();

-- 6. Vérifier la structure des tables
SELECT 'Checking table structures...' as step;

-- Structure de discount_codes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'discount_codes'
ORDER BY ordinal_position;

-- Structure de global_settings
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'global_settings'
ORDER BY ordinal_position;

-- 7. S'assurer que global_settings a une valeur par défaut
INSERT INTO global_settings (id, commission_rate, discount_reduction, partner_commission_rate, updated_at)
VALUES ('default', 15, 5, 5, NOW())
ON CONFLICT (id) DO UPDATE SET
  commission_rate = COALESCE(global_settings.commission_rate, 15),
  discount_reduction = COALESCE(global_settings.discount_reduction, 5),
  partner_commission_rate = COALESCE(global_settings.partner_commission_rate, 5);

-- Afficher le résultat final
SELECT 'Final settings:' as step;
SELECT * FROM global_settings WHERE id = 'default';
