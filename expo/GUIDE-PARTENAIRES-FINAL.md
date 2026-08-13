# 🎯 Guide du Système de Partenaires - VERSION FINALE

## ✅ Ce qui a été corrigé

### Problèmes résolus:
1. ❌ **Avant**: Erreur "Could not find the function toggle_partner_status"
   ✅ **Après**: Plus de fonction RPC complexe - Mise à jour directe dans la base

2. ❌ **Avant**: Bouton partenaire ne fonctionne pas instantanément
   ✅ **Après**: Activation/Désactivation instantanée avec feedback visuel

3. ❌ **Avant**: Partenaires invisibles dans l'onglet
   ✅ **Après**: Deux interfaces disponibles:
   - `/admin` → Onglet "Util" pour activer/désactiver les partenaires
   - `/admin/manage-partners` → Interface dédiée à la gestion des partenaires

## 📋 Instructions d'Installation

### 1. Exécuter le Script SQL

Ouvrez votre tableau de bord Supabase:
1. Allez dans **SQL Editor**
2. Créez une nouvelle requête
3. Copiez tout le contenu du fichier `supabase-simple-partner-final.sql`
4. Cliquez sur **Run**

✅ Vous devriez voir: "Système de partenaires installé avec succès!"

### 2. Redémarrer l'Application

```bash
# Arrêter l'app
Ctrl + C

# Nettoyer le cache
rm -rf node_modules/.cache

# Redémarrer
bun start
```

## 🎮 Comment Utiliser le Système

### Pour le Super Admin

#### Option 1: Dans l'onglet Admin → Utilisateurs

1. Allez dans **Admin** (icône 🛡️ en bas)
2. Cliquez sur l'onglet **Util** (Utilisateurs)
3. Trouvez l'utilisateur
4. Cliquez sur le bouton **Partenaire** ou **Retirer**
   - Bouton violet = Activer comme partenaire
   - Bouton rouge = Retirer le statut partenaire

#### Option 2: Interface Dédiée (RECOMMANDÉ)

1. Allez dans **Admin** → **Part** (Partenaires)
   - OU accédez directement à `/admin/manage-partners`
2. Vous verrez:
   - 📊 Statistiques: Nombre de partenaires et utilisateurs
   - 🔍 Barre de recherche
   - 👥 Liste filtrée (Tous / Partenaires uniquement)
3. Pour chaque utilisateur:
   - **Activer**: Bouton vert avec icône ➕
   - **Retirer**: Bouton rouge avec icône ➖

### Que se passe-t-il lors de l'activation?

✅ **Quand vous activez un partenaire:**
- Le statut `is_partner` passe à `true`
- Un code de parrainage unique est généré automatiquement (ex: `PARTNER5X7YZ`)
- Le code s'affiche dans le profil du partenaire

✅ **Quand vous retirez le statut:**
- Le statut `is_partner` passe à `false`
- Tous ses codes promo sont désactivés
- Le code de parrainage reste visible mais inactif

### Pour les Partenaires

1. **Voir son code**: 
   - Allez dans **Profil**
   - Si vous êtes partenaire, votre code de parrainage s'affiche

2. **Utilisation du code**:
   - Les vendeurs entrent ce code lors de la publication d'une annonce
   - Ils bénéficient d'une réduction sur les frais de commission
   - Vous gagnez une commission sur chaque vente

### Traçabilité des Ventes

Les ventes sont automatiquement tracées:
- Dans la table `products`, colonne `partner_id` = ID du partenaire
- Dans la table `products`, colonne `partner_code_used` = Code utilisé
- Vous pouvez voir les stats dans l'interface de gestion des partenaires

## 🔍 Vérification que Tout Fonctionne

### Test 1: Activer un Partenaire

1. Ouvrez l'app
2. Connectez-vous en tant que Super Admin
3. Allez dans Admin → Part (ou Admin → Util)
4. Cliquez sur "Activer" pour un utilisateur
5. ✅ Vous devriez voir "Partenaire activé avec succès"
6. ✅ Le bouton passe de vert à rouge
7. ✅ Une icône couronne apparaît à côté du nom
8. ✅ Le code de parrainage s'affiche

### Test 2: Vérifier le Code dans le Profil

1. Connectez-vous avec le compte du partenaire
2. Allez dans Profil
3. ✅ Vous devriez voir votre code de parrainage

### Test 3: Utiliser le Code

1. Créez un nouveau compte (ou connectez-vous avec un vendeur)
2. Ajoutez un produit
3. Entrez le code de parrainage du partenaire
4. ✅ Les frais devraient être réduits (ex: 15% → 10%)
5. ✅ La vente est liée au partenaire dans la base de données

## 🐛 Que Faire en Cas de Problème?

### Erreur "Could not find the function"

Si vous voyez encore cette erreur:
1. Retournez dans Supabase SQL Editor
2. Exécutez à nouveau le script `supabase-simple-partner-final.sql`
3. Redémarrez l'application
4. Videz le cache du navigateur (Ctrl+Shift+R sur web)

### Le bouton ne répond pas

1. Vérifiez que vous êtes connecté en tant que Super Admin
2. Ouvrez la console du navigateur (F12) pour voir les logs
3. Vérifiez que le script SQL a bien été exécuté

### Le code ne s'affiche pas

1. Désactivez puis réactivez le partenaire
2. Un nouveau code sera généré automatiquement

## 📊 Structure de la Base de Données

### Table `users`
- `is_partner` (boolean): Statut partenaire
- `partner_referral_code` (text): Code de parrainage unique

### Table `products`
- `partner_id` (text): ID du partenaire (si code utilisé)
- `partner_code_used` (text): Code de parrainage utilisé
- `partner_commission` (numeric): Commission gagnée par le partenaire

### Table `discount_codes`
- `partner_user_id` (text): ID du partenaire propriétaire
- `is_active` (boolean): Code actif ou non
- `times_used` (int): Nombre d'utilisations

## 🎯 Résumé Simple

**Ce qui fonctionne maintenant:**
- ✅ Activation/Désactivation des partenaires (boutons fonctionnels)
- ✅ Génération automatique des codes de parrainage
- ✅ Affichage du code dans le profil partenaire
- ✅ Traçabilité des ventes par partenaire
- ✅ Interface de gestion complète dans `/admin/manage-partners`
- ✅ Plus d'erreurs "function not found"

**Accès rapides:**
- Super Admin → `/admin/manage-partners`
- Partenaire → Profil (voir son code)
- Vendeur → Ajouter un produit (entrer le code)

---

**Si vous avez encore des problèmes, vérifiez:**
1. Le script SQL a bien été exécuté
2. Vous êtes connecté en tant que Super Admin
3. L'application a été redémarrée après l'exécution du SQL
