import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, Clock, CheckCircle, XCircle, Truck, ChevronRight, Star, ChevronDown, MapPin, User, Phone, Trash2, X } from 'lucide-react-native';
import { useOrders } from '@/contexts/OrderContext';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useReviews } from '@/contexts/ReviewContext';
import { OrderStatus, Order } from '@/types/marketplace';
import { formatPrice } from '@/constants/appConfig';
import { router } from 'expo-router';
import ReviewModal from '@/components/ReviewModal';
import { useToast } from '@/contexts/ToastContext';

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { getUserOrders, deleteOrder } = useOrders();
  const { currentUser, isAuthenticated } = useMarketplace();
  const { canReviewOrder, addReview } = useReviews();
  const [selectedFilter, setSelectedFilter] = useState<OrderStatus | 'all'>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const toast = useToast();

  const userOrders = currentUser ? getUserOrders(currentUser.id) : [];

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
        return { label: 'Validé', color: '#1E3A8A', icon: CheckCircle };
      case 'rejected':
        return { label: 'Rejeté', color: '#E31B23', icon: XCircle };
      case 'shipped':
        return { label: 'Expédié', color: '#8E44AD', icon: Truck };
      case 'completed':
        return { label: 'Terminé', color: '#27AE60', icon: CheckCircle };
    }
  };

  const filteredOrders = userOrders.filter(order => {
    if (selectedFilter === 'all') return true;
    return order.status === selectedFilter;
  });

  const getFilterCount = (filter: OrderStatus | 'all') => {
    if (filter === 'all') return userOrders.length;
    return userOrders.filter(order => order.status === filter).length;
  };

  const getProgressPercentage = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return 0;
      case 'validated':
        return 33;
      case 'shipped':
        return 66;
      case 'completed':
        return 100;
      case 'rejected':
        return 0;
    }
  };

  const renderProgressBar = (status: OrderStatus) => {
    const progress = getProgressPercentage(status);
    const isRejected = status === 'rejected';
    
    if (isRejected) return null;

    const steps = [
      { label: 'Validé', status: 'validated' },
      { label: 'Expédié', status: 'shipped' },
      { label: 'Livré', status: 'completed' },
    ];

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.stepsContainer}>
          {steps.map((step, index) => {
            const isActive = status === step.status || 
              (status === 'completed' && (step.status === 'validated' || step.status === 'shipped'));
            const isPassed = 
              (status === 'shipped' && step.status === 'validated') ||
              (status === 'completed' && (step.status === 'validated' || step.status === 'shipped'));

            return (
              <View key={index} style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  (isActive || isPassed) && styles.stepDotActive
                ]}>
                  {step.status === 'shipped' && status === 'shipped' && (
                    <Truck size={12} color="#fff" />
                  )}
                  {step.status === 'shipped' && status === 'completed' && (
                    <CheckCircle size={12} color="#fff" />
                  )}
                  {step.status === 'validated' && (status === 'validated' || status === 'shipped' || status === 'completed') && (
                    <CheckCircle size={12} color="#fff" />
                  )}
                  {step.status === 'completed' && status === 'completed' && (
                    <CheckCircle size={12} color="#fff" />
                  )}
                </View>
                <Text style={[
                  styles.stepLabel,
                  (isActive || isPassed) && styles.stepLabelActive
                ]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Mes Commandes</Text>
          <Text style={styles.headerSubtitle}>Suivez vos achats</Text>
        </View>

        <View style={styles.notAuthContainer}>
          <Package size={64} color="#ccc" />
          <Text style={styles.notAuthTitle}>Connectez-vous</Text>
          <Text style={styles.notAuthSubtext}>
            Vous devez être connecté pour voir vos commandes
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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Mes Commandes</Text>
        <Text style={styles.headerSubtitle}>{userOrders.length} commande(s)</Text>
      </View>

      <View style={styles.filterSelectorContainer}>
        <TouchableOpacity
          style={styles.filterSelector}
          onPress={() => setFilterModalVisible(true)}
        >
          <Text style={styles.filterSelectorLabel}>État:</Text>
          <Text style={styles.filterSelectorValue}>
            {selectedFilter === 'all' && 'Toutes'}
            {selectedFilter === 'pending' && 'En attente'}
            {selectedFilter === 'validated' && 'Validées'}
            {selectedFilter === 'shipped' && 'Expédiées'}
            {selectedFilter === 'completed' && 'Terminées'}
            {selectedFilter === 'rejected' && 'Rejetées'}
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
          filteredOrders.map(order => {
            const statusInfo = getStatusInfo(order.status);
            const StatusIcon = statusInfo.icon;

            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>#{order.id.slice(-8).toUpperCase()}</Text>
                    <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                    <StatusIcon size={14} color={statusInfo.color} />
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemsContainer}>
                  {order.items.slice(0, 2).map((item, index) => (
                    <View key={index} style={styles.orderItem}>
                      <Image source={{ uri: item.product.images[0] }} style={styles.itemImage} />
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {item.product.title}
                        </Text>
                        <Text style={styles.itemQuantity}>Qté: {item.quantity}</Text>
                        <Text style={styles.itemPrice}>
                          {formatPrice(item.priceAtPurchase * item.quantity)}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {order.items.length > 2 && (
                    <Text style={styles.moreItems}>
                      +{order.items.length - 2} autre(s) article(s)
                    </Text>
                  )}
                </View>

                {renderProgressBar(order.status)}

                <View style={styles.orderFooter}>
                  <View>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalAmount}>{formatPrice(order.totalAmount)}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.detailsButton}
                    onPress={() => {
                      setSelectedOrder(order);
                      setDetailsModalVisible(true);
                    }}
                  >
                    <Text style={styles.detailsButtonText}>Détails</Text>
                    <ChevronRight size={18} color="#00853F" />
                  </TouchableOpacity>
                </View>

                {currentUser && canReviewOrder(order, currentUser.id) && (
                  <TouchableOpacity
                    style={styles.reviewButton}
                    onPress={() => {
                      setSelectedOrder(order);
                      setReviewModalVisible(true);
                    }}
                  >
                    <Star size={16} color="#F59E0B" fill="#F59E0B" />
                    <Text style={styles.reviewButtonText}>Laisser un avis</Text>
                  </TouchableOpacity>
                )}

                {order.status === 'rejected' && order.rejectionReason && (
                  <View style={styles.rejectionReason}>
                    <XCircle size={16} color="#E31B23" />
                    <View style={styles.rejectionReasonContent}>
                      <Text style={styles.rejectionReasonLabel}>Raison du rejet:</Text>
                      <Text style={styles.rejectionReasonText}>{order.rejectionReason}</Text>
                    </View>
                  </View>
                )}

                {currentUser?.isSuperAdmin && (
                  <TouchableOpacity
                    style={styles.deleteOrderButton}
                    onPress={() => {
                      toast.showAlert(
                        'Supprimer la commande',
                        `Êtes-vous sûr de vouloir supprimer cette commande #${order.id.slice(-8)} ? Cette action est irréversible.`,
                        [
                          { text: 'Annuler', style: 'cancel' },
                          {
                            text: 'Supprimer',
                            style: 'destructive',
                            onPress: async () => {
                              const result = await deleteOrder(order.id);
                              if (result.success) {
                                toast.showSuccess('La commande a été supprimée');
                              } else {
                                toast.showError(result.error || 'Erreur lors de la suppression');
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Trash2 size={18} color="#E31B23" />
                    <Text style={styles.deleteOrderButtonText}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Package size={64} color="#ddd" />
            <Text style={styles.emptyStateText}>Aucune commande</Text>
            <Text style={styles.emptyStateSubtext}>
              Vos commandes apparaîtront ici après vos achats
            </Text>
          </View>
        )}
      </ScrollView>

      <ReviewModal
        visible={reviewModalVisible}
        order={selectedOrder}
        onClose={() => {
          setReviewModalVisible(false);
          setSelectedOrder(null);
        }}
        onSubmit={(rating, comment) => {
          if (currentUser && selectedOrder) {
            selectedOrder.items.forEach(item => {
              addReview(
                selectedOrder.id,
                item.product.id,
                item.product.sellerId,
                currentUser.id,
                currentUser.name,
                currentUser.avatar,
                rating,
                comment
              );
            });
          }
        }}
      />

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
              { value: 'pending', label: 'En attente', count: getFilterCount('pending') },
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
                  setSelectedFilter(option.value as OrderStatus | 'all');
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
        visible={detailsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setDetailsModalVisible(false);
          setSelectedOrder(null);
        }}
      >
        <View style={styles.detailsModalOverlay}>
          <View style={styles.detailsModalContent}>
            <View style={styles.detailsModalHeader}>
              <View>
                <Text style={styles.detailsModalTitle}>Détails de la commande</Text>
                {selectedOrder && (
                  <Text style={styles.detailsModalSubtitle}>#{selectedOrder.id.slice(-8).toUpperCase()}</Text>
                )}
              </View>
              <TouchableOpacity 
                style={styles.detailsModalCloseButton}
                onPress={() => {
                  setDetailsModalVisible(false);
                  setSelectedOrder(null);
                }}
              >
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView 
                style={styles.detailsModalScroll}
                showsVerticalScrollIndicator={true}
              >
                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>Informations de livraison</Text>
                  <View style={styles.detailsInfoRow}>
                    <User size={16} color="#666" />
                    <Text style={styles.detailsInfoText}>{selectedOrder.deliveryName || selectedOrder.userName}</Text>
                  </View>
                  <View style={styles.detailsInfoRow}>
                    <Phone size={16} color="#666" />
                    <Text style={styles.detailsInfoText}>{selectedOrder.deliveryPhone || selectedOrder.userPhone}</Text>
                  </View>
                  {selectedOrder.deliveryAddress && (
                    <View style={styles.detailsInfoRow}>
                      <MapPin size={16} color="#666" />
                      <Text style={styles.detailsInfoText}>{selectedOrder.deliveryAddress}</Text>
                    </View>
                  )}
                  {selectedOrder.deliveryCity && (
                    <View style={styles.detailsInfoRow}>
                      <MapPin size={16} color="#666" />
                      <Text style={styles.detailsInfoText}>{selectedOrder.deliveryCity}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>Produits</Text>
                  {selectedOrder.items.map((item, index) => (
                    <View key={index} style={styles.detailsProductCard}>
                      <Image 
                        source={{ uri: item.product.images[0] }} 
                        style={styles.detailsProductImage} 
                      />
                      <View style={styles.detailsProductInfo}>
                        <Text style={styles.detailsProductTitle}>{item.product.title}</Text>
                        <Text style={styles.detailsProductQuantity}>Quantité : {item.quantity}</Text>
                        <Text style={styles.detailsProductPrice}>
                          {formatPrice(item.priceAtPurchase)} × {item.quantity} = {formatPrice(item.priceAtPurchase * item.quantity)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.detailsSection}>
                  <View style={styles.detailsTotalRow}>
                    <Text style={styles.detailsTotalLabel}>Total</Text>
                    <Text style={styles.detailsTotalAmount}>{formatPrice(selectedOrder.totalAmount)}</Text>
                  </View>
                </View>

                {selectedOrder.rejectionReason && (
                  <View style={[styles.detailsSection, styles.detailsRejectionSection]}>
                    <View style={styles.detailsInfoRow}>
                      <XCircle size={16} color="#E31B23" />
                      <Text style={[styles.detailsInfoText, { color: '#E31B23', fontWeight: '600' }]}>
                        Raison du rejet
                      </Text>
                    </View>
                    <Text style={styles.detailsRejectionText}>{selectedOrder.rejectionReason}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  filterSelectorContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingHorizontal: 16,
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
    color: '#00853F',
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
    backgroundColor: '#FFF8F0',
    borderWidth: 2,
    borderColor: '#00853F',
  },
  filterModalOptionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#666',
  },
  filterModalOptionTextActive: {
    color: '#00853F',
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
    color: '#00853F',
    backgroundColor: '#FFE4D6',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
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
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
  itemsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  orderItem: {
    flexDirection: 'row',
    gap: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    resizeMode: 'cover' as const,
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
    color: '#00853F',
  },
  moreItems: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic' as const,
    marginTop: 4,
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
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#00853F20',
    borderRadius: 8,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#00853F',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF9E6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#F59E0B',
  },
  rejectionReason: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#E31B23',
  },
  rejectionReasonContent: {
    flex: 1,
  },
  rejectionReasonLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#E31B23',
    marginBottom: 4,
  },
  rejectionReasonText: {
    fontSize: 13,
    color: '#666',
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
    paddingHorizontal: 32,
  },
  notAuthContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  notAuthTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  notAuthSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#00853F',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  progressContainer: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00853F',
    borderRadius: 2,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  stepItem: {
    alignItems: 'center',
    gap: 8,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#00853F',
  },
  stepLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600' as const,
  },
  stepLabelActive: {
    color: '#00853F',
  },
  deleteOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#E31B23',
  },
  deleteOrderButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#E31B23',
  },
  detailsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailsModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  detailsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailsModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  detailsModalSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  detailsModalCloseButton: {
    padding: 4,
  },
  detailsModalScroll: {
    maxHeight: '100%',
  },
  detailsSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailsSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 12,
  },
  detailsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailsInfoText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailsProductCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 8,
  },
  detailsProductImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  detailsProductInfo: {
    flex: 1,
    gap: 4,
  },
  detailsProductTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#000',
  },
  detailsProductQuantity: {
    fontSize: 13,
    color: '#666',
  },
  detailsProductPrice: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#00853F',
  },
  detailsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsTotalLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#666',
  },
  detailsTotalAmount: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
  },
  detailsRejectionSection: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#E31B23',
  },
  detailsRejectionText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginLeft: 24,
  },
});
