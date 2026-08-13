# Migration vers une nouvelle base de données Supabase propre

## Étape 1 : Nettoyer l'ancienne base de données

Dans le SQL Editor de Supabase (https://supabase.com/dashboard/project/zqbqevwofmmyaicsurys/sql), exécutez cette commande pour supprimer toutes les tables existantes :

```sql
-- Drop all tables (execute one by one if needed)
DROP TABLE IF EXISTS public.commission_payments CASCADE;
DROP TABLE IF EXISTS public.partner_referrals CASCADE;
DROP TABLE IF EXISTS public.partner_sales CASCADE;
DROP TABLE IF EXISTS public.global_settings CASCADE;
DROP TABLE IF EXISTS public.discount_codes CASCADE;
DROP TABLE IF EXISTS public.push_tokens CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.is_global_premium_active() CASCADE;
```

## Étape 2 : Créer le nouveau schéma

Copiez tout le contenu du fichier `supabase-clean-schema-rebuild.sql` et exécutez-le dans le SQL Editor de Supabase.

Ce script va :
- Créer toutes les tables nécessaires avec la bonne structure
- Ajouter les indexes pour les performances
- Configurer Row Level Security (RLS)
- Créer les politiques RLS
- Insérer les paramètres globaux par défaut
- Créer le super admin avec le téléphone `+33651104669` et mot de passe `Carbabayese`

## Étape 3 : Vérifier la migration

Après l'exécution du script, vérifiez que tout est en place :

```sql
-- Vérifier que les tables existent
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Vérifier le super admin
SELECT id, name, phone, is_super_admin, is_admin FROM public.users WHERE phone = '+33651104669';

-- Vérifier les paramètres globaux
SELECT * FROM public.global_settings;
```

## Étape 4 : Nettoyer le cache de l'application

Sur l'application web, ouvrez la console du navigateur et exécutez :

```javascript
localStorage.clear();
```

Sur mobile, déconnectez-vous et reconnectez-vous pour vider le cache.

## Étape 5 : Se connecter

Vous pouvez maintenant vous connecter avec :
- **Téléphone** : +33651104669
- **Mot de passe** : Carbabayese

## Notes importantes

1. **Pas de VACUUM** : Le nouveau script n'utilise pas la commande VACUUM qui causait l'erreur
2. **Structure propre** : Toutes les colonnes utilisent les bons types de données
3. **Super admin** : Le compte super admin est automatiquement créé avec tous les privilèges
4. **Performances** : Des indexes sont créés sur toutes les colonnes importantes
5. **Sécurité** : Row Level Security est activé sur toutes les tables

## En cas de problème

Si vous rencontrez des erreurs lors de l'exécution du script :

1. Exécutez d'abord la partie "Drop tables" de l'Étape 1
2. Rafraîchissez la page Supabase
3. Exécutez ensuite le script de création complet
4. Si une table existe déjà, le script l'ignorera grâce au `IF NOT EXISTS`
