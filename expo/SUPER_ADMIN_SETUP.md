# Configuration du Super Administrateur

## ✅ Modifications effectuées

Le système de super administrateur a été mis en place avec succès. Voici ce qui a été fait :

### 1. Base de données
- Ajout du champ `is_super_admin` à la table `users`
- Protection du profil du super admin contre toute modification/suppression
- Seul le super admin peut désigner/retirer les droits d'admin

### 2. Code TypeScript
- Type `User` mis à jour avec `isSuperAdmin?: boolean`
- Contexte `MarketplaceContext` mis à jour pour charger et gérer le statut super admin
- Nouvelle fonction `toggleAdminStatus()` pour gérer les admins (réservée au super admin)
- Protection contre la suppression du super admin

### 3. Interface Admin
- Badge rouge spécial "Super Admin" avec icône `ShieldCheck`
- Boutons pour définir/retirer les droits admin (visible uniquement pour le super admin)
- Protection visuelle : impossible de supprimer ou modifier le super admin

## 🚀 Configuration initiale

### Étape 1 : Exécuter le script SQL dans Supabase

1. Connectez-vous à votre tableau de bord Supabase
2. Allez dans "SQL Editor"
3. **IMPORTANT : Modifiez votre numéro de téléphone dans le fichier `supabase-super-admin.sql`** à la ligne 10
4. Exécutez le script `supabase-super-admin.sql`

**Votre numéro de téléphone actuel dans le code :**
```sql
UPDATE users SET is_super_admin = TRUE WHERE phone = '+33651104669';
```

✅ **Le numéro +33651104669 est configuré comme super admin.**

### Étape 2 : Vérification

Après avoir exécuté le script SQL :

1. Déconnectez-vous de l'application
2. Reconnectez-vous avec votre numéro de téléphone
3. Allez dans l'onglet "Admin" > "Utilisateurs"
4. Vous devriez voir un badge rouge "Super Admin" à côté de votre nom

## 🔒 Protections en place

### Protection du profil super admin
- ❌ Aucun admin ne peut supprimer le super admin
- ❌ Aucun admin ne peut modifier les permissions du super admin
- ❌ Le statut de super admin ne peut pas être retiré (même par le super admin)
- ❌ Le super admin ne peut pas se supprimer lui-même

### Gestion des admins
- ✅ Seul le super admin peut définir/retirer les droits admin
- ✅ Interface dédiée dans l'onglet "Utilisateurs" de l'admin
- ✅ Les admins normaux ne voient pas ces boutons
- ✅ Protection au niveau de la base de données via triggers

### Hiérarchie des rôles

```
Super Admin (vous)
    ↓
Admins (désignés par vous)
    ↓
Utilisateurs Premium
    ↓
Utilisateurs Standard
```

## 📱 Utilisation

### En tant que Super Admin

1. **Voir tous les utilisateurs** :
   - Allez dans Admin > Utilisateurs
   - Vous verrez un badge rouge "Super Admin" sur votre profil

2. **Désigner un admin** :
   - Cliquez sur le bouton "Admin" (bleu) à côté d'un utilisateur
   - Confirmez l'action
   - L'utilisateur reçoit un badge bleu "Admin"

3. **Retirer les droits admin** :
   - Cliquez sur le bouton "Retirer" (rouge) à côté d'un admin
   - Confirmez l'action
   - L'utilisateur redevient un utilisateur normal

4. **Autres actions** :
   - Vous pouvez toujours changer le type de compte (Standard/Premium)
   - Vous pouvez supprimer n'importe quel utilisateur (sauf vous-même)
   - Vous pouvez gérer les produits et les commandes

### En tant qu'Admin normal

- Les admins peuvent gérer les produits et les commandes
- Ils peuvent changer le type de compte des utilisateurs
- Ils peuvent supprimer des utilisateurs (sauf le super admin)
- **Ils ne peuvent PAS** désigner d'autres admins
- **Ils ne peuvent PAS** modifier ou supprimer le super admin

## 🔧 Fichiers modifiés

1. `supabase-super-admin.sql` - Script SQL pour la base de données
2. `types/marketplace.ts` - Ajout de `isSuperAdmin` au type User
3. `contexts/MarketplaceContext.tsx` - Gestion du statut super admin + fonction `toggleAdminStatus()`
4. `app/(tabs)/admin.tsx` - Interface pour gérer les admins

## ⚠️ Important

- **N'oubliez pas d'exécuter le script SQL** dans Supabase
- **Modifiez votre numéro de téléphone** dans le script avant l'exécution
- Une fois que vous êtes super admin, reconnectez-vous pour voir les changements
- Le système est conçu pour qu'il n'y ait qu'un seul super admin

## 🐛 Dépannage

### Je ne vois pas le badge Super Admin
1. Vérifiez que vous avez exécuté le script SQL dans Supabase
2. Vérifiez que votre numéro de téléphone correspond exactement dans la base de données
3. Déconnectez-vous et reconnectez-vous
4. Vérifiez dans la table `users` de Supabase que le champ `is_super_admin` est `TRUE`

### Les boutons Admin n'apparaissent pas
1. Assurez-vous d'être connecté en tant que super admin
2. Rechargez la page
3. Vérifiez dans la console s'il y a des erreurs

### Un admin peut-il devenir super admin ?
Non, seul vous (le propriétaire avec votre numéro de téléphone) êtes le super admin. Les admins normaux ne peuvent pas s'auto-promouvoir ou promouvoir d'autres utilisateurs au rang de super admin.
