import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MapPin, ShoppingCart, Star, Share2, MessageCircle, Edit, Store, Clock, Link2, X, ChevronLeft, ChevronRight, Gift, AlertTriangle, Image as ImageIcon } from 'lucide-react-native';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { formatPrice, buildProductShareUrl, getDaysRemaining, isProductExpired, PRODUCT_EXPIRY_DAYS } from '@/constants/appConfig';
import { shareContent } from '@/lib/share';
import { supabase } from '@/lib/supabase';
import { Product, Category, SubCategory, ProductStatus, ListingType, SaleType } from '@/types/marketplace';

const MAX_IMAGE_WIDTH = 600;

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const { products, toggleFavorite, isFavorite, getProductReviews, getProductRating, getSellerRating, isAuthenticated, currentUser, incrementProductStat } = useMarketplace();
  const { addToCart, isInCart, getCartItemsCount } = useCart();
  const toast = useToast();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const responsiveImageWidth = Math.min(screenWidth, MAX_IMAGE_WIDTH);

  const [showAllReviews, setShowAllReviews] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);

  const product = products.find(p => p.id === id) || fetchedProduct || null;
  const productImages = product && Array.isArray(product.images) ? product.images : [];

  useEffect(() => {
    if (product) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
      return () => clearTimeout(timer);
    } else if (id) {
      const fetchProduct = async () => {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();
          if (data && !error) {
            const fetched: Product = {
              id: data.id,
              title: data.title,
              description: data.description,
              price: parseFloat(data.price),
              images: Array.isArray(data.images) ? data.images : [],
              category: data.category as Category,
              subCategory: data.sub_category as SubCategory | undefined,
              location: data.location,
              sellerId: data.seller_id,
              sellerName: data.seller_name,
              sellerAvatar: data.seller_avatar,
              sellerPhone: data.seller_phone,
              createdAt: new Date(data.created_at),
              condition: data.condition,
              status: data.status as ProductStatus,
              listingType: data.listing_type as ListingType,
              serviceDetails: data.service_details,
              stockQuantity: data.stock_quantity,
              isOutOfStock: data.is_out_of_stock,
              hasDiscount: data.has_discount,
              discountPercent: data.discount_percent,
              originalPrice: data.original_price ? parseFloat(data.original_price) : undefined,
              isDonation: data.is_donation ?? false,
              saleType: data.sale_type as SaleType | undefined,
            };
            setFetchedProduct(fetched);
          }
        } catch (e) {
          console.error('Error fetching product:', e);
        }
        setIsTransitioning(false);
      };
      fetchProduct();
    } else {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [product, id]);

  useEffect(() => {
    if (product) {
      incrementProductStat(product.id, 'view_count', 1);
    }
  }, [product?.id]);

  useEffect(() => {
    if (Platform.OS === 'web' && product) {
      const metaTitle = document.querySelector('meta[property="og:title"]');
      const metaDescription = document.querySelector('meta[property="og:description"]');
      const metaImage = document.querySelector('meta[property="og:image"]');
      const metaUrl = document.querySelector('meta[property="og:url"]');

      if (metaTitle) metaTitle.setAttribute('content', product.title);
      if (metaDescription) metaDescription.setAttribute('content', product.description);
      if (metaImage && productImages.length > 0) metaImage.setAttribute('content', productImages[0]);
      if (metaUrl) metaUrl.setAttribute('content', buildProductShareUrl(product.id));

      document.title = `${product.title} - Teranga Market`;
    }
  }, [product]);

  const productReviews = product ? getProductReviews(product.id) : [];
  const productRating = product ? getProductRating(product.id) : { average: 0, count: 0 };
  const sellerRating = product ? getSellerRating(product.sellerId) : { average: 0, count: 0 };

  const displayedReviews = showAllReviews ? productReviews : productReviews.slice(0, 2);

  const isAdmin = currentUser?.isAdmin === true;
  const isSuperAdmin = currentUser?.isSuperAdmin === true;
  const canViewAndEdit = isAdmin || isSuperAdmin;
  const canViewFullPhone = isAdmin || isSuperAdmin;

  const maskPhoneNumber = (phone: string) => {
    if (canViewFullPhone) return phone;
    if (phone.length <= 4) return phone;
    const visiblePart = phone.slice(0, 4);
    const maskedPart = '•'.repeat(phone.length - 4);
    return `${visiblePart}${maskedPart}`;
  };

  const isLoading = products.length === 0 && !fetchedProduct;

  if (isLoading || isTransitioning) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Chargement...', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <View style={styles.spinner}>
              <View style={styles.spinnerCircle} />
            </View>
            <Text style={styles.loadingText}>Chargement du produit...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!product && !isTransitioning) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Produit introuvable', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Produit non trouvé</Text>
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Chargement...', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <View style={styles.spinner}>
              <View style={styles.spinnerCircle} />
            </View>
            <Text style={styles.loadingText}>Chargement du produit...</Text>
          </View>
        </View>
      </View>
    );
  }

  const favorite = isFavorite(product.id);

  const getPriceDisplay = () => {
    if (product.isDonation || product.saleType === 'donation') {
      return (
        <View style={styles.donationDisplay}>
          <Gift size={22} color="#E31B23" />
          <Text style={styles.donationDisplayText}>Don gratuit</Text>
        </View>
      );
    }
    if (product.listingType === 'service' && product.serviceDetails) {
      if (product.serviceDetails.pricePerKg) {
        return `${formatPrice(product.serviceDetails.pricePerKg)}/kg`;
      }
      if (product.serviceDetails.tripPrice) {
        return `${formatPrice(product.serviceDetails.tripPrice)} (trajet)`;
      }
    }

    const hasDiscount = product.hasDiscount && product.discountPercent && product.discountPercent > 0;
    if (hasDiscount && product.originalPrice) {
      const discountedPrice = product.originalPrice * (1 - (product.discountPercent || 0) / 100);
      return (
        <View style={styles.priceWithDiscount}>
          <Text style={styles.discountedPriceText}>{formatPrice(discountedPrice)}</Text>
          <View style={styles.discountInfo}>
            <Text style={styles.originalPriceText}>{formatPrice(product.originalPrice)}</Text>
            <View style={styles.discountBadgeInline}>
              <Text style={styles.discountBadgeInlineText}>-{product.discountPercent}%</Text>
            </View>
          </View>
        </View>
      );
    }

    return formatPrice(product.price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const handleContactSeller = () => {
    if (!isAuthenticated) {
      toast.showAlert(
        'Connexion requise',
        'Connectez-vous pour contacter le vendeur.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Se connecter',
            onPress: () => {
              if (Platform.OS === 'web') {
                localStorage.setItem('redirectAfterLogin', `/product/${id}`);
              } else {
                AsyncStorage.setItem('redirectAfterLogin', `/product/${id}`);
              }
              router.push('/auth/login');
            },
          },
        ]
      );
      return;
    }

    const isDonation = product.isDonation || product.saleType === 'donation';
    const message = encodeURIComponent(
      `Bonjour, je suis intéressé par ${isDonation ? 'votre don' : 'votre annonce'}:\n\n` +
      `${product.title}\n` +
      (isDonation ? '' : `Prix: ${formatPrice(product.price)}\n`) +
      `Localisation: ${product.location}\n\n` +
      `Pouvez-vous me donner plus d'informations ?`
    );
    const phoneDigits = product.sellerPhone.replace(/[^0-9]/g, '');
    if (!phoneDigits) {
      toast.showError('Le vendeur n\'a pas de numéro WhatsApp valide.');
      return;
    }
    const whatsappUrl = `https://wa.me/${phoneDigits}?text=${message}`;
    if (product) {
      incrementProductStat(product.id, 'whatsapp_click_count', 1);
    }

    if (Platform.OS === 'web') {
      window.open(whatsappUrl, '_blank');
    } else {
      Linking.openURL(whatsappUrl).catch((err) =>
        console.error('Error opening WhatsApp:', err)
      );
    }
  };

  const handleAddToCart = () => {
    if (product.isOutOfStock) {
      toast.showError('Ce produit n\'est plus disponible.');
      return;
    }

    addToCart(product, 1);
    toast.showSuccess('Produit ajouté au panier !');
  };

  const handleShare = async () => {
    try {
      const productUrl = buildProductShareUrl(product.id);
      const isDonation = product.isDonation || product.saleType === 'donation';
      const message = `🛍️ ${product.title}\n\n` +
        (isDonation ? `🎁 Don gratuit\n` : `💰 Prix: ${formatPrice(product.price)}\n`) +
        `📍 Localisation: ${product.location}\n\n` +
        `${product.description}\n\n` +
        `👉 ${productUrl}`;

      const result = await shareContent(message);
      if (result.method === 'clipboard') {
        toast.showSuccess('Lien copié dans le presse-papiers !');
      }
    } catch (error) {
      console.error('Error sharing product:', error);
      toast.showError('Impossible de partager ce produit.');
    }
  };

  const handleCopyLink = async () => {
    try {
      const productUrl = buildProductShareUrl(product.id);
      await Clipboard.setStringAsync(productUrl);
      toast.showSuccess('Lien copié dans le presse-papiers.');
    } catch (error) {
      console.error('Error copying link:', error);
      toast.showError('Impossible de copier le lien.');
    }
  };

  const openImageViewer = (index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const closeImageViewer = () => {
    setViewerVisible(false);
  };

  const goToPreviousImage = () => {
    setViewerIndex(prev => (prev === 0 ? productImages.length - 1 : prev - 1));
  };

  const goToNextImage = () => {
    setViewerIndex(prev => (prev === productImages.length - 1 ? 0 : prev + 1));
  };

  const getStatusDisplay = () => {
    switch (product.status) {
      case 'pending':
        return { label: 'En attente de validation', color: '#FFA500', bgColor: '#FFF9F0' };
      case 'approved':
        return { label: 'Approuvé', color: '#00A651', bgColor: '#E8F5E9' };
      case 'rejected':
        return { label: 'Rejeté', color: '#E31B23', bgColor: '#FFF5F5' };
      default:
        return { label: 'En attente de validation', color: '#FFA500', bgColor: '#FFF9F0' };
    }
  };

  const statusDisplay = getStatusDisplay();
  const daysLeft = getDaysRemaining(product.createdAt);
  const isExpired = isProductExpired(product.createdAt);
  const isExpiringSoon = daysLeft <= 7 && daysLeft > 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: canViewAndEdit && product.status !== 'approved' ? `${product.title} (${statusDisplay.label})` : product.title,
          headerShown: true,
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerCartButton}
                onPress={() => router.push('/cart')}
              >
                <ShoppingCart size={22} color="#00A651" />
                {getCartItemsCount() > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{getCartItemsCount()}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {canViewAndEdit && (
                <TouchableOpacity
                  style={styles.headerEditButton}
                  onPress={() => router.push(`/product/edit/${product.id}` as any)}
                >
                  <Edit size={22} color="#00A651" />
                </TouchableOpacity>
              )}
            </View>
          ),
        }}
      />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        {productImages.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={[styles.imagesCarousel, { height: Math.min(screenWidth * 0.75, 400) }]}
          >
            {productImages.map((image, index) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.95}
                onPress={() => openImageViewer(index)}
                style={styles.imageWrapper}
              >
                <Image source={{ uri: image }} style={[styles.productImage, { width: responsiveImageWidth, height: Math.min(screenWidth * 0.75, 400) }]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.noImagesBanner, { height: Math.min(screenWidth * 0.75, 400) }]}>
            <ImageIcon size={48} color="#999" />
            <Text style={styles.noImagesText}>Aucune image disponible</Text>
          </View>
        )}
        <View style={styles.imageThumbnails}>
          {productImages.map((image, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => openImageViewer(index)}
              style={styles.thumbnailButton}
              activeOpacity={0.8}
            >
              <Image source={{ uri: image }} style={styles.thumbnailImage} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoContainer}>
          {canViewAndEdit && product.status !== 'approved' && (
            <View style={[styles.adminStatusBanner, { backgroundColor: statusDisplay.bgColor, borderLeftColor: statusDisplay.color }]}>
              <Text style={[styles.adminStatusText, { color: statusDisplay.color }]}>
                📋 Statut : {statusDisplay.label}
              </Text>
              {product.status === 'rejected' && product.rejectionReason && (
                <Text style={styles.adminStatusSubtext}>
                  Raison : {product.rejectionReason}
                </Text>
              )}
            </View>
          )}
          {isExpired ? (
            <View style={styles.expiredBanner}>
              <Text style={styles.expiredBannerText}>⛔ Cette annonce a expiré (plus de {PRODUCT_EXPIRY_DAYS} jours)</Text>
            </View>
          ) : (
            <View style={[styles.expiryCountdown, isExpiringSoon && styles.expiryCountdownSoon]}>
              <Clock size={14} color={isExpiringSoon ? '#E31B23' : '#666'} />
              <Text style={[styles.expiryText, isExpiringSoon && styles.expiryTextSoon]}>
                {isExpiringSoon ? '⚠️ ' : ''}Disponible encore {daysLeft} jour{daysLeft > 1 ? 's' : ''}
              </Text>
            </View>
          )}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.productTitle}>{product.title}</Text>
              {typeof getPriceDisplay() === 'string' ? (
                <Text style={styles.productPrice}>{getPriceDisplay()}</Text>
              ) : (
                getPriceDisplay()
              )}
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleShare}
              >
                <Share2
                  size={22}
                  color="#00853F"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleCopyLink}
              >
                <Link2
                  size={22}
                  color="#00853F"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MapPin size={16} color="#666" />
              <Text style={styles.metaText}>{product.location}</Text>
            </View>
            {product.condition && (
              <View style={styles.conditionBadge}>
                <Text style={styles.conditionText}>
                  {product.condition === 'new' ? 'Neuf' : product.condition === 'used' ? 'Occasion' : 'Reconditionné'}
                </Text>
              </View>
            )}
            {product.category && (product.category === 'nourriture' || product.category === 'covoiturage') && null}
          </View>

          {product.listingType === 'product' && (
            <View style={styles.stockInfo}>
              {product.isOutOfStock ? (
                <View style={styles.stockBadgeOutOfStock}>
                  <Text style={styles.stockTextOutOfStock}>Rupture de stock</Text>
                </View>
              ) : product.stockQuantity !== undefined && product.stockQuantity > 0 ? (
                <View style={styles.stockBadgeInStock}>
                  <Text style={styles.stockTextInStock}>
                    {product.stockQuantity} {product.stockQuantity === 1 ? 'unité disponible' : 'unités disponibles'}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {product.listingType === 'service' && product.serviceDetails && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Détails du service</Text>
              <View style={styles.serviceDetails}>
                <View style={styles.serviceRow}>
                  <Text style={styles.serviceLabel}>Départ:</Text>
                  <Text style={styles.serviceValue}>{product.serviceDetails.departureLocation}</Text>
                </View>
                <View style={styles.serviceRow}>
                  <Text style={styles.serviceLabel}>Arrivée:</Text>
                  <Text style={styles.serviceValue}>{product.serviceDetails.arrivalLocation}</Text>
                </View>
                {product.serviceDetails.departureDate && (
                  <View style={styles.serviceRow}>
                    <Text style={styles.serviceLabel}>Date de départ:</Text>
                    <Text style={styles.serviceValue}>
                      {new Date(product.serviceDetails.departureDate).toLocaleString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                )}
                {product.serviceDetails.vehicleType && (
                  <View style={styles.serviceRow}>
                    <Text style={styles.serviceLabel}>Véhicule:</Text>
                    <Text style={styles.serviceValue}>{product.serviceDetails.vehicleType}</Text>
                  </View>
                )}
                {product.serviceDetails.availableSeats && (
                  <View style={styles.serviceRow}>
                    <Text style={styles.serviceLabel}>Places disponibles:</Text>
                    <Text style={styles.serviceValue}>{product.serviceDetails.availableSeats}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.fraudBanner}>
            <AlertTriangle size={24} color="#E31B23" />
            <View style={styles.fraudTextWrapper}>
              <Text style={styles.fraudTitle}>Signaler un imposteur</Text>
              <Text style={styles.fraudText}>
                Vous soupçonnez une arnaque ou un profil frauduleux ? Signalez-le sur le groupe WhatsApp Teranga Market.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vendeur</Text>
            <TouchableOpacity
              style={styles.sellerCard}
              onPress={() => router.push(`/shop/${product.sellerId}` as any)}
              activeOpacity={0.7}
            >
              <Image source={{ uri: product.sellerAvatar }} style={styles.sellerAvatar} />
              <View style={styles.sellerInfo}>
                <View style={styles.sellerNameRow}>
                  <Text style={styles.sellerName}>{product.sellerName}</Text>
                  <Store size={16} color="#00853F" />
                </View>
                {sellerRating.count > 0 && (
                  <View style={styles.ratingRow}>
                    <Star size={14} color="#FFB800" fill="#FFB800" />
                    <Text style={styles.ratingText}>
                      {sellerRating.average.toFixed(1)} ({sellerRating.count} avis)
                    </Text>
                  </View>
                )}
                <View style={styles.sellerMeta}>
                  <MapPin size={14} color="#666" />
                  <Text style={styles.sellerMetaText}>{product.location}</Text>
                </View>
                <Text style={styles.sellerPhone}>
                  📞 {maskPhoneNumber(product.sellerPhone)}
                </Text>
                <Text style={styles.sellerDate}>
                  Publié le {formatDate(product.createdAt)}
                </Text>
                <Text style={styles.viewShopText}>Voir la boutique ›</Text>
              </View>
            </TouchableOpacity>
          </View>

          {productReviews.length > 0 && (
            <View style={styles.section}>
              <View style={styles.reviewsHeader}>
                <Text style={styles.sectionTitle}>Avis</Text>
                {productRating.count > 0 && (
                  <View style={styles.ratingBadge}>
                    <Star size={16} color="#FFB800" fill="#FFB800" />
                    <Text style={styles.ratingBadgeText}>
                      {productRating.average.toFixed(1)}
                    </Text>
                    <Text style={styles.ratingCount}>({productRating.count})</Text>
                  </View>
                )}
              </View>

              {displayedReviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Image source={{ uri: review.userAvatar }} style={styles.reviewAvatar} />
                    <View style={styles.reviewHeaderInfo}>
                      <Text style={styles.reviewUserName}>{review.userName}</Text>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={12}
                            color="#FFB800"
                            fill={star <= review.rating ? '#FFB800' : 'transparent'}
                          />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.reviewDate}>
                      {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(review.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                </View>
              ))}

              {productReviews.length > 2 && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowAllReviews(!showAllReviews)}
                >
                  <Text style={styles.showMoreText}>
                    {showAllReviews ? 'Voir moins' : `Voir tous les avis (${productReviews.length})`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={viewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <View style={styles.viewerContainer}>
          <TouchableOpacity
            style={styles.viewerCloseButton}
            onPress={closeImageViewer}
            activeOpacity={0.7}
          >
            <X size={28} color="#fff" />
          </TouchableOpacity>
          <Image
            source={{ uri: productImages[viewerIndex] || '' }}
            style={styles.viewerImage}
            resizeMode="contain"
          />
          {productImages.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.viewerNavButton, styles.viewerNavLeft]}
                onPress={goToPreviousImage}
                activeOpacity={0.7}
              >
                <ChevronLeft size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewerNavButton, styles.viewerNavRight]}
                onPress={goToNextImage}
                activeOpacity={0.7}
              >
                <ChevronRight size={32} color="#fff" />
              </TouchableOpacity>
            </>
          )}
          <View style={styles.viewerIndicator}>
            <Text style={styles.viewerIndicatorText}>
              {productImages.length > 0 ? viewerIndex + 1 : 0} / {productImages.length}
            </Text>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <View style={styles.footerMainButtons}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.addToCartButton,
              (isInCart(product.id) || product.isOutOfStock) && styles.buttonDisabled
            ]}
            onPress={handleAddToCart}
            disabled={isInCart(product.id) || product.isOutOfStock}
          >
            <ShoppingCart size={22} color="#fff" />
            <Text style={styles.smallButtonText}>
              {product.isOutOfStock ? 'Rupture' : isInCart(product.id) ? 'Dans le panier' : 'Panier'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleContactSeller}
          >
            <MessageCircle size={24} color="#fff" />
            <Text style={styles.contactButtonText}>Contacter</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    paddingBottom: 180,
  },
  imagesCarousel: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MAX_IMAGE_WIDTH,
  },
  imageWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  imageThumbnails: {
    flexDirection: 'row' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  },
  thumbnailButton: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover' as const,
  },
  productImage: {
    backgroundColor: '#f5f5f5',
    resizeMode: 'contain',
  },
  infoContainer: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  productTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#00853F',
  },
  donationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFD0D0',
  },
  donationDisplayText: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#E31B23',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00853F',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#666',
  },
  conditionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#2A9D8F',
  },
  conditionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  sellerCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewShopText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#00853F',
    marginTop: 4,
  },
  sellerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  sellerInfo: {
    flex: 1,
    gap: 4,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
  },
  sellerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sellerMetaText: {
    fontSize: 13,
    color: '#666',
  },
  sellerPhone: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  sellerDate: {
    fontSize: 12,
    color: '#999',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#000',
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
  },
  ratingBadgeText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
  },
  ratingCount: {
    fontSize: 13,
    color: '#666',
  },
  reviewCard: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  reviewHeaderInfo: {
    flex: 1,
    gap: 4,
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#000',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  showMoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#00A651',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 8,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addToCartButton: {
    backgroundColor: '#00853F',
  },
  contactButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 8,
    backgroundColor: '#25D366',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  contactButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  smallButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.3,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
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
    borderColor: '#F0E6D7',
    borderTopColor: '#00853F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#FFF8F0',
    borderTopColor: '#2A9D8F',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#00853F',
  },
  footerMainButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceDetails: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  serviceLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
    flex: 1,
  },
  serviceValue: {
    fontSize: 14,
    color: '#000',
    flex: 2,
    textAlign: 'right',
  },
  stockInfo: {
    marginTop: 12,
    marginBottom: 12,
  },
  stockBadgeInStock: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#D4EDDA',
    borderWidth: 1,
    borderColor: '#28A745',
    alignSelf: 'flex-start',
  },
  stockTextInStock: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#155724',
  },
  stockBadgeOutOfStock: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8D7DA',
    borderWidth: 1,
    borderColor: '#DC3545',
    alignSelf: 'flex-start',
  },
  stockTextOutOfStock: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#721C24',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  priceWithDiscount: {
    gap: 8,
  },
  discountedPriceText: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#E31B23',
  },
  discountInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  originalPriceText: {
    fontSize: 18,
    fontWeight: '500' as const,
    color: '#999',
    textDecorationLine: 'line-through' as const,
  },
  discountBadgeInline: {
    backgroundColor: '#E31B23',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountBadgeInlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  headerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginRight: 8,
  },
  headerCartButton: {
    padding: 8,
    position: 'relative' as const,
  },
  cartBadge: {
    position: 'absolute' as const,
    top: 2,
    right: 2,
    backgroundColor: '#E31B23',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  headerEditButton: {
    padding: 8,
  },
  adminStatusBanner: {
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginBottom: 16,
  },
  adminStatusText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  adminStatusSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  expiryCountdown: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  expiryCountdownSoon: {
    backgroundColor: '#FFF3F3',
  },
  expiryText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500' as const,
  },
  expiryTextSoon: {
    color: '#E31B23',
    fontWeight: '700' as const,
  },
  expiredBanner: {
    backgroundColor: '#F8D7DA',
    borderLeftWidth: 4,
    borderLeftColor: '#E31B23',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  expiredBannerText: {
    fontSize: 14,
    color: '#721C24',
    fontWeight: '600' as const,
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '80%',
  },
  viewerCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
  },
  viewerNavButton: {
    position: 'absolute',
    top: '50%',
    zIndex: 10,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
  },
  viewerNavLeft: {
    left: 16,
  },
  viewerNavRight: {
    right: 16,
  },
  viewerIndicator: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewerIndicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  noImagesBanner: {
    width: '100%',
    maxWidth: MAX_IMAGE_WIDTH,
    alignSelf: 'center',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  noImagesText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600' as const,
  },
  fraudBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFD0D0',
  },
  fraudTextWrapper: {
    flex: 1,
    gap: 4,
  },
  fraudTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#E31B23',
  },
  fraudText: {
    fontSize: 13,
    color: '#721C24',
    lineHeight: 19,
    fontWeight: '500' as const,
  },
});
