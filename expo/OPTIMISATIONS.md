# Optimisations de Performance

## Résumé des optimisations implémentées pour améliorer les performances avec connexion faible

### 1. **React Query avec Caching Agressif**
- Configuration avec `staleTime` de 5 minutes et `gcTime` de 30 minutes
- Mode `offlineFirst` pour fonctionner même hors ligne
- Retry automatique avec backoff exponentiel
- Évite les requêtes inutiles avec `refetchOnWindowFocus: false`

### 2. **Cache Local avec AsyncStorage**
- Cache des produits dans AsyncStorage/localStorage
- Chargement instantané des données en cache au démarrage
- Mise à jour en arrière-plan depuis Supabase
- Réduit drastiquement le temps de chargement initial

### 3. **Images Optimisées**
- Composant `OptimizedImage` avec lazy loading
- Placeholder pendant le chargement
- `progressiveRenderingEnabled` pour rendu progressif
- Gestion gracieuse des erreurs de chargement
- `fadeDuration` pour transitions douces

### 4. **Limitation des Requêtes**
- Limite initiale à 20 produits au lieu de 50
- Réduit la charge réseau et le temps de première requête

### 5. **Optimisations React**
- Utilisation de `useCallback` pour les fonctions de rendu
- `useMemo` pour les calculs coûteux
- `React.memo` implicite via les composants optimisés

### 6. **Optimisations de Rendu**
- FlatList avec `initialNumToRender={6}`
- `maxToRenderPerBatch={6}` pour charger par lots
- `windowSize={5}` pour optimiser la mémoire
- `removeClippedSubviews={true}` pour améliorer les performances

## Résultats Attendus

### Avec Connexion Faible (2G/3G)
- **Premier chargement**: 2-3 secondes (au lieu de 10-15 secondes)
- **Chargements suivants**: < 1 seconde (grâce au cache)
- **Scroll fluide**: 60 FPS maintenu
- **Chargement des images**: Progressif avec placeholders

### Mode Hors Ligne
- Affichage instantané des données en cache
- Synchronisation automatique quand la connexion revient

## Améliorations Futures Possibles

1. **Image CDN**: Utiliser un CDN avec optimisation automatique (Cloudinary, imgix)
2. **WebP Format**: Convertir les images en WebP pour réduire la taille
3. **Infinite Scroll**: Charger plus de produits à la demande
4. **Service Worker**: Pour le web, mettre en cache les assets statiques
5. **Compression Brotli**: Activer la compression sur Supabase si possible
6. **Image Thumbnails**: Charger des miniatures d'abord, puis haute résolution au besoin
