import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Phone, Package, Crown, LogOut, Star, MoreVertical, Shield, Clock, CheckCircle, XCircle, ExternalLink, Camera, User } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { Product } from '@/types/marketplace';
import { formatPrice, getDaysRemaining, isProductExpired, PRODUCT_EXPIRY_DAYS, buildProductShareUrl, buildShopShareUrl } from '@/constants/appConfig';
import { shareContent } from '@/lib/share';
import { useToast } from '@/contexts/ToastContext';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';
import * as ImagePicker from 'expo-image-picker';

const isWeb = Platform.OS === 'web';

function getProductCardWidth(width: number) {
  if (width < 600) {
    const containerPadding = 16;
    const gap = 12;
    const columns = 2;
    const availableWidth = width - (containerPadding * 2);
    const totalGapWidth = gap * (columns - 1);
    return (availableWidth - totalGapWidth) / columns;
  } else if (width < 900) {
    return (width - 80) / 3;
  } else if (width < 1200) {
    return (width - 120) / 4;
  } else {
    return (1600 - 160) / 5;
  }
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, userProducts, logout, getSellerRating, deleteProduct, updateUser, renewProduct } = useMarketplace();
  const toast = useToast();
  const { globalSettings } = useGlobalSettings();
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = React.useMemo(() => getProductCardWidth(screenWidth), [screenWidth]);

  if (!currentUser) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <View style={styles.loginPromptContainer}>
          <View style={styles.loginIconContainer}>
            <User size={48} color="#00853F" />
          </View>
          <Text style={styles.loginTitle}>Connexion requise</Text>
          <Text style={styles.loginSubtitle}>
            Connectez-vous pour accéder à votre profil, gérer vos annonces et suivre vos commandes.
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.loginButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleChangeProfilePicture = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        toast.showError('Permission d\'accès à la galerie est requise');
        return;
      }

      toast.showAlert(
        'Changer la photo de profil',
        'Choisissez une option',
        [
          {
            text: 'Prendre une photo',
            onPress: async () => {
              const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
              if (cameraPermission.granted === false) {
                toast.showError('Permission d\'accès à la caméra est requise');
                return;
              }
              
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
              });

              if (!result.canceled && result.assets[0]) {
                await uploadProfilePicture(result.assets[0].uri);
              }
            },
          },
          {
            text: 'Choisir de la galerie',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
              });

              if (!result.canceled && result.assets[0]) {
                await uploadProfilePicture(result.assets[0].uri);
              }
            },
          },
          {
            text: 'Annuler',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error changing profile picture:', error);
      toast.showError('Erreur lors du changement de photo');
    }
  };

  const uploadProfilePicture = async (uri: string) => {
    try {
      setIsUploadingImage(true);
      
      const base64 = await fetch(uri)
        .then(res => res.blob())
        .then(blob => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        });

      const result = await updateUser({ avatar: base64 });
      
      if (result && result.success) {
        toast.showSuccess('Photo de profil mise à jour');
      } else {
        toast.showError(result?.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.showError('Erreur lors du téléchargement de l\'image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleLogout = () => {
    toast.showAlert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const toggleAdminMode = () => {
    const newAdminStatus = !currentUser.isAdmin;
    toast.showAlert(
      newAdminStatus ? 'Activer le mode Admin' : 'Désactiver le mode Admin',
      newAdminStatus 
        ? 'Vous aurez accès au panneau d\'administration pour gérer les commandes.'
        : 'Vous n\'aurez plus accès au panneau d\'administration.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: newAdminStatus ? 'Activer' : 'Désactiver',
          onPress: async () => {
            const result = await updateUser({ isAdmin: newAdminStatus });
            if (result && result.success) {
              toast.showSuccess(`Mode Admin ${newAdminStatus ? 'activé' : 'désactivé'}`);
            } else {
              toast.showError(result?.error || 'Erreur lors de la mise à jour du mode admin');
            }
          },
        },
      ]
    );
  };

  const handleEditProduct = (productId: string) => {
    router.push(`/product/edit/${productId}` as any);
  };

  const handleDeleteProduct = (productId: string, productTitle: string) => {
    toast.showAlert(
      'Supprimer l\'annonce',
      `Êtes-vous sûr de vouloir supprimer "${productTitle}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteProduct(productId);
            toast.showSuccess('L\'annonce a été supprimée');
          },
        },
      ]
    );
  };

  const handleShareShop = async () => {
    try {
      const shopUrl = buildShopShareUrl(currentUser.id);
      const message = `🏪 Ma Boutique sur Teranga Market\n\n` +
        `👤 ${currentUser.name}\n` +
        `📍 ${currentUser.location}\n` +
        `📦 ${userProducts.length} produit${userProducts.length > 1 ? 's' : ''} disponible${userProducts.length > 1 ? 's' : ''}\n\n` +
        `Découvrez tous mes produits ici:\n${shopUrl}`;

      const result = await shareContent(message);
      if (result.method === 'clipboard') {
        toast.showSuccess('Lien copié dans le presse-papiers !');
      }
    } catch (error) {
      console.error('Error sharing shop:', error);
      toast.showError('Impossible de partager la boutique.');
    }
  };

  const handleShareProduct = async (product: Product) => {
    try {
      const productUrl = buildProductShareUrl(product.id);
      const message = `🛍️ ${product.title}\n\n` +
        `💰 Prix: ${formatPrice(product.price)}\n` +
        `📍 Localisation: ${product.location}\n\n` +
        `${product.description}\n\n` +
        `👉 Voir ce produit: ${productUrl}`;

      const result = await shareContent(message);
      if (result.method === 'clipboard') {
        toast.showSuccess('Lien copié dans le presse-papiers !');
      }
    } catch (error) {
      console.error('Error sharing product:', error);
      toast.showError('Impossible de partager ce produit.');
    }
  };

  const handleRenewProduct = async (productId: string, productTitle: string) => {
    const result = await renewProduct(productId);
    if (result?.success) {
      toast.showSuccess(`✅ « ${productTitle} » renouvelé pour ${PRODUCT_EXPIRY_DAYS} jours !`);
    } else {
      toast.showError('Impossible de renouveler l\'annonce.');
    }
  };

  const handleProductOptions = (product: Product) => {
    const daysLeft = getDaysRemaining(product.createdAt);
    const isExpired = isProductExpired(product.createdAt);
    const options: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' | 'default' }> = [
      {
        text: 'Partager',
        onPress: () => handleShareProduct(product),
      },
      {
        text: 'Modifier',
        onPress: () => handleEditProduct(product.id),
      },
    ];

    if (isExpired || daysLeft <= 5) {
      options.push({
        text: isExpired ? '🔄 Renouveler (gratuit)' : `🔄 Renouveler (${daysLeft}j restant)`,
        onPress: () => handleRenewProduct(product.id, product.title),
      });
    }

    options.push(
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => handleDeleteProduct(product.id, product.title),
      },
      {
        text: 'Annuler',
        style: 'cancel',
      }
    );

    toast.showAlert(product.title, 'Que voulez-vous faire ?', options);
  };

  const getProductStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'En attente', color: '#FFA500', icon: Clock };
      case 'approved':
        return { label: 'Approuv\u00e9', color: '#3B82F6', icon: CheckCircle };
      case 'rejected':
        return { label: 'Rejet\u00e9', color: '#E31B23', icon: XCircle };
      default:
        return { label: 'Approuv\u00e9', color: '#3B82F6', icon: CheckCircle };
    }
  };

  const renderProductCard = (product: Product) => {
    const statusInfo = getProductStatusInfo(product.status);
    const StatusIcon = statusInfo.icon;
    // cardWidth comes from useMemo above
    const daysLeft = getDaysRemaining(product.createdAt);
    const isExpired = isProductExpired(product.createdAt);
    const isExpiringSoon = daysLeft <= 5 && daysLeft > 0;

    return (
      <View key={product.id} style={[styles.productCard, { width: cardWidth }]}>
        <TouchableOpacity
          onPress={() => router.push(`/product/${product.id}` as any)}
          activeOpacity={0.7}
          style={styles.productCardContent}
        >
          <Image 
            source={{ uri: product.images[0] }} 
            style={[styles.productImage, { height: cardWidth * 1.1 }]}
          />
          <View style={[styles.productStatusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <StatusIcon size={12} color={statusInfo.color} />
            <Text style={[styles.productStatusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
          {isExpired ? (
            <View style={styles.productExpiredBadge}>
              <Text style={styles.productExpiredText}>Expiré</Text>
            </View>
          ) : isExpiringSoon ? (
            <View style={styles.productExpirySoonBadge}>
              <Clock size={10} color="#E31B23" />
              <Text style={styles.productExpirySoonText}>{daysLeft}j restant{daysLeft > 1 ? 's' : ''}</Text>
            </View>
          ) : null}
          <View style={styles.productInfo}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {product.title}
            </Text>
            <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
            {product.status === 'rejected' && product.rejectionReason && (
              <Text style={styles.productRejectionReason} numberOfLines={2}>
                ❌ {product.rejectionReason}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.productOptionsButton}
          onPress={() => handleProductOptions(product)}
          activeOpacity={0.7}
        >
          <MoreVertical size={20} color="#666" />
        </TouchableOpacity>
      </View>
    );
  };

  const sellerRating = getSellerRating(currentUser.id);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: currentUser.avatar }} style={styles.avatar} />
              <TouchableOpacity 
                style={styles.changePictureButton} 
                onPress={handleChangeProfilePicture}
                activeOpacity={0.7}
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Camera size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{currentUser.name}</Text>
                {currentUser.type === 'premium' && (
                  <View style={styles.premiumBadge}>
                    <Crown size={12} color="#FFD700" fill="#FFD700" />
                    <Text style={styles.premiumText}>Premium</Text>
                  </View>
                )}
              </View>
              <View style={styles.infoRow}>
                <MapPin size={14} color="#666" />
                <Text style={styles.infoText}>{currentUser.location}</Text>
              </View>
              <View style={styles.infoRow}>
                <Phone size={14} color="#666" />
                <Text style={styles.infoText}>{currentUser.phone}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.shareShopButton} onPress={handleShareShop}>
            <ExternalLink size={16} color="#00853F" />
            <Text style={styles.shareShopButtonText}>Partager ma boutique</Text>
          </TouchableOpacity>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LogOut size={16} color="#FF3B30" />
              <Text style={styles.logoutButtonText}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
          {currentUser.isSuperAdmin && (
            <TouchableOpacity 
              style={currentUser.isAdmin ? styles.adminButtonActive : styles.adminButton} 
              onPress={toggleAdminMode}
            >
              <Shield size={16} color={currentUser.isAdmin ? "#fff" : "#00853F"} />
              <Text style={currentUser.isAdmin ? styles.adminButtonTextActive : styles.adminButtonText}>
                {currentUser.isAdmin ? 'Mode Admin Activé' : 'Activer Mode Admin'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Package size={20} color="#000" />
            <Text style={styles.sectionTitle}>Mes annonces</Text>
            <Text style={styles.sectionCount}>
              ({userProducts.length})
            </Text>
          </View>

          <View style={styles.expiryInfoBanner}>
            <Clock size={16} color="#00853F" />
            <Text style={styles.expiryInfoText}>
              ⏱️ Chaque annonce reste visible {PRODUCT_EXPIRY_DAYS} jours. Un compte à rebours s'affiche sur chaque produit. Renouvellement gratuit et illimité via le menu ⋮
            </Text>
          </View>

          {userProducts.length > 0 ? (
            <View style={styles.productsGrid}>
              {userProducts.map(renderProductCard)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📦</Text>
              <Text style={styles.emptyStateText}>Aucune annonce</Text>
              <Text style={styles.emptyStateSubtext}>
                Commencez à vendre vos produits
              </Text>
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
    backgroundColor: '#FFF8F0',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: isWeb ? 20 : 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5B7',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f5f5f5',
  },
  changePictureButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#00853F',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  profileInfo: {
    flex: 1,
    gap: 6,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#000',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFD700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  upgradeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF9E6',
    paddingVertical: isWeb ? 14 : 12,
    paddingHorizontal: isWeb ? 20 : 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
    minHeight: isWeb ? 52 : 48,
  },
  upgradeButtonText: {
    fontSize: isWeb ? 16 : 15,
    fontWeight: '700' as const,
    color: '#B8860B',
  },
  logoutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF5F5',
    paddingVertical: isWeb ? 14 : 12,
    paddingHorizontal: isWeb ? 20 : 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    minHeight: isWeb ? 52 : 48,
  },
  logoutButtonText: {
    fontSize: isWeb ? 16 : 15,
    fontWeight: '700' as const,
    color: '#FF3B30',
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
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingHorizontal: isWeb ? 20 : 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E8D5B7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
  section: {
    paddingHorizontal: isWeb ? 20 : 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
  },
  sectionCount: {
    fontSize: 16,
    color: '#666',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
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
    position: 'relative',
  },
  productCardContent: {
    width: '100%',
  },
  productOptionsButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: {
    width: '100%',
    backgroundColor: '#f5f5f5',
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
  productPrice: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#E63946',
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
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF8F0',
    paddingVertical: isWeb ? 14 : 12,
    paddingHorizontal: isWeb ? 20 : 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00853F',
    marginTop: 12,
    minHeight: isWeb ? 52 : 48,
  },
  adminButtonActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00853F',
    paddingVertical: isWeb ? 14 : 12,
    paddingHorizontal: isWeb ? 20 : 16,
    borderRadius: 12,
    marginTop: 12,
    minHeight: isWeb ? 52 : 48,
  },
  adminButtonText: {
    fontSize: isWeb ? 16 : 15,
    fontWeight: '700' as const,
    color: '#00853F',
  },
  adminButtonTextActive: {
    fontSize: isWeb ? 16 : 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  productStatusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  productStatusText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  productExpiredBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  productExpiredText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  productExpirySoonBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(227,27,35,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 1,
  },
  productExpirySoonText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  productRejectionReason: {
    fontSize: 11,
    color: '#E31B23',
    marginTop: 4,
  },
  pendingBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF9F0',
    paddingVertical: isWeb ? 14 : 12,
    paddingHorizontal: isWeb ? 20 : 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFA500',
    minHeight: isWeb ? 52 : 48,
  },
  pendingBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFA500',
  },
  shareShopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF8F0',
    paddingVertical: isWeb ? 14 : 12,
    paddingHorizontal: isWeb ? 20 : 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00853F',
    marginTop: 12,
    minHeight: isWeb ? 52 : 48,
  },
  freeBadgeContainer: {
    backgroundColor: '#00853F',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  freeBadgeText: {
    color: '#FDEF42',
    fontSize: 13,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  shareShopButtonText: {
    fontSize: isWeb ? 16 : 15,
    fontWeight: '700' as const,
    color: '#00853F',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginPromptContainer: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    gap: 16,
  },
  loginIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: '#00853F',
    paddingVertical: isWeb ? 18 : 16,
    paddingHorizontal: isWeb ? 40 : 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#00853F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minHeight: isWeb ? 56 : 52,
    justifyContent: 'center',
  },
  loginButtonText: {
    fontSize: isWeb ? 18 : 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  freeBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: isWeb ? 20 : 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#00853F',
  },
  expiryInfoBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDEF42',
  },
  expiryInfoText: {
    fontSize: 12,
    color: '#7A6B00',
    flex: 1,
    lineHeight: 17,
    fontWeight: '500' as const,
  },
  freeBannerIcon: {
    fontSize: 28,
  },
  freeBannerText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#00853F',
    flex: 1,
  },
  _oldCommission: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 12,
    lineHeight: 18,
  },
  commissionHighlight: {
    fontWeight: '800' as const,
    color: '#E31B23',
    fontSize: 14,
  },
  commissionList: {
    gap: 6,
  },
  commissionListItem: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  revenueContainer: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: isWeb ? 20 : 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  revenueHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 12,
  },
  revenueTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  revenueDetails: {
    gap: 8,
  },
  revenueRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 4,
  },
  revenueRowTotal: {
    borderTopWidth: 2,
    borderTopColor: '#10B981',
    marginTop: 8,
    paddingTop: 12,
  },
  revenueLabel: {
    fontSize: 14,
    color: '#065F46',
  },
  revenueValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#065F46',
  },
  revenueNegative: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  revenueLabelTotal: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#064E3B',
  },
  revenueTotal: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#10B981',
  },
  revenueNote: {
    fontSize: 12,
    color: '#065F46',
    marginTop: 12,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
  },
});

