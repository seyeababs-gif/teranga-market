-- Vérifier et initialiser global_settings

-- Vérifier si la table existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'global_settings'
    ) THEN
        -- Créer la table si elle n'existe pas
        CREATE TABLE public.global_settings (
            id TEXT PRIMARY KEY DEFAULT 'default',
            commission_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00,
            discount_reduction NUMERIC(5,2) NOT NULL DEFAULT 5.00,
            partner_commission_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            updated_by TEXT
        );
        
        RAISE NOTICE 'Table global_settings créée';
    ELSE
        RAISE NOTICE 'Table global_settings existe déjà';
    END IF;
END $$;

-- Vérifier si l'enregistrement par défaut existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.global_settings WHERE id = 'default') THEN
        -- Créer l'enregistrement par défaut
        INSERT INTO public.global_settings (id, commission_rate, discount_reduction, partner_commission_rate)
        VALUES ('default', 15.00, 5.00, 5.00);
        
        RAISE NOTICE 'Enregistrement par défaut créé dans global_settings';
    ELSE
        RAISE NOTICE 'Enregistrement par défaut existe déjà dans global_settings';
    END IF;
END $$;

-- Afficher les valeurs actuelles
SELECT 
    id,
    commission_rate as "Commission (%)",
    discount_reduction as "Réduction avec code (%)",
    partner_commission_rate as "Commission partenaire (%)",
    updated_at as "Dernière mise à jour",
    updated_by as "Modifié par"
FROM public.global_settings 
WHERE id = 'default';

-- Activer RLS si pas déjà activé
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Anyone can view global settings" ON public.global_settings;
DROP POLICY IF EXISTS "Super admins can update global settings" ON public.global_settings;

-- Créer les policies
CREATE POLICY "Anyone can view global settings"
ON public.global_settings
FOR SELECT
USING (true);

CREATE POLICY "Super admins can update global settings"
ON public.global_settings
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.is_super_admin = true
    )
);

-- Vérifier les tables liées
SELECT 
    'discount_codes' as table_name,
    COUNT(*) as count
FROM public.discount_codes
WHERE is_active = true

UNION ALL

SELECT 
    'announcement_banners' as table_name,
    COUNT(*) as count
FROM public.announcement_banners
WHERE is_active = true

UNION ALL

SELECT 
    'global_premium_mode' as table_name,
    COUNT(*) as count
FROM public.global_premium_mode
WHERE is_active = true
AND ends_at > NOW();
