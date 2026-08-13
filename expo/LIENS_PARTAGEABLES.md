# 🔗 Système de Liens Partageables

## Vue d'ensemble

Votre application dispose maintenant d'un système complet de liens partageables pour les boutiques et les produits. Les utilisateurs peuvent partager leurs boutiques et produits sur les réseaux sociaux comme TikTok, Instagram, etc.

## Fonctionnalités

### 1. **Page de Boutique Utilisateur** (`/shop/[sellerId]`)

Chaque utilisateur dispose maintenant d'une page de boutique dédiée qui affiche:
- Les informations du vendeur (photo, nom, localisation, téléphone)
- Les statistiques (nombre de produits, note moyenne, membre depuis)
- Une section bio (si l'utilisateur l'a remplie)
- Un bouton pour contacter sur WhatsApp
- Tous les produits approuvés du vendeur

**Accès:** `https://votresite.com/shop/{userId}`

### 2. **Partage de Boutique**

Dans le profil utilisateur (`app/(tabs)/profile.tsx`):
- Un nouveau bouton **"Partager ma boutique"** permet de partager le lien de sa boutique
- Le message partagé inclut:
  - Le nom de la boutique
  - La localisation
  - Le nombre de produits disponibles
  - Le lien direct vers la boutique

### 3. **Partage de Produits**

#### a) Depuis le Profil
Dans les options de produit (bouton "⋮"):
- Option "Partager" qui génère un message avec le lien du produit

#### b) Depuis la Page Produit
- **Clic court** sur le bouton de partage: **Copie le lien** dans le presse-papiers
- **Clic long** sur le bouton de partage: **Ouvre le menu de partage** natif
- Le message partagé inclut:
  - Le titre du produit
  - Le prix
  - La localisation
  - La description
  - Le lien direct vers le produit

**Accès:** `https://votresite.com/product/{productId}`

### 4. **Navigation vers la Boutique du Vendeur**

Depuis la page d'un produit:
- La carte du vendeur est maintenant cliquable
- Un texte "Voir la boutique ›" indique qu'on peut accéder à la boutique
- Un icône boutique (🏪) est affiché à côté du nom du vendeur

## Structure des URLs

Pour que les liens fonctionnent correctement en production, vous devez remplacer `https://votresite.com` par votre domaine réel dans les fichiers suivants:

### Fichiers à mettre à jour:

1. **app/(tabs)/profile.tsx** (ligne 157 et 175)
   ```typescript
   const shopUrl = `https://votresite.com/shop/${currentUser.id}`;
   const productUrl = `https://votresite.com/product/${product.id}`;
   ```

2. **app/product/[id].tsx** (ligne 183 et 205)
   ```typescript
   const productUrl = `https://votresite.com/product/${product.id}`;
   ```

3. **app/shop/[sellerId].tsx** (ligne 74)
   ```typescript
   const shopUrl = `https://votresite.com/shop/${seller.id}`;
   ```

## Configuration du domaine (app.json)

Pour que les liens profonds fonctionnent, vous pouvez configurer votre domaine dans `app.json`:

```json
{
  "expo": {
    "scheme": "myapp",
    "plugins": [
      [
        "expo-router",
        {
          "origin": "https://votre-domaine.com/"
        }
      ]
    ]
  }
}
```

## Utilisation pour les utilisateurs

### Pour partager sa boutique:
1. Aller sur l'onglet **Profil**
2. Cliquer sur **"Partager ma boutique"**
3. Choisir où partager (WhatsApp, Instagram, TikTok, etc.)

### Pour partager un produit:
1. **Depuis le profil:**
   - Cliquer sur "⋮" sur un produit
   - Sélectionner "Partager"

2. **Depuis la page produit:**
   - **Clic court** sur l'icône partage: copie le lien
   - **Clic long** sur l'icône partage: menu de partage

### Pour voir la boutique d'un vendeur:
1. Ouvrir un produit
2. Cliquer sur la carte du vendeur (section "Vendeur")
3. Voir tous ses produits

## Avantages

✅ **Marketing facile:** Les utilisateurs peuvent partager leurs boutiques sur les réseaux sociaux
✅ **Liens directs:** Accès direct aux produits et boutiques via URL
✅ **Cross-platform:** Les liens fonctionnent sur mobile et web
✅ **SEO-friendly:** Structure d'URLs propre et logique
✅ **Expérience utilisateur:** Navigation fluide entre produits et boutiques

## Prochaines étapes recommandées

1. **Configurer votre domaine** (remplacer `votresite.com`)
2. **Tester les liens** sur différentes plateformes
3. **Ajouter Open Graph tags** pour de meilleurs aperçus sur les réseaux sociaux
4. **Configurer les liens profonds (Deep Links)** pour l'app mobile

## Notes techniques

- Le système utilise `expo-clipboard` pour copier les liens
- Les liens utilisent `expo-router` pour la navigation
- Compatible avec React Native Web
- Les boutiques n'affichent que les produits approuvés
