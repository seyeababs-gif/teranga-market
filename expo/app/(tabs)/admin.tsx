import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  CheckCircle, 
  XCircle, 
  Package, 
  Clock, 
  Truck, 
  CheckCheck, 
  ShieldAlert,
  Users,
  Edit,
  Trash2,
  AlertCircle,
  Crown,
  Shield,
  ShieldCheck,
  ChevronDown,
  UserPlus,
  Copy,
  Gift,
} from 'lucide-react-native';
import { useOrders } from '@/contexts/OrderContext';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useToast } from '@/contexts/ToastContext';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';
import { usePartners } from '@/contexts/PartnersContext';
import { Order, OrderStatus, Product, User } from '@/types/marketplace';
import { formatPrice } from '@/constants/appConfig';

import { 
  getDimensions,
  getProductCardWidth,
  isWeb,
  getContainerPadding,

  getButtonHeight,
  getButtonFontSize,
} from '@/constants/responsive';

type TabType = 'orders' | 'products' | 'users' | 'settings' | 'partners';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { orders, updateOrderStatus, deleteOrder, deleteAllUserOrders } = useOrders();
  const toast = useToast();
  const { 
    currentUser, 
    isAuthenticated, 
    pendingProducts,
    products,
    approveProduct,
    rejectProduct,
    deleteProduct,
    allUsers,
    changeUserType,
    deleteUser,
    approvePremiumUpgrade,
    rejectPremiumUpgrade,
    toggleAdminStatus,
    togglePartnerStatus,
  } = useMarketplace();
  const { partners, isLoading: partnersLoading } = usePartners();
  const [selectedFilter, setSelectedFilter] = useState<OrderStatus | 'all' | 'pending'>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabType>('products');

  // Rejection Modal State
  const [rejectModal, setRejectModal] = useState<{
    visible: boolean;
    type: 'order' | 'product' | null;
    targetId: string | null;
    targetTitle?: string;
  }>({ visible: false, type: null, targetId: null });
  const [rejectionReason, setRejectionReason] = useState('');

  const {
    globalSettings,
    discountCodes,
    banners,
    globalPremiumMode,
    loadBanners,
    loadGlobalPremiumMode,
    loadDiscountCodes,
    loadPartners,
    loadGlobalSettings,
    createDiscountCode,
    deleteDiscountCode,
    createBanner,
    deleteBanner,
    createGlobalPremiumMode,
    disableGlobalPremiumMode,
    updateGlobalSettings,
  } = useGlobalSettings();

  const [codeModal, setCodeModal] = useState(false);
  const [newCode, setNewCode] = useState('');

  const [bannerModal, setBannerModal] = useState(false);
  const [newBannerMsg, setNewBannerMsg] = useState('');
  const [newBannerBg, setNewBannerBg] = useState('#00853F');
  const [newBannerColor, setNewBannerColor] = useState('#FFFFFF');

  const [premiumModal, setPremiumModal] = useState(false);
  const [premiumEventName, setPremiumEventName] = useState('');
  const [premiumEventDesc, setPremiumEventDesc] = useState('');
  const [premiumDuration, setPremiumDuration] = useState('24');

  const [partnerCodeModal, setPartnerCodeModal] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [newPartnerCode, setNewPartnerCode] = useState('');
  const [newPartnerCodeDesc, setNewPartnerCodeDesc] = useState('');

  const isAdmin = currentUser?.isAdmin === true;
  const isSuperAdmin = currentUser?.isSuperAdmin === true;

  useEffect(() => {
    if (isSuperAdmin && selectedTab === 'settings') {
      loadBanners();
      loadGlobalPremiumMode();
      loadDiscountCodes();
      loadPartners();
      loadGlobalSettings();
    }
  }, [isSuperAdmin, selectedTab, loadBanners, loadGlobalPremiumMode, loadDiscountCodes, loadPartners, loadGlobalSettings]);

  if (!isAuthenticated || !isAdmin) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Accès Refusé', headerShown: true }} />
        <View style={styles.accessDeniedContainer}>
          <ShieldAlert size={64} color="#E31B23" />
          <Text style={styles.accessDeniedTitle}>Accès Refusé</Text>
          <Text style={styles.accessDeniedText}>
            Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.backButtonText}>Retour à l&apos;accueil</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusInfo = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return { label: 'En attente', color: '#FFA500', icon: Clock };
      case 'validated':
        return { label: 'Validé', color: '#007AFF', icon: CheckCheck };
      case 'rejected':
        return { label: 'Rejeté', color: '#E31B23', icon: XCircle };
      case 'shipped':
        return { label: 'Expédié', color: '#8E44AD', icon: Truck };
      case 'completed':
        return { label: 'Terminé', color: '#27AE60', icon: CheckCircle };
    }
  };

  const handleValidate = (orderId: string) => {
    toast.showAlert(
      'Valider la commande',
      'Êtes-vous sûr de vouloir valider cette commande ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Valider',
          onPress: async () => {
            await updateOrderStatus(orderId, 'validated');
            toast.showSuccess('La commande a été validée');
          },
        },
      ]
    );
  };

  const handleReject = (orderId: string) => {
    setRejectModal({
      visible: true,
      type: 'order',
      targetId: orderId,
      targetTitle: `Commande #${orderId.slice(-8)}`
    });
    setRejectionReason('');
  };

  const handleShip = (orderId: string) => {
    toast.showAlert(
      'Marquer comme expédié',
      'Cette commande a-t-elle été expédiée ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Expédié',
          onPress: async () => {
            await updateOrderStatus(orderId, 'shipped');
            toast.showSuccess('La commande a été marquée comme expédiée');
          },
        },
      ]
    );
  };

  const handleComplete = (orderId: string) => {
    toast.showAlert(
      'Marquer comme livrée',
      'Cette commande a-t-elle été livrée ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Livrée',
          onPress: async () => {
            await updateOrderStatus(orderId, 'completed');
            toast.showSuccess('La commande a été marquée comme livrée');
          },
        },
      ]
    );
  };

  const handleDeleteOrder = (orderId: string) => {
    toast.showAlert(
      'Supprimer la commande',
      'Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteOrder(orderId);
            if (result.success) {
              toast.showSuccess('La commande a été supprimée');
            } else {
              toast.showError(result.error || 'Erreur lors de la suppression');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAllUserOrders = (userId: string, userName: string) => {
    toast.showAlert(
      'Supprimer toutes les commandes',
      `Êtes-vous sûr de vouloir supprimer TOUTES les commandes de ${userName} ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer tout',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAllUserOrders(userId);
            if (result.success) {
              toast.showSuccess(`Toutes les commandes de ${userName} ont été supprimées`);
            } else {
              toast.showError(result.error || 'Erreur lors de la suppression');
            }
          },
        },
      ]
    );
  };

  const handleApproveProduct = (productId: string, productTitle: string) => {
    toast.showAlert(
      'Approuver le produit',
      `Voulez-vous approuver "${productTitle}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Approuver',
          onPress: async () => {
            await approveProduct(productId);
            toast.showSuccess('Le produit a été approuvé et est maintenant visible');
          },
        },
      ]
    );
  };

  const handleRejectProduct = (productId: string, productTitle: string) => {
    setRejectModal({
      visible: true,
      type: 'product',
      targetId: productId,
      targetTitle: productTitle
    });
    setRejectionReason('');
  };

  const confirmReject = async () => {
    if (!rejectModal.targetId || !rejectModal.type) return;

    if (rejectModal.type === 'order') {
      await updateOrderStatus(rejectModal.targetId, 'rejected', { rejectionReason: rejectionReason || 'Non spécifié' });
      toast.showSuccess('La commande a été rejetée');
    } else if (rejectModal.type === 'product') {
      await rejectProduct(rejectModal.targetId, rejectionReason || 'Non conforme aux règles');
      toast.showSuccess('Le produit a été rejeté');
    }

    setRejectModal({ visible: false, type: null, targetId: null });
    setRejectionReason('');
  };

  const handleDeleteProduct = (productId: string, productTitle: string) => {
    toast.showAlert(
      'Supprimer le produit',
      `Êtes-vous sûr de vouloir supprimer "${productTitle}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteProduct(productId);
            toast.showSuccess('Le produit a été supprimé');
          },
        },
      ]
    );
  };

  const handleEditProduct = (productId: string) => {
    router.push(`/product/edit/${productId}` as any);
  };

  const handleViewProduct = (productId: string) => {
    router.push(`/product/${productId}` as any);
  };

  const filteredOrders = orders.filter(order => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'pending') return order.status === 'pending';
    return order.status === selectedFilter;
  });

  const getFilterCount = (filter: OrderStatus | 'all' | 'pending') => {
    if (filter === 'all') return orders.length;
    if (filter === 'pending') return orders.filter(order => order.status === 'pending').length;
    return orders.filter(order => order.status === filter).length;
  };

  const renderOrderCard = (order: Order) => {
    const statusInfo = getStatusInfo(order.status);
    const StatusIcon = statusInfo.icon;

    return (
      <View key={order.id} style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderId}>Commande #{order.id.slice(-8)}</Text>
            <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <StatusIcon size={14} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{order.userName}</Text>
          <Text style={styles.customerPhone}>{order.userPhone}</Text>
        </View>

        <View style={styles.itemsContainer}>
          {order.items.map((item, index) => (
            <View key={index} style={styles.orderItem}>
              <Image source={{ uri: item.product.images[0] }} style={styles.itemImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.product.title}
                </Text>
                <Text style={styles.itemQuantity}>Quantité: {item.quantity}</Text>
                <Text style={styles.itemPrice}>
                  {formatPrice(item.priceAtPurchase * item.quantity)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalAmount}>{formatPrice(order.totalAmount)}</Text>
        </View>

        {order.status === 'pending' && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.validateButton]}
              onPress={() => handleValidate(order.id)}
            >
              <CheckCircle size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Valider</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(order.id)}
            >
              <XCircle size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Rejeter</Text>
            </TouchableOpacity>
          </View>
        )}

        {order.status === 'validated' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.shipButton]}
            onPress={() => handleShip(order.id)}
          >
            <Truck size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Marquer comme expédié</Text>
          </TouchableOpacity>
        )}

        {order.status === 'shipped' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => handleComplete(order.id)}
          >
            <CheckCheck size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Marquer comme livrée</Text>
          </TouchableOpacity>
        )}

        {order.status === 'rejected' && order.rejectionReason && (
          <View style={styles.rejectionReason}>
            <Text style={styles.rejectionReasonLabel}>Raison du rejet:</Text>
            <Text style={styles.rejectionReasonText}>{order.rejectionReason}</Text>
          </View>
        )}

        {currentUser?.isSuperAdmin && (
          <TouchableOpacity
            style={styles.deleteOrderButton}
            onPress={() => handleDeleteOrder(order.id)}
          >
            <Trash2 size={18} color="#E31B23" />
            <Text style={styles.deleteOrderButtonText}>Supprimer cette commande</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderProductCard = (product: Product) => {
    const getProductStatusInfo = () => {
      switch (product.status) {
        case 'pending':
          return { label: 'En attente validation', color: '#FFA500', icon: Clock };
        case 'approved':
          return { label: 'Approuvé', color: '#00A651', icon: CheckCircle };
        case 'rejected':
          return { label: 'Rejeté', color: '#E31B23', icon: XCircle };
      }
    };

    const statusInfo = getProductStatusInfo();
    const StatusIcon = statusInfo.icon;
    
    const hasDiscount = product.hasDiscount && product.discountPercent && product.discountPercent > 0;
    const displayPrice = hasDiscount && product.originalPrice 
      ? product.originalPrice * (1 - (product.discountPercent || 0) / 100)
      : product.price;

    return (
      <View key={product.id} style={styles.productCard}>
        <Image source={{ uri: product.images[0] }} style={styles.productImage} />
        <View style={[styles.productStatusBadge, { backgroundColor: statusInfo.color + '20' }]}>
          <StatusIcon size={12} color={statusInfo.color} />
          <Text style={[styles.productStatusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
        <View style={styles.productCardInfo}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {product.title}
          </Text>
          {hasDiscount && product.originalPrice ? (
            <View style={styles.priceContainer}>
              <Text style={styles.productPriceDiscount}>{formatPrice(displayPrice)}</Text>
              <Text style={styles.productPriceOriginal}>{formatPrice(product.originalPrice)}</Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>-{product.discountPercent}%</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
          )}
          <Text style={styles.productSeller} numberOfLines={1}>
            Par {product.sellerName}
          </Text>
          <Text style={styles.productDate}>{formatDate(product.createdAt)}</Text>

          {product.status === 'pending' && (
            <View style={styles.productActionsRow}>
              <TouchableOpacity
                style={[styles.productActionButton, styles.approveProductButton]}
                onPress={() => handleApproveProduct(product.id, product.title)}
              >
                <CheckCircle size={16} color="#fff" />
                <Text style={styles.productActionButtonText}>Approuver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.productActionButton, styles.rejectProductButton]}
                onPress={() => handleRejectProduct(product.id, product.title)}
              >
                <XCircle size={16} color="#fff" />
                <Text style={styles.productActionButtonText}>Rejeter</Text>
              </TouchableOpacity>
            </View>
          )}

          {product.status === 'rejected' && product.rejectionReason && (
            <View style={styles.productRejectionReason}>
              <AlertCircle size={12} color="#E31B23" />
              <Text style={styles.productRejectionReasonText} numberOfLines={2}>
                {product.rejectionReason}
              </Text>
            </View>
          )}

          <View style={styles.productAdminActions}>
            <TouchableOpacity
              style={styles.productAdminActionButton}
              onPress={() => handleViewProduct(product.id)}
            >
              <Text style={styles.productAdminActionButtonText}>Voir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.productAdminActionButton}
              onPress={() => handleEditProduct(product.id)}
            >
              <Edit size={16} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.productAdminActionButton}
              onPress={() => handleDeleteProduct(product.id, product.title)}
            >
              <Trash2 size={16} color="#E31B23" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderOrdersTab = () => {
    return (
    <View style={styles.tabContent}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Package size={20} color="#00A651" />
          <Text style={styles.statValue}>{orders.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Clock size={20} color="#FFA500" />
          <Text style={styles.statValue}>{getFilterCount('pending')}</Text>
          <Text style={styles.statLabel}>À valider</Text>
        </View>
        <View style={styles.statCard}>
          <CheckCircle size={20} color="#007AFF" />
          <Text style={styles.statValue}>{getFilterCount('validated')}</Text>
          <Text style={styles.statLabel}>Validées</Text>
        </View>
      </View>

      <View style={styles.filterSelectorContainer}>
        <TouchableOpacity
          style={styles.filterSelector}
          onPress={() => setFilterModalVisible(true)}
        >
          <Text style={styles.filterSelectorLabel}>État:</Text>
          <Text style={styles.filterSelectorValue}>
            {selectedFilter === 'pending' && 'À valider'}
            {selectedFilter === 'all' && 'Toutes'}
            {selectedFilter === 'validated' && 'Validées'}
            {selectedFilter === 'shipped' && 'Expédiées'}
            {selectedFilter === 'rejected' && 'Rejetées'}
            {selectedFilter === 'completed' && 'Terminées'}

          </Text>
          <ChevronDown size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {filteredOrders.length > 0 ? (
          filteredOrders.map(renderOrderCard)
        ) : (
          <View style={styles.emptyState}>
            <Package size={64} color="#ddd" />
            <Text style={styles.emptyStateText}>Aucune commande</Text>
            <Text style={styles.emptyStateSubtext}>
              Les commandes apparaîtront ici
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
    );
  };

  const renderProductsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Package size={20} color="#00A651" />
          <Text style={styles.statValue}>{products.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Clock size={20} color="#FFA500" />
          <Text style={styles.statValue}>{pendingProducts.length}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
        <View style={styles.statCard}>
          <CheckCircle size={20} color="#007AFF" />
          <Text style={styles.statValue}>
            {products.filter(p => p.status === 'approved').length}
          </Text>
          <Text style={styles.statLabel}>Approuvés</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {products.length > 0 ? (
          <View style={styles.productsGrid}>
            {products.map(renderProductCard)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Package size={64} color="#ddd" />
            <Text style={styles.emptyStateText}>Aucun produit</Text>
            <Text style={styles.emptyStateSubtext}>
              Les produits apparaîtront ici
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const handleChangeUserType = (userId: string, userName: string, currentType: string) => {
    const newType = currentType === 'premium' ? 'standard' : 'premium';
    toast.showAlert(
      'Changer le type de compte',
      `Voulez-vous passer ${userName} en ${newType === 'premium' ? 'Premium' : 'Standard'} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            const result = await changeUserType(userId, newType as 'premium' | 'standard');
            if (result.success) {
              toast.showSuccess(`Le compte de ${userName} est maintenant ${newType === 'premium' ? 'Premium' : 'Standard'}`);
            } else {
              toast.showError(result.error || 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    toast.showAlert(
      'Supprimer l\'utilisateur',
      `Êtes-vous sûr de vouloir supprimer ${userName} ? Cette action supprimera aussi toutes ses annonces.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteUser(userId);
            if (result.success) {
              toast.showSuccess(`${userName} a été supprimé`);
            } else {
              toast.showError(result.error || 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleApprovePremium = (userId: string, userName: string) => {
    toast.showAlert(
      'Valider le passage Premium',
      `Voulez-vous activer le compte Premium de ${userName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Activer Premium',
          onPress: async () => {
            const result = await approvePremiumUpgrade(userId);
            if (result.success) {
              toast.showSuccess(`Le compte Premium de ${userName} a été activé`);
            } else {
              toast.showError(result.error || 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleRejectPremium = (userId: string, userName: string) => {
    toast.showAlert(
      'Rejeter la demande Premium',
      `Voulez-vous rejeter la demande Premium de ${userName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rejeter',
          style: 'destructive',
          onPress: async () => {
            const result = await rejectPremiumUpgrade(userId);
            if (result.success) {
              toast.showSuccess(`La demande Premium de ${userName} a été rejetée`);
            } else {
              toast.showError(result.error || 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleToggleAdmin = (userId: string, userName: string, isCurrentlyAdmin: boolean) => {
    if (!currentUser?.isSuperAdmin) {
      toast.showError('Seul le super administrateur peut gérer les admins');
      return;
    }

    toast.showAlert(
      isCurrentlyAdmin ? 'Retirer les droits admin' : 'Définir comme admin',
      `Voulez-vous ${isCurrentlyAdmin ? 'retirer les droits admin de' : 'faire de'} ${userName} ${isCurrentlyAdmin ? '' : 'un administrateur'} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            const result = await toggleAdminStatus(userId);
            if (result.success) {
              toast.showSuccess(`${userName} ${isCurrentlyAdmin ? 'n\'est plus admin' : 'est maintenant admin'}`);
            } else {
              toast.showError(result.error || 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleTogglePartner = (userId: string, userName: string, isCurrentlyPartner: boolean) => {
    if (!currentUser?.isSuperAdmin) {
      toast.showError('Seul le super administrateur peut gérer les partenaires');
      return;
    }

    toast.showAlert(
      isCurrentlyPartner ? 'Retirer le statut partenaire' : 'Définir comme partenaire',
      `Voulez-vous ${isCurrentlyPartner ? 'retirer le statut partenaire de' : 'faire de'} ${userName} ${isCurrentlyPartner ? '' : 'un partenaire'} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            const result = await togglePartnerStatus(userId);
            if (result.success) {
              toast.showSuccess(`${userName} ${isCurrentlyPartner ? 'n\'est plus partenaire' : 'est maintenant partenaire'}`);
              await loadPartners();
            } else {
              toast.showError(result.error || 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleUserCardClick = (user: User) => {
    if (currentUser?.isSuperAdmin && user.isPartner) {
      router.push(`/admin/partner-profile/${user.id}` as any);
    }
  };

  const renderUserCard = (user: User) => {
    const userProductCount = products.filter(p => p.sellerId === user.id).length;
    const isCurrentUser = user.id === currentUser?.id;
    const isSuperAdmin = currentUser?.isSuperAdmin === true;
    const canClickCard = isSuperAdmin && user.isPartner;

    const CardWrapper = canClickCard ? TouchableOpacity : View;
    const cardWrapperProps = canClickCard ? {
      onPress: () => handleUserCardClick(user),
      activeOpacity: 0.7,
    } : {};

    return (
      <CardWrapper key={user.id} style={styles.userCard} {...cardWrapperProps}>
        <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
        <View style={styles.userCardInfo}>
          <View style={styles.userCardHeader}>
            <Text style={styles.userCardName} numberOfLines={1}>
              {user.name}
              {isCurrentUser && ' (Vous)'}
            </Text>
            {user.type === 'premium' && (
              <View style={styles.userPremiumBadge}>
                <Crown size={10} color="#FFD700" fill="#FFD700" />
              </View>
            )}
            {user.isSuperAdmin && (
              <View style={styles.userSuperAdminBadge}>
                <ShieldCheck size={10} color="#E31B23" fill="#E31B23" />
              </View>
            )}
            {user.isAdmin && !user.isSuperAdmin && (
              <View style={styles.userAdminBadge}>
                <Shield size={10} color="#007AFF" />
              </View>
            )}
            {user.isPartner && (
              <View style={styles.userPartnerBadge}>
                <UserPlus size={10} color="#8B5CF6" />
              </View>
            )}
            {user.premiumPaymentPending && (
              <View style={styles.userPendingBadge}>
                <Clock size={10} color="#FFA500" />
              </View>
            )}
          </View>
          <Text style={styles.userCardPhone}>{user.phone}</Text>
          <Text style={styles.userCardLocation} numberOfLines={1}>
            {user.location}
          </Text>
          <View style={styles.userCardStats}>
            <Package size={12} color="#00A651" />
            <Text style={styles.userCardStatsText}>{userProductCount} annonces</Text>
          </View>
          {user.premiumPaymentPending && (
            <View style={styles.premiumRequestBanner}>
              <AlertCircle size={12} color="#FFA500" />
              <Text style={styles.premiumRequestText}>Demande Premium en attente</Text>
            </View>
          )}
        </View>
        <View style={styles.userCardActions}>
          {user.premiumPaymentPending ? (
            <>
              <TouchableOpacity
                style={[styles.userActionButton, styles.userActionButtonApprove]}
                onPress={() => handleApprovePremium(user.id, user.name)}
              >
                <CheckCircle size={14} color="#00A651" />
                <Text style={[styles.userActionButtonText, styles.userActionButtonTextApprove]}>
                  Valider
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.userActionButton, styles.userActionButtonReject]}
                onPress={() => handleRejectPremium(user.id, user.name)}
              >
                <XCircle size={14} color="#E31B23" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              {isSuperAdmin && !user.isSuperAdmin && (
                <TouchableOpacity
                  style={[
                    styles.userActionButton,
                    user.isAdmin ? styles.userActionButtonRemoveAdmin : styles.userActionButtonMakeAdmin
                  ]}
                  onPress={() => handleToggleAdmin(user.id, user.name, user.isAdmin || false)}
                >
                  <Shield size={14} color={user.isAdmin ? '#E31B23' : '#007AFF'} />
                  <Text style={[
                    styles.userActionButtonText,
                    user.isAdmin ? styles.userActionButtonTextRemoveAdmin : styles.userActionButtonTextMakeAdmin
                  ]}>
                    {user.isAdmin ? 'Retirer' : 'Admin'}
                  </Text>
                </TouchableOpacity>
              )}
              {isSuperAdmin && (
                <TouchableOpacity
                  style={[
                    styles.userActionButton,
                    user.isPartner ? styles.userActionButtonRemovePartner : styles.userActionButtonMakePartner
                  ]}
                  onPress={() => handleTogglePartner(user.id, user.name, user.isPartner || false)}
                >
                  <UserPlus size={14} color={user.isPartner ? '#E31B23' : '#8B5CF6'} />
                  <Text style={[
                    styles.userActionButtonText,
                    user.isPartner ? styles.userActionButtonTextRemovePartner : styles.userActionButtonTextMakePartner
                  ]}>
                    {user.isPartner ? 'Retirer' : 'Partenaire'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.userActionButton,
                  user.type === 'premium' ? styles.userActionButtonStandard : styles.userActionButtonPremium
                ]}
                onPress={() => handleChangeUserType(user.id, user.name, user.type)}
              >
                <Crown size={14} color={user.type === 'premium' ? '#666' : '#FFD700'} />
                <Text style={[
                  styles.userActionButtonText,
                  user.type === 'premium' ? styles.userActionButtonTextStandard : styles.userActionButtonTextPremium
                ]}>
                  {user.type === 'premium' ? 'Std' : 'Prm'}
                </Text>
              </TouchableOpacity>
              {!isCurrentUser && !user.isSuperAdmin && (
                <>
                  {isSuperAdmin && (
                    <TouchableOpacity
                      style={[styles.userActionButton, styles.userActionButtonDelete]}
                      onPress={() => handleDeleteAllUserOrders(user.id, user.name)}
                    >
                      <Package size={14} color="#E31B23" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.userActionButton, styles.userActionButtonDelete]}
                    onPress={() => handleDeleteUser(user.id, user.name)}
                  >
                    <Trash2 size={14} color="#E31B23" />
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </CardWrapper>
    );
  };

  const renderUsersTab = () => {
    const premiumUsers = allUsers.filter(u => u.type === 'premium').length;
    const pendingPremium = allUsers.filter(u => u.premiumPaymentPending).length;

    return (
      <View style={styles.tabContent}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Users size={20} color="#007AFF" />
            <Text style={styles.statValue}>{allUsers.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Crown size={20} color="#FFD700" />
            <Text style={styles.statValue}>{premiumUsers}</Text>
            <Text style={styles.statLabel}>Premium</Text>
          </View>
          <View style={styles.statCard}>
            <Clock size={20} color="#FFA500" />
            <Text style={styles.statValue}>{pendingPremium}</Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
        >
          {allUsers.length > 0 ? (
            allUsers.map(renderUserCard)
          ) : (
            <View style={styles.emptyState}>
              <Users size={64} color="#ddd" />
              <Text style={styles.emptyStateText}>Aucun utilisateur</Text>
              <Text style={styles.emptyStateSubtext}>
                Les utilisateurs apparaîtront ici
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderSettingsTab = () => {
    const commissionRate = globalSettings?.commissionRate || 15;
    const discountReduction = globalSettings?.discountReduction || 5;
    const finalCommission = commissionRate - discountReduction;

    return (
      <View style={styles.tabContent}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>💰 Paramètres de Base</Text>
            <View style={styles.simpleCard}>
              <View style={styles.simpleRow}>
                <Text style={styles.simpleLabel}>Commission de base</Text>
                <Text style={styles.simpleValue}>0% (Gratuit)</Text>
              </View>
              <Text style={styles.simpleHint}>
                100% gratuit — 0% commission pour tous les vendeurs
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/admin/settings')}
            >
              <Text style={styles.addButtonText}>Modifier les paramètres globaux</Text>
            </TouchableOpacity>

          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>🎫 Codes Promo</Text>
            <View style={styles.promoExplainCard}>
              <Text style={styles.promoExplainTitle}>Comment ça marche ?</Text>
              <Text style={styles.promoExplainText}>• 100% gratuit — 0% commission dans tous les cas</Text>
              <Text style={styles.promoExplainText}>• Le code partenaire soutient un membre de la communauté</Text>
              <Text style={styles.promoExplainText}>• Le vendeur entre le code lors de la création de l'annonce</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setCodeModal(true)}
            >
              <Text style={styles.addButtonText}>+ Créer un code promo</Text>
            </TouchableOpacity>
            {(discountCodes || []).length > 0 ? (
              (discountCodes || []).map((code) => (
                <View key={code.id} style={styles.codeCard}>
                  <View style={styles.codeCardLeft}>
                    <Text style={styles.codeCardCode}>{code.code}</Text>
                    <Text style={styles.codeCardUsage}>Utilisé {code.timesUsed} fois</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteCodeButton}
                    onPress={() => {
                      toast.showAlert(
                        'Supprimer le code',
                        `Supprimer le code "${code.code}" ?`,
                        [
                          { text: 'Annuler', style: 'cancel' },
                          {
                            text: 'Supprimer',
                            style: 'destructive',
                            onPress: async () => {
                              const result = await deleteDiscountCode(code.id);
                              if (result.success) {
                                toast.showSuccess('Code supprimé');
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Trash2 size={18} color="#E31B23" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>Aucun code promo créé</Text>
              </View>
            )}
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>📢 Messages défilants</Text>
            <Text style={styles.settingsSectionDesc}>
              Messages affichés en haut de l&apos;écran d&apos;accueil
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setBannerModal(true)}
            >
              <Text style={styles.addButtonText}>+ Créer un message</Text>
            </TouchableOpacity>
            {(banners || []).length > 0 ? (
              (banners || []).map((banner) => (
                <View key={banner.id} style={styles.bannerCard}>
                  <View style={[styles.bannerColorIndicator, { backgroundColor: banner.backgroundColor }]} />
                  <Text style={styles.bannerCardText} numberOfLines={2}>{banner.message}</Text>
                  <TouchableOpacity
                    style={styles.deleteBannerButton}
                    onPress={() => {
                      toast.showAlert(
                        'Supprimer',
                        'Supprimer ce message ?',
                        [
                          { text: 'Annuler', style: 'cancel' },
                          {
                            text: 'Supprimer',
                            style: 'destructive',
                            onPress: async () => {
                              const result = await deleteBanner(banner.id);
                              if (result.success) {
                                toast.showSuccess('Message supprimé');
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Trash2 size={18} color="#E31B23" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>Aucun message créé</Text>
              </View>
            )}
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>👑 Premium Global</Text>
            <Text style={styles.settingsSectionDesc}>
              Activer le Premium pour tous pendant un événement
            </Text>
            {globalPremiumMode ? (
              <View style={styles.premiumActiveCard}>
                <Crown size={24} color="#FFD700" fill="#FFD700" />
                <View style={styles.premiumInfo}>
                  <Text style={styles.premiumTitle}>{globalPremiumMode.eventName}</Text>
                  <Text style={styles.premiumDate}>
                    Actif jusqu&apos;au {new Date(globalPremiumMode.endsAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deactivateButton}
                  onPress={() => {
                    toast.showAlert(
                      'Désactiver',
                      'Désactiver le Premium Global ?',
                      [
                        { text: 'Annuler', style: 'cancel' },
                        {
                          text: 'Désactiver',
                          style: 'destructive',
                          onPress: async () => {
                            const result = await disableGlobalPremiumMode(globalPremiumMode.id);
                            if (result.success) {
                              toast.showSuccess('Premium Global désactivé');
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.deactivateButtonText}>Désactiver</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setPremiumModal(true)}
              >
                <Text style={styles.addButtonText}>+ Activer Premium Global</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Admin', headerShown: false }} />
      
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'products' && styles.tabActive]}
            onPress={() => setSelectedTab('products')}
          >
            <Package size={20} color={selectedTab === 'products' ? '#00A651' : '#666'} />
            <Text style={[styles.tabText, selectedTab === 'products' && styles.tabTextActive]}>
              Prod
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'orders' && styles.tabActive]}
            onPress={() => setSelectedTab('orders')}
          >
            <Truck size={20} color={selectedTab === 'orders' ? '#00A651' : '#666'} />
            <Text style={[styles.tabText, selectedTab === 'orders' && styles.tabTextActive]}>
              Cmd
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'users' && styles.tabActive]}
            onPress={() => setSelectedTab('users')}
          >
            <Users size={20} color={selectedTab === 'users' ? '#00A651' : '#666'} />
            <Text style={[styles.tabText, selectedTab === 'users' && styles.tabTextActive]}>
              Util
            </Text>
          </TouchableOpacity>
          {isSuperAdmin && (
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'settings' && styles.tabActive]}
              onPress={() => setSelectedTab('settings')}
            >
              <Crown size={20} color={selectedTab === 'settings' ? '#00A651' : '#666'} />
              <Text style={[styles.tabText, selectedTab === 'settings' && styles.tabTextActive]}>
                Param
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {selectedTab === 'orders' && renderOrdersTab()}
      {selectedTab === 'products' && renderProductsTab()}
      {selectedTab === 'users' && renderUsersTab()}
      {selectedTab === 'settings' && renderSettingsTab()}

      <Modal
        visible={rejectModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModal({ visible: false, type: null, targetId: null })}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rejeter {rejectModal.type === 'product' ? "l'annonce" : "la commande"}</Text>
              <TouchableOpacity onPress={() => setRejectModal({ visible: false, type: null, targetId: null })}>
                <XCircle size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Veuillez indiquer la raison du rejet pour &quot;{rejectModal.targetTitle}&quot; :
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Raison du rejet..."
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setRejectModal({ visible: false, type: null, targetId: null })}
              >
                <Text style={styles.cancelModalButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmModalButton]}
                onPress={confirmReject}
              >
                <Text style={styles.confirmModalButtonText}>Confirmer le rejet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={styles.filterModalContent}>
            <Text style={styles.filterModalTitle}>Filtrer par état</Text>
            {[
              { value: 'all', label: 'Toutes', count: getFilterCount('all') },
              { value: 'pending', label: 'À valider', count: getFilterCount('pending') },
              { value: 'validated', label: 'Validées', count: getFilterCount('validated') },
              { value: 'shipped', label: 'Expédiées', count: getFilterCount('shipped') },
              { value: 'completed', label: 'Terminées', count: getFilterCount('completed') },
              { value: 'rejected', label: 'Rejetées', count: getFilterCount('rejected') },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterModalOption,
                  selectedFilter === option.value && styles.filterModalOptionActive
                ]}
                onPress={() => {
                  setSelectedFilter(option.value as OrderStatus | 'all' | 'pending');
                  setFilterModalVisible(false);
                }}
              >
                <Text style={[
                  styles.filterModalOptionText,
                  selectedFilter === option.value && styles.filterModalOptionTextActive
                ]}>
                  {option.label}
                </Text>
                <Text style={[
                  styles.filterModalOptionCount,
                  selectedFilter === option.value && styles.filterModalOptionCountActive
                ]}>
                  {option.count}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={codeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setCodeModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Créer un code promo</Text>
              <TouchableOpacity onPress={() => setCodeModal(false)}>
                <XCircle size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              100% gratuit — le code partenaire soutient un membre de la communauté
            </Text>
            <TextInput
              style={[styles.modalInput, { height: 56 }]}
              placeholder="Code (ex: PROMO2024)"
              value={newCode}
              onChangeText={(text) => setNewCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={20}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => {
                  setCodeModal(false);
                  setNewCode('');
                }}
              >
                <Text style={styles.cancelModalButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmModalButton, !newCode && { opacity: 0.5 }]}
                disabled={!newCode}
                onPress={async () => {
                  if (!currentUser || !newCode) return;
                  const result = await createDiscountCode(
                    newCode,
                    null,
                    (globalSettings?.discountReduction || 5),
                    null,
                    null,
                    null,
                    currentUser.id
                  );
                  if (result.success) {
                    toast.showSuccess('Code créé');
                    setCodeModal(false);
                    setNewCode('');
                    await loadDiscountCodes();
                  } else {
                    toast.showError(result.error || 'Erreur');
                  }
                }}
              >
                <Text style={styles.confirmModalButtonText}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={bannerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setBannerModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Créer un message</Text>
              <TouchableOpacity onPress={() => setBannerModal(false)}>
                <XCircle size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, { height: 100 }]}
              placeholder="Message à afficher..."
              value={newBannerMsg}
              onChangeText={setNewBannerMsg}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.modalSubtitle}>Couleur de fond</Text>
            <View style={styles.colorRow}>
              {['#00853F', '#00A651', '#007AFF', '#FFD700', '#E31B23', '#8E44AD'].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorButton,
                    { backgroundColor: color },
                    newBannerBg === color && styles.colorButtonActive
                  ]}
                  onPress={() => setNewBannerBg(color)}
                />
              ))}
            </View>
            <Text style={styles.modalSubtitle}>Couleur du texte</Text>
            <View style={styles.colorRow}>
              {['#FFFFFF', '#000000'].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorButton,
                    { backgroundColor: color, borderWidth: color === '#FFFFFF' ? 1 : 0, borderColor: '#ddd' },
                    newBannerColor === color && styles.colorButtonActive
                  ]}
                  onPress={() => setNewBannerColor(color)}
                />
              ))}
            </View>
            <View style={[styles.bannerPreview, { backgroundColor: newBannerBg }]}>
              <Text style={[styles.bannerPreviewText, { color: newBannerColor }]}>
                {newBannerMsg || 'Aperçu du message'}
              </Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setBannerModal(false)}
              >
                <Text style={styles.cancelModalButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmModalButton, !newBannerMsg && { opacity: 0.5 }]}
                disabled={!newBannerMsg}
                onPress={async () => {
                  if (!currentUser) return;
                  const result = await createBanner(
                    newBannerMsg,
                    newBannerBg,
                    newBannerColor,
                    0,
                    null,
                    null,
                    currentUser.id
                  );
                  if (result.success) {
                    toast.showSuccess('Message créé');
                    setBannerModal(false);
                    setNewBannerMsg('');
                    setNewBannerBg('#00853F');
                    setNewBannerColor('#FFFFFF');
                  } else {
                    toast.showError(result.error || 'Erreur');
                  }
                }}
              >
                <Text style={styles.confirmModalButtonText}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={premiumModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPremiumModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Activer Premium Global</Text>
              <TouchableOpacity onPress={() => setPremiumModal(false)}>
                <XCircle size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Tous les utilisateurs seront en Premium pendant la durée choisie
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nom de l'événement (ex: Black Friday)"
              value={premiumEventName}
              onChangeText={setPremiumEventName}
            />
            <TextInput
              style={[styles.modalInput, { height: 100 }]}
              placeholder="Description (optionnel)"
              value={premiumEventDesc}
              onChangeText={setPremiumEventDesc}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Durée en heures (ex: 24)"
              value={premiumDuration}
              onChangeText={setPremiumDuration}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setPremiumModal(false)}
              >
                <Text style={styles.cancelModalButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmModalButton, !premiumEventName && { opacity: 0.5 }]}
                disabled={!premiumEventName}
                onPress={async () => {
                  if (!currentUser) return;
                  const now = new Date();
                  const endsAt = new Date(now.getTime() + parseFloat(premiumDuration) * 60 * 60 * 1000);
                  const result = await createGlobalPremiumMode(
                    premiumEventName,
                    premiumEventDesc || null,
                    now,
                    endsAt,
                    currentUser.id
                  );
                  if (result.success) {
                    toast.showSuccess('Premium Global activé');
                    setPremiumModal(false);
                    setPremiumEventName('');
                    setPremiumEventDesc('');
                    setPremiumDuration('24');
                  } else {
                    toast.showError(result.error || 'Erreur');
                  }
                }}
              >
                <Text style={styles.confirmModalButtonText}>Activer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: getContainerPadding(),
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: isWeb ? 20 : 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  tabActive: {
    backgroundColor: '#E8F5E9',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
  },
  tabTextActive: {
    color: '#00A651',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: getContainerPadding(),
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  filterSelectorContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingHorizontal: getContainerPadding(),
    paddingVertical: 12,
  },
  filterSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterSelectorLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
  },
  filterSelectorValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#00A651',
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  filterModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  filterModalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  filterModalOptionActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#00A651',
  },
  filterModalOptionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#666',
  },
  filterModalOptionTextActive: {
    color: '#00A651',
  },
  filterModalOptionCount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#999',
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    textAlign: 'center',
  },
  filterModalOptionCountActive: {
    color: '#00A651',
    backgroundColor: '#C8E6C9',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: getContainerPadding(),
    paddingBottom: 100,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 1600,
  },
  tabContent: {
    flex: 1,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: isWeb ? 20 : 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
  },
  orderDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  customerInfo: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    marginBottom: 12,
    gap: 4,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#000',
  },
  customerPhone: {
    fontSize: 14,
    color: '#666',
  },
  transactionId: {
    fontSize: 12,
    color: '#00A651',
    fontWeight: '600' as const,
    marginTop: 4,
  },
  itemsContainer: {
    gap: 12,
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#000',
  },
  itemQuantity: {
    fontSize: 13,
    color: '#666',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#00A651',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#00A651',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: isWeb ? 14 : 12,
    borderRadius: 10,
    minHeight: getButtonHeight(),
  },
  validateButton: {
    backgroundColor: '#00A651',
  },
  rejectButton: {
    backgroundColor: '#E31B23',
  },
  shipButton: {
    backgroundColor: '#8E44AD',
    marginTop: 16,
  },
  completeButton: {
    backgroundColor: '#27AE60',
    marginTop: 16,
  },
  actionButtonText: {
    fontSize: getButtonFontSize(),
    fontWeight: '700' as const,
    color: '#fff',
  },
  rejectionReason: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#E31B23',
  },
  rejectionReasonLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#E31B23',
    marginBottom: 4,
  },
  rejectionReasonText: {
    fontSize: 14,
    color: '#666',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: getDimensions().width < 600 ? 12 : (getDimensions().width < 1200 ? 16 : 20),
    justifyContent: 'flex-start',
  },
  productCard: {
    width: getProductCardWidth(),
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
  productImage: {
    width: '100%',
    height: getProductCardWidth() * 1.1,
    maxHeight: 330,
    backgroundColor: '#f5f5f5',
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
  },
  productStatusText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  productCardInfo: {
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
    color: '#00A651',
    marginBottom: 4,
  },
  productSeller: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  productDate: {
    fontSize: 11,
    color: '#999',
    marginBottom: 8,
  },
  productActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  productActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveProductButton: {
    backgroundColor: '#00A651',
  },
  rejectProductButton: {
    backgroundColor: '#E31B23',
  },
  productActionButtonText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  productRejectionReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFF5F5',
    borderRadius: 6,
  },
  productRejectionReasonText: {
    flex: 1,
    fontSize: 11,
    color: '#E31B23',
  },
  productAdminActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  productAdminActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  productAdminActionButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  accessDeniedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#E31B23',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#00A651',
    paddingVertical: isWeb ? 16 : 14,
    paddingHorizontal: isWeb ? 40 : 32,
    borderRadius: 12,
    minHeight: getButtonHeight(),
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: getButtonFontSize(),
    fontWeight: '700' as const,
    color: '#fff',
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
  },
  userCardInfo: {
    flex: 1,
    gap: 4,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userCardName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
    flex: 1,
  },
  userPremiumBadge: {
    backgroundColor: '#FFF9E6',
    padding: 4,
    borderRadius: 8,
  },
  userAdminBadge: {
    backgroundColor: '#E8F4FF',
    padding: 4,
    borderRadius: 8,
  },
  userSuperAdminBadge: {
    backgroundColor: '#FFE8E8',
    padding: 4,
    borderRadius: 8,
  },
  userPartnerBadge: {
    backgroundColor: '#F3E8FF',
    padding: 4,
    borderRadius: 8,
  },
  userCardPhone: {
    fontSize: 13,
    color: '#666',
  },
  userCardLocation: {
    fontSize: 12,
    color: '#999',
  },
  userCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  userCardStatsText: {
    fontSize: 12,
    color: '#00A651',
    fontWeight: '600' as const,
  },
  userCardActions: {
    flexDirection: 'column',
    gap: 8,
    justifyContent: 'center',
  },
  userActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 90,
  },
  userActionButtonPremium: {
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  userActionButtonStandard: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  userActionButtonDelete: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#E31B23',
    minWidth: 40,
  },
  userActionButtonText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  userActionButtonTextPremium: {
    color: '#B8860B',
  },
  userActionButtonTextStandard: {
    color: '#666',
  },
  userPendingBadge: {
    backgroundColor: '#FFF9F0',
    padding: 4,
    borderRadius: 8,
  },
  premiumRequestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    padding: 8,
    backgroundColor: '#FFF9F0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFA500',
  },
  premiumRequestText: {
    fontSize: 11,
    color: '#FFA500',
    fontWeight: '600' as const,
  },
  userActionButtonApprove: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#00A651',
  },
  userActionButtonTextApprove: {
    color: '#00A651',
  },
  userActionButtonReject: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#E31B23',
    minWidth: 40,
  },
  userActionButtonMakeAdmin: {
    backgroundColor: '#E8F4FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  userActionButtonTextMakeAdmin: {
    color: '#007AFF',
  },
  userActionButtonRemoveAdmin: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#E31B23',
  },
  userActionButtonTextRemoveAdmin: {
    color: '#E31B23',
  },
  userActionButtonMakePartner: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  userActionButtonTextMakePartner: {
    color: '#8B5CF6',
  },
  userActionButtonRemovePartner: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#E31B23',
  },
  userActionButtonTextRemovePartner: {
    color: '#E31B23',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  productPriceDiscount: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#E31B23',
  },
  productPriceOriginal: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#999',
    textDecorationLine: 'line-through' as const,
  },
  discountBadge: {
    backgroundColor: '#E31B23',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#E31B23',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    height: 100,
    marginBottom: 24,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: isWeb ? 16 : 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: getButtonHeight(),
    justifyContent: 'center',
  },
  cancelModalButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelModalButtonText: {
    fontSize: getButtonFontSize(),
    fontWeight: '600' as const,
    color: '#666',
  },
  confirmModalButton: {
    backgroundColor: '#E31B23',
  },
  confirmModalButtonText: {
    fontSize: getButtonFontSize(),
    fontWeight: '700' as const,
    color: '#fff',
  },
  deleteOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: isWeb ? 14 : 12,
    borderRadius: 10,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#E31B23',
  },
  deleteOrderButtonText: {
    fontSize: getButtonFontSize(),
    fontWeight: '600' as const,
    color: '#E31B23',
  },
  debugCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  debugText: {
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 4,
    fontWeight: '600' as const,
  },
  settingsSection: {
    marginBottom: 32,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 8,
  },
  settingsSectionDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  simpleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  simpleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  simpleLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#000',
  },
  simpleValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#00A651',
  },
  simpleHint: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
  settingsHint: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    backgroundColor: '#FFF8F0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  promoExplainCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  promoExplainTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1E3A8A',
    marginBottom: 12,
  },
  promoExplainText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 22,
    marginBottom: 4,
  },
  codeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeCardLeft: {
    flex: 1,
  },
  codeCardCode: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#00A651',
    letterSpacing: 1,
    marginBottom: 4,
  },
  codeCardUsage: {
    fontSize: 13,
    color: '#666',
  },
  deleteCodeButton: {
    padding: 8,
  },
  bannerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerColorIndicator: {
    width: 6,
    height: 40,
    borderRadius: 3,
  },
  bannerCardText: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  deleteBannerButton: {
    padding: 8,
  },
  emptyCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  emptyCardText: {
    fontSize: 14,
    color: '#999',
  },
  addButton: {
    backgroundColor: '#00A651',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeContainer: {
    flex: 1,
    gap: 6,
  },
  codeText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#000',
    letterSpacing: 1,
  },
  codeInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  codeUsage: {
    fontSize: 12,
    color: '#666',
  },
  codeDiscount: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#00A651',
  },
  itemUsage: {
    fontSize: 13,
    color: '#999',
  },
  bannerDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerColorBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    color: '#000',
  },
  premiumActiveCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  premiumInfo: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  premiumDate: {
    fontSize: 13,
    color: '#666',
  },
  deactivateButton: {
    backgroundColor: '#E31B23',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deactivateButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  bannerPreview: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  bannerPreviewText: {
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  colorButtonActive: {
    borderWidth: 3,
    borderColor: '#000',
  },
});
