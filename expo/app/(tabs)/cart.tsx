import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Trash2, Plus, Minus, MessageCircle } from 'lucide-react-native';
import { useCart } from '@/contexts/CartContext';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useOrders } from '@/contexts/OrderContext';
import { useToast } from '@/contexts/ToastContext';
import { CartItem } from '@/types/marketplace';
import { formatPrice } from '@/constants/appConfig';

export default function CartScreen() {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart } = useCart();
  const { isAuthenticated, currentUser } = useMarketplace();
  const { createOrder } = useOrders();
  const toast = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
  });
  const router = useRouter();

  const handleCheckout = () => {
    if (cartItems.length === 0) return;

    if (!isAuthenticated || !currentUser) {
      toast.showAlert(
        'Connexion requise',
        'Connectez-vous pour contacter les vendeurs.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }

    setDeliveryInfo({
      name: currentUser.name,
      phone: currentUser.deliveryPhone || currentUser.phone || '',
      address: currentUser.deliveryAddress || '',
      city: currentUser.deliveryCity || '',
    });
    setShowConfirmModal(true);
  };

  const handleConfirmOrder = async () => {
    if (!currentUser) return;
    if (!deliveryInfo.name.trim() || !deliveryInfo.phone.trim() || !deliveryInfo.address.trim() || !deliveryInfo.city.trim()) {
      toast.showError('Veuillez remplir tous les champs');
      return;
    }

    setIsProcessing(true);

    try {
      const order = await createOrder(cartItems, currentUser, deliveryInfo);

      if (order) {
        clearCart();
        setDeliveryInfo({ name: '', phone: '', address: '', city: '' });
        setShowConfirmModal(false);
        setIsProcessing(false);

        toast.showSuccess('Commande créée ! Les vendeurs vous contacteront pour finaliser.');

        setTimeout(() => {
          router.push('/orders');
        }, 100);
      } else {
        toast.showError('Une erreur est survenue.');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.showError('Une erreur est survenue.');
      setIsProcessing(false);
    }
  };

  const handleContactAllSellers = () => {
    if (!isAuthenticated) {
      toast.showAlert(
        'Connexion requise',
        'Connectez-vous pour contacter les vendeurs.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }

    const sellerPhones = [...new Set(cartItems.map(item => item.product.sellerPhone))];
    if (sellerPhones.length === 0) return;

    const itemList = cartItems.map(item =>
      `• ${item.quantity}x ${item.product.title} — ${formatPrice(item.product.price * item.quantity)}`
    ).join('\n');

    const firstPhone = sellerPhones[0].replace(/[^0-9]/g, '');
    const message = encodeURIComponent(
      `Bonjour, je suis intéressé par vos articles sur Teranga Market :\n\n${itemList}\n\nTotal: ${formatPrice(getCartTotal())}\n\nPouvez-vous me donner plus d'informations ?`
    );
    const whatsappUrl = `https://wa.me/${firstPhone}?text=${message}`;
    Linking.canOpenURL(whatsappUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(whatsappUrl);
        } else {
          toast.showError('WhatsApp n\'est pas disponible.');
        }
      })
      .catch((err) => console.error('Error opening WhatsApp:', err));
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const hasDiscount = item.product.hasDiscount && item.product.discountPercent && item.product.discountPercent > 0;
    const price = hasDiscount && item.product.originalPrice
      ? item.product.originalPrice * (1 - (item.product.discountPercent || 0) / 100)
      : item.product.price;
    const itemTotal = price * item.quantity;

    return (
      <View style={styles.cartItem}>
        <Image source={{ uri: item.product.images[0] }} style={styles.productImage} />
        <View style={styles.itemInfo}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {item.product.title}
          </Text>
          {hasDiscount && item.product.originalPrice ? (
            <View style={styles.priceDiscountContainer}>
              <Text style={styles.productPriceDiscount}>{formatPrice(price)}</Text>
              <Text style={styles.productPriceOriginal}>{formatPrice(item.product.originalPrice)}</Text>
            </View>
          ) : (
            <Text style={styles.productPrice}>{formatPrice(item.product.price)}</Text>
          )}
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
            >
              <Minus size={16} color="#666" />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
            >
              <Plus size={16} color="#666" />
            </TouchableOpacity>
          </View>
          <Text style={styles.itemTotal}>Total: {formatPrice(itemTotal)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => removeFromCart(item.product.id)}
        >
          <Trash2 size={20} color="#E31B23" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Votre panier est vide 🛒</Text>
          <Text style={styles.emptySubtext}>
            Parcourez les articles de la diaspora sénégalaise
          </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Mon Panier', headerShown: true }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          cartItems.length === 0 && styles.emptyListContent,
        ]}
        showsVerticalScrollIndicator={true}
      >
        {cartItems.length === 0 ? (
          renderEmptyCart()
        ) : (
          <View style={styles.cartItemsContainer}>
            {cartItems.map((item) => (
              <View key={item.product.id}>
                {renderCartItem({ item })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {cartItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatPrice(getCartTotal())}</Text>
          </View>
          <TouchableOpacity
            style={styles.contactAllButton}
            onPress={handleContactAllSellers}
          >
            <MessageCircle size={20} color="#fff" />
            <Text style={styles.contactAllButtonText}>Contacter les vendeurs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.checkoutButton, isProcessing && styles.checkoutButtonDisabled]}
            onPress={handleCheckout}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.checkoutButtonText}>Création...</Text>
              </View>
            ) : (
              <Text style={styles.checkoutButtonText}>Créer ma commande</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Informations de livraison</Text>
              <Text style={styles.modalSubtitle}>
                Confirmez vos informations pour créer votre commande
              </Text>

              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nom complet</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Votre nom complet"
                    value={deliveryInfo.name}
                    onChangeText={(text) => setDeliveryInfo({ ...deliveryInfo, name: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Numéro de téléphone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 06 12 34 56 78"
                    value={deliveryInfo.phone}
                    onChangeText={(text) => setDeliveryInfo({ ...deliveryInfo, phone: text })}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Adresse de livraison</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Votre adresse complète"
                    value={deliveryInfo.address}
                    onChangeText={(text) => setDeliveryInfo({ ...deliveryInfo, address: text })}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Ville</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Votre ville"
                    value={deliveryInfo.city}
                    onChangeText={(text) => setDeliveryInfo({ ...deliveryInfo, city: text })}
                  />
                </View>
              </View>

              <View style={styles.orderSummary}>
                <Text style={styles.summaryTitle}>Récapitulatif</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{cartItems.length} article(s)</Text>
                  <Text style={styles.summaryValue}>{formatPrice(getCartTotal())}</Text>
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setShowConfirmModal(false)}
                >
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={handleConfirmOrder}
                >
                  <Text style={styles.modalConfirmButtonText}>Confirmer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF2',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  cartItemsContainer: {
    gap: 0,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0E6D7',
    gap: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
  },
  productPrice: {
    fontSize: 14,
    color: '#666',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
    minWidth: 24,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#00853F',
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
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
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#00853F',
  },
  contactAllButton: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  contactAllButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  checkoutButton: {
    backgroundColor: '#00853F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutButtonDisabled: {
    backgroundColor: '#00A650',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkoutButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  formContainer: {
    gap: 16,
    marginBottom: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#F0E6D7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  orderSummary: {
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#00853F',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F1F5F9',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#64748B',
  },
  modalConfirmButton: {
    backgroundColor: '#00853F',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  priceDiscountContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  productPriceDiscount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#E31B23',
  },
  productPriceOriginal: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#999',
    textDecorationLine: 'line-through' as const,
  },
});
