import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  useWindowDimensions,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MapPin, Phone, Star, Package, Calendar, ExternalLink, MessageCircle, Eye, Heart } from 'lucide-react-native';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useToast } from '@/contexts/ToastContext';
import { buildShopShareUrl, formatPrice, getDaysRemaining, isProductExpired } from '@/constants/appConfig';
import { shareContent } from '@/lib/share';
import OptimizedImage from '@/components/OptimizedImage';
import ProductSkeleton from '@/components/ProductSkeleton';

const MAX_CARD_WIDTH = 260;

export default function ShopScreen() {
  const { sellerId } = useLocalSearchParams();
  const router = useRouter();
  const { products, allUsers, getSellerRating, isAuthenticated, loadSellerStats, sellerStats } = useMarketplace();
  const toast = useToast();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min((screenWidth - 48) / 2, MAX_CARD_WIDTH);

  const seller = useMemo(() => {
    return allUsers.find(u => u.id === sellerId);
  }, [allUsers, sellerId]);

  const sellerProducts = useMemo(() => {
    return products.filter(p => p.sellerId === sellerId && p.status === 'approved' && !isProductExpired(p.createdAt));
  }, [products, sellerId]);

  const sellerRating = useMemo(() => {
    return seller ? getSellerRating(seller.id) : { average: 0, count: 0 };
  }, [seller, getSellerRating]);

  const [displayCount, setDisplayCount] = useState<number>(5);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  const displayedProducts = useMemo(() => {
    return sellerProducts.slice(0, displayCount);
  }, [sellerProducts, displayCount]);

  const hasMore = displayCount < sellerProducts.length;

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 80;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isCloseToBottom && hasMore) {
      setDisplayCount(prev => Math.min(prev + 5, sellerProducts.length));
    }
  }, [hasMore, sellerProducts.length]);

  useEffect(() => {
    if (allUsers.length > 0 || products.length > 0) {
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [allUsers.length, products.length]);

  useEffect(() => {
    if (sellerId) {
      loadSellerStats(sellerId as string);
    }
  }, [sellerId]);

  useEffect(() => {
    if (Platform.OS === 'web' && seller) {
      const metaTitle = document.querySelector('meta[property="og:title"]');
      const metaDescription = document.querySelector('meta[property="og:description"]');
      const metaImage = document.querySelector('meta[property="og:image"]');
      const metaUrl = document.querySelector('meta[property="og:url"]');

      if (metaTitle) metaTitle.setAttribute('content', `Boutique de ${seller.name}`);
      if (metaDescription) metaDescription.setAttribute('content', `Découvrez les produits de ${seller.name} sur Teranga Market`);
      if (metaImage) metaImage.setAttribute('content', seller.avatar);
      if (metaUrl) metaUrl.setAttribute('content', buildShopShareUrl(seller.id));

      document.title = `Boutique de ${seller.name} - Teranga Market`;
    }
  }, [seller]);

  if (isInitialLoad) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Chargement...', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <View style={styles.spinner}>
              <View style={styles.spinnerCircle} />
            </View>
            <Text style={styles.loadingText}>Chargement de la boutique...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!seller) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Boutique introuvable', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Boutique non trouvée</Text>
          <Text style={styles.errorSubtext}>Cette boutique n&apos;existe pas ou a été supprimée</Text>
        </View>
      </View>
    );
  }

  const handleContactWhatsApp = () => {
    if (!isAuthenticated) {
      toast.showAlert(
        'Connexion requise',
        'Vous devez être connecté pour contacter le vendeur.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }

    const message = encodeURIComponent(
      `Bonjour, je suis intéressé par vos produits sur votre boutique.`
    );
    const whatsappUrl = `https://wa.me/${(seller.phone || '').replace(/[^0-9]/g, '')}?text=${message}`;
    Linking.canOpenURL(whatsappUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(whatsappUrl);
        }
      })
      .catch((err) => console.error('Error opening WhatsApp:', err));
  };

  const handleShareShop = async () => {
    try {
      const shopUrl = buildShopShareUrl(seller.id);
      const message = `🏪 Boutique de ${seller.name}\n\n` +
        `📍 ${seller.location}\n` +
        `⭐ Note: ${sellerRating.average > 0 ? sellerRating.average.toFixed(1) : 'Pas encore d\'avis'}\n` +
        `📦 ${sellerProducts.length} produit${sellerProducts.length > 1 ? 's' : ''} disponible${sellerProducts.length > 1 ? 's' : ''}\n\n` +
        `👉 ${shopUrl}`;

      const result = await shareContent(message);
      if (result.method === 'clipboard') {
        // Silently handled — clipboard copy is a valid fallback
      }
    } catch (error) {
      console.error('Error sharing shop:', error);
    }
  };

  const memberSince = seller.joinedDate
    ? new Date(seller.joinedDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : 'Récemment';

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: `Boutique de ${seller.name}`,
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareShop}
            >
              <ExternalLink size={22} color="#007AFF" />
            </TouchableOpacity>
          ),
        }} 
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        <View style={styles.header}>
          <Image source={{ uri: seller.avatar }} style={styles.avatar} />
          <View style={styles.headerInfo}>
            <Text style={styles.sellerName}>{seller.name}</Text>
            <View style={styles.infoRow}>
              <MapPin size={16} color="#666" />
              <Text style={styles.infoText}>{seller.location}</Text>
            </View>
            <View style={styles.infoRow}>
              <Phone size={16} color="#666" />
              <Text style={styles.infoText}>
                {isAuthenticated ? (seller.phone || 'Non renseigné') : `${(seller.phone || '**').substring(0, 2)} ** ** ** **`}
              </Text>
            </View>
            {sellerRating.count > 0 && (
              <View style={styles.ratingRow}>
                <Star size={16} color="#FFB800" fill="#FFB800" />
                <Text style={styles.ratingText}>
                  {sellerRating.average.toFixed(1)} ({sellerRating.count} avis)
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Package size={24} color="#1E3A8A" />
            <Text style={styles.statValue}>{sellerProducts.length}</Text>
            <Text style={styles.statLabel}>Produits</Text>
          </View>
          <View style={styles.statCard}>
            <Star size={24} color="#FFD700" />
            <Text style={styles.statValue}>
              {sellerRating.average > 0 ? sellerRating.average.toFixed(1) : '-'}
            </Text>
            <Text style={styles.statLabel}>Note</Text>
          </View>
          <View style={styles.statCard}>
            <Calendar size={24} color="#3B82F6" />
            <Text style={styles.statValue}>{memberSince.split(' ')[0]}</Text>
            <Text style={styles.statLabel}>Membre</Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Eye size={24} color="#0D2D5E" />
            <Text style={styles.statValue}>{sellerStats.totalViews}</Text>
            <Text style={styles.statLabel}>Vues</Text>
          </View>
          <View style={styles.statCard}>
            <MessageCircle size={24} color="#25D366" />
            <Text style={styles.statValue}>{sellerStats.totalWhatsAppClicks}</Text>
            <Text style={styles.statLabel}>Contacts</Text>
          </View>
          <View style={styles.statCard}>
            <Heart size={24} color="#E31B23" />
            <Text style={styles.statValue}>{sellerStats.totalFavorites}</Text>
            <Text style={styles.statLabel}>Favoris</Text>
          </View>
        </View>

        {seller.bio && (
          <View style={styles.bioSection}>
            <Text style={styles.bioTitle}>À propos</Text>
            <Text style={styles.bioText}>{seller.bio}</Text>
          </View>
        )}

        <View style={styles.contactSection}>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleContactWhatsApp}
          >
            <MessageCircle size={20} color="#25D366" fill="#25D366" />
            <Text style={styles.contactButtonText}>Contacter sur WhatsApp</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.productsSection}>
          <Text style={styles.sectionTitle}>Produits ({sellerProducts.length})</Text>
          
          {products.length === 0 ? (
            <View style={styles.skeletonContainer}>
              {Array.from({ length: 4 }).map((_, index) => (
                <ProductSkeleton key={`skeleton-${index}`} />
              ))}
            </View>
          ) : sellerProducts.length > 0 ? (
            <View style={styles.productsGrid}>
              {displayedProducts.map(product => (
                <TouchableOpacity
                  key={product.id}
                  style={[styles.productCard, { width: cardWidth }]}
                  onPress={() => router.push(`/product/${product.id}` as any)}
                  activeOpacity={0.7}
                >
                  <OptimizedImage uri={product.images[0]} style={[styles.productImage, { height: cardWidth }]} />
                  {product.hasDiscount && product.discountPercent && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>-{product.discountPercent}%</Text>
                    </View>
                  )}
                  {product.isOutOfStock && (
                    <View style={styles.outOfStockBadge}>
                      <Text style={styles.outOfStockText}>Rupture de stock</Text>
                    </View>
                  )}
                  <View style={styles.productInfo}>
                    <Text style={styles.productTitle} numberOfLines={2}>
                      {product.title}
                    </Text>
                    {product.hasDiscount && product.originalPrice ? (
                      <View style={styles.priceContainer}>
                        <Text style={styles.originalPrice}>{formatPrice(product.originalPrice)}</Text>
                        <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
                    )}
                    {product.averageRating && product.reviewCount && product.reviewCount > 0 && (
                      <View style={styles.productRating}>
                        <Star size={12} color="#FFB800" fill="#FFB800" />
                        <Text style={styles.productRatingText}>
                          {product.averageRating.toFixed(1)} ({product.reviewCount})
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          
          {hasMore && (
            <View style={styles.loadingMore}>
              <Text style={styles.loadingMoreText}>Chargement...</Text>
            </View>
          )}
          
          {sellerProducts.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📦</Text>
              <Text style={styles.emptyStateText}>Aucun produit disponible</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f5f5f5',
  },
  headerInfo: {
    flex: 1,
    gap: 6,
  },
  sellerName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#000',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#000',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingTop: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  bioSection: {
    padding: 16,
    paddingTop: 0,
  },
  bioTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  contactSection: {
    padding: 16,
    paddingTop: 0,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E8F9F0',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#25D366',
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#25D366',
  },
  productsSection: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 16,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  productImage: {
    width: '100%',
    backgroundColor: '#f5f5f5',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#E31B23',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  outOfStockText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
  },
  productInfo: {
    padding: 12,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 4,
    height: 36,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalPrice: {
    fontSize: 13,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1E3A8A',
  },
  productRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  productRatingText: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  loadingContent: {
    alignItems: 'center',
    gap: 24,
  },
  spinner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#B3D9E6',
    borderTopColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#E8F4F8',
    borderTopColor: '#00A651',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1E3A8A',
  },
  shareButton: {
    marginRight: 16,
    padding: 8,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingMoreText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600' as const,
  },
  skeletonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
});
