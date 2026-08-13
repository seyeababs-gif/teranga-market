# Guide de déploiement Netlify

## Problèmes identifiés et solutions

### 1. Les popups (Alert.alert) ne fonctionnent pas sur web ✅ RÉSOLU

**Problème:** `Alert.alert()` de React Native ne fonctionne pas correctement sur web.

**Solution:** Système de Toast cross-platform créé et `components/ToastContainer.tsx` amélioré pour le web (position fixed).
- `contexts/ToastContext.tsx` - Gère les toasts et alerts (compatible web avec window.confirm)
- `components/ToastContainer.tsx` - Affiche les toasts (fixé pour web)
- Intégré dans `app/_layout.tsx`

### 2. Configuration Netlify

Pour déployer sur Netlify, vous devez:

1. **Build Settings**:
   - Build command: `npx expo export -p web`
   - Publish directory: `dist`
   - Node version: 18 ou supérieur

2. **Fichier netlify.toml** à créer à la racine:
```toml
[build]
  command = "npx expo export -p web"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

3. **Variables d'environnement** à configurer sur Netlify:
   - `EXPO_PUBLIC_SUPABASE_URL` - URL de votre projet Supabase
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Clé anonyme Supabase

### 3. Corrections effectuées ✅

Les fichiers suivants ont été mis à jour pour utiliser le système de toast :

- ✅ `contexts/MarketplaceContext.tsx` - Alertes remplacées par toasts
- ✅ `app/(tabs)/add.tsx` - Double soumission corrigée (loading state), Alertes remplacées
- ✅ `app/(tabs)/profile.tsx` - Mode Admin corrigé (Alert remplacé par Toast), autres Alertes remplacées
- ⏳ `app/(tabs)/cart.tsx` - Alert.alert (À faire si nécessaire)
- ⏳ `app/auth/login.tsx` - Alert.alert (À faire si nécessaire)
- ⏳ `app/auth/register.tsx` - Alert.alert (À faire si nécessaire)

### 4. Mode Admin sur web ✅

Le problème venait de l'utilisation de `Alert.alert` dans la fonction de bascule du mode admin.
C'est corrigé en utilisant `toast.showAlert` qui utilise `window.confirm` sur le web.

### 5. Produits ajoutés plusieurs fois ✅

Ce problème est corrigé dans `app/(tabs)/add.tsx` en ajoutant un état de chargement (`isSubmitting`) qui désactive le bouton pendant l'envoi.

## Actions pour le redéploiement

Voir le fichier `DEPLOY.md` pour les instructions détaillées.
