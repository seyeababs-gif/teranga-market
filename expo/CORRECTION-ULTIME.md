# 🔧 CORRECTION ULTIME - Instructions Complètes

## 🎯 Problèmes corrigés

1. **Erreur UUID vs TEXT** : L'erreur `operator does not exist: text = uuid` est maintenant corrigée
2. **GlobalSettingsContext undefined** : Le contexte est maintenant toujours défini
3. **Codes promotionnels** : Fonctionnent correctement avec réduction de commission
4. **Bannières d'annonces** : S'affichent correctement dans l'application
5. **Mode Premium Global** : Fonctionne maintenant correctement

## 📋 Étapes de correction

### Étape 1 : Exécuter le script SQL

Allez dans l'éditeur SQL de Supabase et exécutez le fichier :
```
supabase-ultimate-fix.sql
```

Ce script va :
- ✅ Créer toutes les tables manquantes
- ✅ Corriger tous les casts UUID->TEXT dans les policies
- ✅ Créer les fonctions SQL nécessaires
- ✅ Initialiser les paramètres par défaut

### Étape 2 : Vérifier l'exécution

Après l'exécution, vous devriez voir ces messages de confirmation :
- ✅ Correction ultime terminée avec succès !
- ✅ Tous les casts UUID->TEXT ont été corrigés
- ✅ Tables créées/vérifiées
- ✅ Policies RLS configurées
- ✅ Fonctions SQL créées
- ✅ Paramètres par défaut initialisés

### Étape 3 : Redémarrer l'application

1. Arrêtez l'application (Ctrl+C dans le terminal)
2. Redémarrez avec `bun start` ou `npx expo start`
3. Actualisez la page web ou rechargez l'app mobile

## 🧪 Comment tester

### 1. Tester les Paramètres Globaux
- Allez dans l'onglet **Admin** > **Paramètres** (visible uniquement pour le super admin)
- Vérifiez que vous voyez :
  - 💰 Frais de Commission : 15%
  - 🎫 Section Codes Promo
  - 📢 Messages défilants
  - 👑 Premium Global

### 2. Tester les Codes Promotionnels
1. Cliquez sur "**+ Créer un code promo**"
2. Entrez un code (ex: PROMO2024)
3. Le code devrait être créé et affiché
4. **Comment ça marche** :
   - Sans code : commission de 15%
   - Avec code : commission de 10% (réduction de 5%)
   - Le vendeur entre le code lors du paiement Wave

### 3. Tester les Bannières d'Annonces
1. Cliquez sur "**+ Créer un message**"
2. Entrez un message (ex: "Promotion spéciale ce week-end !")
3. Choisissez la couleur de fond et du texte
4. Le message devrait apparaître **en haut de l'écran d'accueil**

### 4. Tester le Premium Global
1. Cliquez sur "**+ Activer Premium Global**"
2. Entrez :
   - Nom de l'événement : "Black Friday"
   - Description : "Tous les utilisateurs sont en Premium"
   - Durée : 1 (heure)
3. Activez le mode
4. **Tous les utilisateurs auront les avantages Premium pendant 1 heure**

## 🔍 Vérifications

### Vérifier que tout fonctionne :

```sql
-- Vérifier les tables
SELECT * FROM global_settings;
SELECT * FROM discount_codes;
SELECT * FROM announcement_banners;
SELECT * FROM global_premium_mode;

-- Vérifier les colonnes users
SELECT id, name, is_partner, is_super_admin FROM users LIMIT 5;
```

### Résultats attendus :
- `global_settings` doit contenir au moins 1 ligne avec id='default'
- Les tables doivent exister sans erreur
- Les colonnes `is_partner` et `is_super_admin` doivent exister dans `users`

## ❓ Si vous avez encore des erreurs

### Erreur "Cannot destructure property 'globalSettings'"
**Cause** : Le contexte GlobalSettings n'est pas chargé correctement
**Solution** : 
1. Vérifiez que le script SQL a été exécuté avec succès
2. Rechargez complètement l'application (Ctrl+R ou actualisez la page)
3. Vérifiez les logs de la console pour voir les erreurs

### Erreur "operator does not exist: text = uuid"
**Cause** : Une policy RLS compare toujours UUID avec TEXT sans cast
**Solution** : 
1. Exécutez le script `supabase-ultimate-fix.sql` à nouveau
2. Le script supprime et recrée toutes les policies avec les bons casts

### Les paramètres ne s'affichent pas
**Cause** : Vous n'êtes pas super admin
**Solution** :
1. Vérifiez votre statut avec : `SELECT id, name, is_super_admin FROM users WHERE id = 'VOTRE_ID';`
2. Si `is_super_admin` est FALSE, mettez-le à TRUE :
   ```sql
   UPDATE users SET is_super_admin = TRUE WHERE id = 'VOTRE_ID';
   ```

## 📝 Fonctionnalités finales

### Codes Promotionnels
- ✅ Les codes réduisent la commission de 15% à 10%
- ✅ Le vendeur entre le code dans son profil
- ✅ La réduction s'applique automatiquement lors de la publication

### Bannières
- ✅ S'affichent en haut de l'écran d'accueil
- ✅ Peuvent avoir différentes couleurs
- ✅ Multiples bannières supportées

### Premium Global
- ✅ Active le Premium pour tous les utilisateurs
- ✅ Pendant la durée choisie (en heures)
- ✅ Idéal pour les événements spéciaux

### Partenaires
- ✅ Statut partenaire pour suivre d'où viennent les utilisateurs
- ✅ Commission tracking
- ✅ Statistiques de ventes

## 🎉 Résultat final

Après avoir suivi toutes ces étapes, votre application devrait :
- ✅ Fonctionner sans erreur
- ✅ Afficher correctement tous les paramètres
- ✅ Permettre la gestion des codes promo
- ✅ Afficher les bannières d'annonces
- ✅ Supporter le mode Premium Global
- ✅ Tracker les partenaires et leurs commissions

Si vous avez des questions ou des problèmes, vérifiez d'abord que le script SQL a été exécuté avec succès !
