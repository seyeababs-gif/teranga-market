# 🔧 Instructions de Correction Finale

## ⚠️ Problèmes Identifiés et Solutions

### 1. Structure de la Base de Données
Les erreurs proviennent de:
- Colonnes manquantes (partner_commission_rate, is_partner, is_super_admin)
- Politiques RLS mal configurées pour announcement_banners
- Fonction pour obtenir les partenaires qui cherche une table "partners" qui n'existe pas

### 2. Taux de Commission
- ✅ Le code est déjà à 15% (ligne 319 de MarketplaceContext.tsx)
- ❌ Les codes promo doivent réduire de 5% la commission (15% → 10%)
- ❌ Les partenaires doivent recevoir 5% de commission

## 🚀 ÉTAPES À SUIVRE

### Étape 1: Exécuter le Script SQL de Correction

**Copiez et exécutez ce script dans Supabase SQL Editor:**

```sql
-- Le fichier supabase-complete-fix-final.sql
```

### Étape 2: Vérifier que le Script a Bien Fonctionné

Après l'exécution, vous devriez voir:
```
✓ Correction terminée
✓ Commission par défaut: 15%
✓ Réduction avec code promo: 5%
✓ Commission partenaires: 5%
```

### Étape 3: Rafraîchir l'Application

1. **Sur mobile/navigateur:** Fermez complètement l'application et rouvrez-la
2. **Effacez le cache si nécessaire:**
   - Sur web: Ouvrez les DevTools (F12) → Application → Clear Storage
   - Sur mobile: Réinstallez l'app si les problèmes persistent

## 📋 Fonctionnement du Système Simplifié

### Commission (15%)
- **Standard**: 15% de commission lors de la publication
- **Premium**: 0% de commission
- **Avec code promo**: 10% de commission (réduction de 5%)

### Codes Promo
- Créés par le Super Admin dans l'onglet "Paramètres"
- Peuvent être associés à un partenaire (utilisateur avec `is_partner = true`)
- Réduisent la commission de 15% à 10%
- Le vendeur entre le code AU MOMENT DE PAYER son annonce

### Partenaires
- Ce sont des utilisateurs normaux avec `is_partner = true`
- Définis dans l'onglet "Utilisateurs" par le Super Admin
- Reçoivent 5% de commission quand leur code promo est utilisé
- Pas de table séparée "partners", tout est dans la table "users"

### Bannières
- Messages défilants affichés en haut de l'app
- Créés dans l'onglet "Paramètres"
- Personnalisables (couleur de fond et texte)

### Premium Global
- Active le mode Premium pour TOUS les utilisateurs temporairement
- Utile pour événements (Black Friday, Ramadan, etc.)
- Tous les utilisateurs publient sans commission pendant la période

## 🎯 Ce qui est Simplifié

### AVANT (Complexe)
- Table partners séparée
- Plusieurs étapes pour créer un code promo
- Interface confuse pour les paramètres

### APRÈS (Simple)
1. **Pour créer un code promo:**
   - Admin → Paramètres → "Créer un code"
   - Entrez juste le nom du code (ex: PROMO2024)
   - C'est tout ! Le code réduit automatiquement de 5%

2. **Pour définir un partenaire:**
   - Admin → Utilisateurs → Cliquez sur "Prm" ou "Admin"
   - Le système gère automatiquement les commissions

3. **Pour utiliser un code promo:**
   - Le vendeur entre le code quand il publie son annonce
   - Si valide: commission passe de 15% à 10%
   - Si le code a un partenaire: le partenaire gagne 5%

## ❓ FAQ - Questions Fréquentes

### Q: Où le vendeur entre-t-il le code promo?
**R:** Lors de la publication de l'annonce, AVANT de payer. Il y a un champ "Code Promo" dans le formulaire.

### Q: Comment voir les commissions des partenaires?
**R:** Dans l'onglet Paramètres, la liste des codes promo affiche le nombre d'utilisations. 
Calcul: nombre d'utilisations × 5% du prix moyen

### Q: Peut-on changer le taux de commission?
**R:** Oui! C'est dans la table global_settings. Par défaut c'est 15%, mais vous pouvez le modifier directement dans Supabase ou (à venir) via l'interface admin.

### Q: Comment tester si ça marche?
**R:**
1. Créez un code promo dans Paramètres
2. Déconnectez-vous et reconnectez-vous avec un compte standard
3. Publiez une annonce et entrez le code promo
4. Vérifiez que la commission est de 10% au lieu de 15%

## 🔍 Vérifications Post-Installation

Après avoir exécuté le script, vérifiez:

```sql
-- 1. Vérifier global_settings
SELECT * FROM global_settings WHERE id = 'default';
-- Doit retourner: commission_rate=15, discount_reduction=5, partner_commission_rate=5

-- 2. Vérifier les colonnes ajoutées
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('is_partner', 'is_super_admin');
-- Doit retourner 2 lignes

-- 3. Vérifier discount_codes
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'discount_codes' AND column_name = 'partner_commission_rate';
-- Doit retourner 1 ligne

-- 4. Vérifier les fonctions
SELECT proname FROM pg_proc WHERE proname IN ('get_active_banners', 'get_active_user_partners');
-- Doit retourner 2 lignes
```

## ⚠️ En Cas de Problème

### Erreur: "relation 'partners' does not exist"
→ Vous n'avez pas exécuté le script SQL. Retournez à l'Étape 1.

### Erreur: "Cannot read properties of undefined (reading 'discountCodes')"
→ Rafraîchissez complètement l'application (F5 ou redémarrez l'app).

### Les paramètres n'affichent rien
→ Vérifiez que vous êtes bien connecté en tant que Super Admin:
```sql
SELECT id, name, is_super_admin FROM users WHERE is_super_admin = true;
```

### L'onglet Paramètres n'apparaît pas
→ Votre utilisateur n'est pas Super Admin. Exécutez:
```sql
UPDATE users SET is_super_admin = true WHERE phone = 'VOTRE_NUMERO';
```

## 📞 Support

Si après toutes ces étapes vous avez encore des problèmes:
1. Vérifiez les logs de la console (F12 sur web)
2. Vérifiez les erreurs dans Supabase → Logs
3. Assurez-vous que toutes les politiques RLS sont bien créées

---

**Version**: 1.0  
**Date**: 2025  
**Statut**: ✅ Prêt pour la production
