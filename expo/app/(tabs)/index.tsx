import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import OptimizedImage, { prefetchImage } from '@/components/OptimizedImage';
import ProductSkeleton from '@/components/ProductSkeleton';
import ScrollingText from '@/components/ScrollingText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, MapPin, Sparkles, X, Heart, Share2, Gift } from 'lucide-react-native';
import { shareContent } from '@/lib/share';
import { useRouter } from 'expo-router';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';
import { categories, getSubCategoriesForCategory } from '@/constants/categories';
import { formatPrice, getDaysRemaining, isProductExpired, PRODUCT_EXPIRY_DAYS, buildProductShareUrl, APP_NAME, APP_TAGLINE } from '@/constants/appConfig';
import { Product } from '@/types/marketplace';

const isWeb = Platform.OS === 'web';

function getProductCardWidth(width: number) {
  if (width < 600) {
    const containerPadding = isWeb ? 20 : 16;
    const gap = 12;
    const columns = 2;
    const availableWidth = width - (containerPadding * 2);
    const totalGapWidth = gap * (columns - 1);
    return (availableWidth - totalGapWidth) / columns;
  } else if (width < 900) {
    return (width - 80) / 3;
  } else if (width < 1200) {
    return (width - 120) / 4;
  } else if (width < 1600) {
    const containerWidth = Math.min(width, 1600);
    return (containerWidth - 160) / 5;
  } else {
    return (1600 - 160) / 6;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { banners, globalPremiumMode, loadBanners, loadGlobalPremiumMode } = useGlobalSettings();
  const {
    products,
    productsLoadError,
    loadProducts,
    selectedCategory,
    setSelectedCategory,
    selectedSubCategory,
    setSelectedSubCategory,
    currentUser,
    toggleFavorite,
    isFavorite,
  } = useMarketplace();
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [displayCount, setDisplayCount] = useState<number>(10);
  const [isInitialRender, setIsInitialRender] = useState<boolean>(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState<number>(0);
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = useMemo(() => getProductCardWidth(screenWidth), [screenWidth]);
  const gridGap = screenWidth < 600 ? 12 : (screenWidth < 1200 ? 16 : 20);

  useEffect(() => {
    loadBanners();
    loadGlobalPremiumMode();
  }, [loadBanners, loadGlobalPremiumMode]);

  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [banners.length]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const isAdmin = currentUser?.isAdmin === true;
      const isSuperAdmin = currentUser?.isSuperAdmin === true;
      
      const isApproved = product.status === 'approved';
      const canViewNonApproved = isAdmin || isSuperAdmin;
      
      const matchesSearch = searchQuery.trim() === '' || 
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSubCategory = !selectedSubCategory || product.subCategory === selectedSubCategory;
      const isNotService = product.listingType !== 'service';
      
      const isNotExpired = !isProductExpired(product.createdAt) || canViewNonApproved;
      return (isApproved || canViewNonApproved) && isNotExpired && matchesSearch && matchesCategory && matchesSubCategory && isNotService;
    });
  }, [products, searchQuery, selectedCategory, selectedSubCategory, currentUser]);
  
  const sortedProducts = React.useMemo(() => {
    return [...filteredProducts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [filteredProducts]);

  const displayedProducts = useMemo(() => {
    return sortedProducts.slice(0, displayCount);
  }, [sortedProducts, displayCount]);

  useEffect(() => {
    if (isInitialRender) {
      setIsInitialRender(false);
      return;
    }
    const nextProducts = sortedProducts.slice(displayCount, displayCount + 10);
    nextProducts.forEach(product => {
      if (Array.isArray(product.images) && product.images.length > 0 && product.images[0]) {
        prefetchImage(product.images[0]);
      }
    });
  }, [displayCount, sortedProducts]);

  const hasMore = displayCount < sortedProducts.length;

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 150;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isCloseToBottom && hasMore) {
      setDisplayCount(prev => Math.min(prev + 10, sortedProducts.length));
    }
  }, [hasMore, sortedProducts.length]);

  const handleShareApp = useCallback(async () => {
    try {
      const shareUrl = typeof window !== 'undefined' && window.location
        ? window.location.origin
        : 'https://terangamarket.com';
      const message = `🇸🇳 ${APP_NAME} — ${APP_TAGLINE}\n\nVendez, achetez et donnez sur Teranga Market\n• Annonces illimitées\n• 3 photos par annonce\n\n👉 ${shareUrl}`;
      const result = await shareContent(message);
      if (result.method === 'clipboard') {
        // Show a toast or some feedback for clipboard copy
      }
    } catch (error) {
      console.error('Error sharing app:', error);
    }
  }, []);

  const renderProductCard = useCallback((product: Product) => {
    const isNew = (Date.now() - product.createdAt.getTime()) < 7 * 24 * 60 * 60 * 1000;
    const hasDiscount = product.hasDiscount && product.discountPercent && product.discountPercent > 0;
    
    const discountedPrice = hasDiscount && product.originalPrice 
      ? product.originalPrice * (1 - (product.discountPercent || 0) / 100)
      : product.price;

    const isDonation = product.isDonation || product.saleType === 'donation';
    const productIsFavorite = isFavorite(product.id);
    const daysLeft = getDaysRemaining(product.createdAt);
    const isExpiringSoon = daysLeft <= 5 && daysLeft > 0;

    return (
      <TouchableOpacity
        key={product.id}
        style={[styles.productCard, { width: cardWidth }]}
        onPress={() => router.push(`/product/${product.id}` as any)}
        activeOpacity={0.9}
      >
        <View style={styles.imageContainer}>
          <OptimizedImage 
            uri={product.images[0]} 
            style={[styles.productImage, { height: cardWidth * 1.2 }]}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(product.id);
            }}
            activeOpacity={0.7}
          >
            <Heart 
              size={20} 
              color={productIsFavorite ? "#E63946" : "#fff"} 
              fill={productIsFavorite ? "#E63946" : "transparent"}
            />
          </TouchableOpacity>
          {isDonation && (
            <View style={styles.donationBadge}>
              <Gift size={10} color="#fff" />
              <Text style={styles.donationBadgeText}>Don</Text>
            </View>
          )}
          {hasDiscount && !isDonation && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{product.discountPercent}%</Text>
            </View>
          )}
          {isNew && !hasDiscount && !isDonation && (
            <View style={styles.newBadge}>
              <Sparkles size={10} color="#fff" />
              <Text style={styles.newBadgeText}>Nouveau</Text>
            </View>
          )}
          {isExpiringSoon && (
            <View style={styles.expiryBadge}>
              <Text style={styles.expiryBadgeText}>{daysLeft}j restant{daysLeft > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          {product.size && (
            <Text style={styles.productSize}>Taille {product.size}</Text>
          )}
          <Text style={styles.productTitle} numberOfLines={2}>
            {product.title}
          </Text>
          {product.brand && (
            <Text style={styles.productBrand}>{product.brand}</Text>
          )}
          {isDonation ? (
            <Text style={styles.productDonationPrice}>Don gratuit</Text>
          ) : hasDiscount && product.originalPrice ? (
            <View style={styles.priceContainer}>
              <Text style={styles.discountedPrice}>{formatPrice(discountedPrice)}</Text>
              <Text style={styles.originalPrice}>{formatPrice(product.originalPrice)}</Text>
            </View>
          ) : (
            <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
          )}
          <View style={styles.locationRow}>
            <MapPin size={10} color="#999" />
            <Text style={styles.locationText} numberOfLines={1}>
              {product.location}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [router, isFavorite, toggleFavorite, cardWidth]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#00853F', '#006B32', '#00853F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + (isWeb ? 12 : 20) }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.headerLogoRow}>
              <Image
                source={{ uri: 'https://r2-pub.rork.com/attachments/e8zeao0aaslczraw1jrp3.png' }}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.headerTitle}>Teranga Market 🇸🇳</Text>
                <Text style={styles.headerSubtitle}>Sunu Marché — Diaspora sénégalaise</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleShareApp}
              activeOpacity={0.7}
            >
              <Share2 size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => setShowSearch(!showSearch)}
              activeOpacity={0.7}
            >
              <Search size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        
        {showSearch && (
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBar}>
              <Search size={18} color="#666" />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un article..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#999"
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={18} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </LinearGradient>

      {banners.length > 0 && (
        <ScrollingText
          text={banners[currentBannerIndex].message}
          textColor={banners[currentBannerIndex].textColor}
          backgroundColor={banners[currentBannerIndex].backgroundColor}
        />
      )}

      {globalPremiumMode?.isActive && (
        <ScrollingText
          text={`👑 ${globalPremiumMode.eventName} - ${globalPremiumMode.eventDescription} • Expire le ${new Date(globalPremiumMode.endsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
          textColor="#1a1a1a"
          backgroundColor="#FFD700"
        />
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((category, index) => {
          const isSelected = selectedCategory === category.id;
          return (
            <TouchableOpacity
              key={category.id || `category-${index}`}
              onPress={() => {
                setSelectedCategory(category.id);
                setSelectedSubCategory(undefined);
              }}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={isSelected ? category.gradient : ['#FFFFFF', '#FFFFFF']}
                style={[styles.categoryCard, !isSelected && styles.categoryCardInactive]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text
                  style={[
                    styles.categoryName,
                    isSelected && styles.categoryNameSelected
                  ]}
                >
                  {category.name}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedCategory !== 'all' && getSubCategoriesForCategory(selectedCategory).length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.subCategoriesContainer}
          contentContainerStyle={styles.subCategoriesContent}
        >
          <TouchableOpacity
            onPress={() => setSelectedSubCategory(undefined)}
            activeOpacity={0.7}
            style={[
              styles.subCategoryChip,
              !selectedSubCategory && styles.subCategoryChipSelected,
            ]}
          >
            <Text
              style={[
                styles.subCategoryText,
                !selectedSubCategory && styles.subCategoryTextSelected,
              ]}
            >
              Tous
            </Text>
          </TouchableOpacity>
          {getSubCategoriesForCategory(selectedCategory).map((subCat) => {
            const isSelected = selectedSubCategory === subCat.id;
            return (
              <TouchableOpacity
                key={subCat.id}
                onPress={() => setSelectedSubCategory(subCat.id)}
                activeOpacity={0.7}
                style={[
                  styles.subCategoryChip,
                  isSelected && styles.subCategoryChipSelected,
                ]}
              >
                <Text style={styles.subCategoryIcon}>{subCat.icon}</Text>
                <Text
                  style={[
                    styles.subCategoryText,
                    isSelected && styles.subCategoryTextSelected,
                  ]}
                >
                  {subCat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.productsContainer}
        contentContainerStyle={[styles.productsContent]}
        showsVerticalScrollIndicator={true}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        <View style={styles.productsHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'all' ? 'Tous les articles' : categories.find(c => c.id === selectedCategory)?.name}
          </Text>
          <Text style={styles.productsCount}>
            {displayedProducts.length} / {sortedProducts.length} {sortedProducts.length > 1 ? 'articles' : 'article'}
          </Text>
        </View>

        {products.length === 0 && !productsLoadError && (
          <View style={[styles.loadingContainer, { gap: gridGap }]}>
            {Array.from({ length: 6 }).map((_, index) => (
              <ProductSkeleton key={`skeleton-${index}`} />
            ))}
          </View>
        )}

        {products.length === 0 && productsLoadError && (
          <View style={styles.errorState}>
            <Text style={styles.errorStateIcon}>⚠️</Text>
            <Text style={styles.errorStateText}>Erreur de chargement</Text>
            <Text style={styles.errorStateSubtext}>
              Vérifiez votre connexion et réessayez
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadProducts()}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {products.length > 0 && sortedProducts.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🔍</Text>
            <Text style={styles.emptyStateText}>Aucun article trouvé</Text>
            <Text style={styles.emptyStateSubtext}>
              Essayez de modifier vos critères de recherche
            </Text>
          </View>
        )}

        {sortedProducts.length > 0 && (
          <View style={[styles.productsGrid, { gap: gridGap }]}>
            {displayedProducts.map(renderProductCard)}
          </View>
        )}

        {hasMore && (
          <View style={styles.loadingMore}>
            <Text style={styles.loadingMoreText}>Chargement...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#00853F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900' as const,
    color: '#FDEF42',
    marginBottom: 2,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700' as const,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    padding: 0,
  },
  categoriesContainer: {
    maxHeight: 100,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5B7',
  },
  categoriesContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  categoryCard: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 95,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryCardInactive: {
    borderWidth: 1,
    borderColor: '#E8D5B7',
  },
  categoryIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#666',
    letterSpacing: 0.2,
  },
  categoryNameSelected: {
    color: '#fff',
  },
  subCategoriesContainer: {
    maxHeight: 70,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5B7',
  },
  subCategoriesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  subCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#E8D5B7',
  },
  subCategoryChipSelected: {
    backgroundColor: '#00853F',
    borderColor: '#00853F',
  },
  subCategoryIcon: {
    fontSize: 16,
  },
  subCategoryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
  },
  subCategoryTextSelected: {
    color: '#fff',
  },
  productsContainer: {
    flex: 1,
  },
  productsContent: {
    paddingHorizontal: isWeb ? 20 : 16,
    paddingTop: 16,
    paddingBottom: 100,
    alignSelf: 'center',
    width: '100%',
    maxWidth: isWeb ? 1600 : undefined,
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  productsCount: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600' as const,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  loadingContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 20,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#f5f5f5',
  },
  productImage: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    resizeMode: 'cover' as const,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2A9D8F',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#E63946',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  donationBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E31B23',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  donationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.3,
  },
  expiryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#E31B23',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  expiryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 0.3,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  productInfo: {
    padding: 12,
  },
  productSize: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1a1a1a',
    marginBottom: 4,
    height: 34,
    lineHeight: 17,
  },
  productBrand: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#666',
    marginBottom: 6,
  },
  priceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#00853F',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  productDonationPrice: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#E31B23',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  discountedPrice: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#00853F',
    letterSpacing: -0.3,
  },
  originalPrice: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 10,
    color: '#999',
    flex: 1,
    fontWeight: '500' as const,
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
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  errorStateIcon: {
    fontSize: 48,
  },
  errorStateText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#E31B23',
  },
  errorStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#00853F',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },

});
