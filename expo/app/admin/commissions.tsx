import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { 
  DollarSign,
  Users,
  Receipt,
  CheckCircle,
  Clock,
} from 'lucide-react-native';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useToast } from '@/contexts/ToastContext';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';

import { isWeb, getContainerPadding } from '@/constants/responsive';
import { FALLBACK_AVATAR_SMALL, getFallbackAvatar, formatPrice } from '@/constants/appConfig';
import { supabase } from '@/lib/supabase';

interface CommissionPayment {
  id: string;
  partner_user_id: string;
  product_id: string;
  commission_amount: number;
  commission_rate: number;
  status: 'pending' | 'paid';
  paid_at: string | null;
  paid_by: string | null;
  created_at: string;
  updated_at: string;
}

interface CommissionData extends CommissionPayment {
  partner_name: string;
  partner_phone: string;
  partner_avatar: string;
  product_title: string;
  product_price: number;
  seller_name: string;
}

export default function AllCommissionsScreen() {
  const { currentUser } = useMarketplace();
  const toast = useToast();
  useGlobalSettings();
  
  const [commissions, setCommissions] = useState<CommissionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCommissions, setTotalCommissions] = useState(0);

  const isSuperAdmin = currentUser?.isSuperAdmin === true;

  useEffect(() => {
    if (isSuperAdmin) {
      loadAllCommissions();
    } else {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const loadAllCommissions = async () => {
    try {
      setIsLoading(true);
      console.log('[Commissions] Loading all commissions...');
      
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('commission_payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (paymentsError) {
        console.error('[Commissions] Error loading commissions:', paymentsError);
        toast.showError('Erreur lors du chargement des commissions');
        return;
      }

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, phone, avatar, is_partner');

      if (usersError) {
        console.error('[Commissions] Error loading users:', usersError);
        toast.showError('Erreur lors du chargement des utilisateurs');
        return;
      }

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, title, price, seller_name');

      if (productsError) {
        console.error('[Commissions] Error loading products:', productsError);
        toast.showError('Erreur lors du chargement des produits');
        return;
      }

      console.log('[Commissions] Payments:', paymentsData?.length || 0);
      console.log('[Commissions] Users:', usersData?.length || 0);
      console.log('[Commissions] Products:', productsData?.length || 0);

      const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
      const productsMap = new Map(productsData?.map(p => [p.id, p]) || []);

      const commissionsData: CommissionData[] = [];
      let total = 0;

      for (const payment of paymentsData || []) {
        const partner = usersMap.get(payment.partner_user_id);
        const product = productsMap.get(payment.product_id);
        
        commissionsData.push({
          id: payment.id,
          partner_user_id: payment.partner_user_id,
          partner_name: partner?.name || 'Partenaire inconnu',
          partner_phone: partner?.phone || '',
          partner_avatar: partner?.avatar || FALLBACK_AVATAR_SMALL,
          product_id: payment.product_id,
          product_title: product?.title || 'Produit inconnu',
          product_price: product?.price || 0,
          seller_name: product?.seller_name || 'Vendeur inconnu',
          commission_amount: payment.commission_amount,
          commission_rate: payment.commission_rate,
          status: payment.status,
          paid_at: payment.paid_at,
          paid_by: payment.paid_by,
          created_at: payment.created_at,
          updated_at: payment.updated_at,
        });

        total += payment.commission_amount;
      }

      console.log('[Commissions] Loaded commissions:', commissionsData.length);
      setCommissions(commissionsData);
      setTotalCommissions(total);
    } catch (error) {
      console.error('[Commissions] Error loading commissions:', error);
      toast.showError('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Accès Refusé', headerShown: true }} />
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Accès Refusé</Text>
          <Text style={styles.accessDeniedText}>
            Seul le super administrateur peut accéder à cette page.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', { 
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const markAsPaid = async (paymentId: string) => {
    if (!currentUser) return;
    
    toast.showAlert(
      'Marquer comme payée',
      'Voulez-vous vraiment marquer cette commission comme payée ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              console.log('[Commissions] Marking as paid:', paymentId);
              
              const { error } = await supabase
                .from('commission_payments')
                .update({
                  status: 'paid',
                  paid_at: new Date().toISOString(),
                  paid_by: currentUser.id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', paymentId);

              if (error) {
                console.error('[Commissions] Error marking as paid:', error);
                toast.showError('Erreur lors du paiement de la commission');
                return;
              }

              console.log('[Commissions] Marked as paid successfully');
              toast.showSuccess('Commission marquée comme payée');
              loadAllCommissions();
            } catch (error) {
              console.error('[Commissions] Error marking as paid:', error);
              toast.showError('Erreur lors du paiement');
            }
          },
        },
      ]
    );
  };

  const groupedByPartner = commissions.reduce((acc, commission) => {
    if (!acc[commission.partner_user_id]) {
      acc[commission.partner_user_id] = {
        partner: {
          id: commission.partner_user_id,
          name: commission.partner_name,
          phone: commission.partner_phone,
          avatar: commission.partner_avatar,
        },
        commissions: [],
        total: 0,
        totalPending: 0,
        totalPaid: 0,
      };
    }
    acc[commission.partner_user_id].commissions.push(commission);
    acc[commission.partner_user_id].total += commission.commission_amount;
    if (commission.status === 'pending') {
      acc[commission.partner_user_id].totalPending += commission.commission_amount;
    } else {
      acc[commission.partner_user_id].totalPaid += commission.commission_amount;
    }
    return acc;
  }, {} as Record<string, { partner: { id: string; name: string; phone: string; avatar: string }; commissions: CommissionData[]; total: number; totalPending: number; totalPaid: number }>);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Commissions', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00853F" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Toutes les Commissions', 
          headerShown: true,
          headerStyle: {
            backgroundColor: '#fff',
          },
        }} 
      />
      
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Users size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{Object.keys(groupedByPartner).length}</Text>
          <Text style={styles.statLabel}>Partenaires actifs</Text>
        </View>
        <View style={styles.statCard}>
          <Receipt size={24} color="#10B981" />
          <Text style={styles.statValue}>{commissions.length}</Text>
          <Text style={styles.statLabel}>Commissions</Text>
        </View>
        <View style={styles.statCard}>
          <DollarSign size={24} color="#FFD700" />
          <Text style={styles.statValuePrice}>{formatPrice(totalCommissions)}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {Object.keys(groupedByPartner).length > 0 ? (
          Object.values(groupedByPartner).map((group) => (
            <View key={group.partner.id} style={styles.partnerSection}>
              <View style={styles.partnerHeader}>
                <Image 
                  source={{ uri: group.partner.avatar }} 
                  style={styles.partnerAvatar} 
                />
                <View style={styles.partnerInfo}>
                  <Text style={styles.partnerName}>{group.partner.name}</Text>
                  <Text style={styles.partnerPhone}>{group.partner.phone}</Text>
                  <View style={styles.partnerStatsRow}>
                    <View style={styles.partnerStatBadge}>
                      <Clock size={12} color="#F59E0B" />
                      <Text style={styles.partnerStatText}>{formatPrice(group.totalPending)}</Text>
                    </View>
                    <View style={styles.partnerStatBadge}>
                      <CheckCircle size={12} color="#10B981" />
                      <Text style={styles.partnerStatText}>{formatPrice(group.totalPaid)}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.partnerTotal}>
                  <Text style={styles.partnerTotalLabel}>Total</Text>
                  <Text style={styles.partnerTotalValue}>{formatPrice(group.total)}</Text>
                </View>
              </View>

              <View style={styles.commissionsContainer}>
                {group.commissions.map((commission) => (
                  <View key={commission.id} style={styles.commissionCard}>
                    <View style={styles.commissionHeader}>
                      <Text style={styles.commissionTitle} numberOfLines={1}>
                        {commission.product_title}
                      </Text>
                      <View style={[
                        styles.commissionStatusBadge,
                        commission.status === 'paid' ? styles.commissionStatusPaid : styles.commissionStatusPending
                      ]}>
                        <Text style={styles.commissionStatusText}>
                          {commission.status === 'paid' ? 'Payée' : 'En attente'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.commissionSeller}>Vendu par: {commission.seller_name}</Text>
                    <View style={styles.commissionDetails}>
                      <View style={styles.commissionDetailRow}>
                        <Text style={styles.commissionDetailLabel}>Prix produit:</Text>
                        <Text style={styles.commissionDetailValue}>{formatPrice(commission.product_price)}</Text>
                      </View>
                      <View style={styles.commissionDetailRow}>
                        <Text style={styles.commissionDetailLabel}>Commission ({commission.commission_rate}%):</Text>
                        <Text style={styles.commissionAmount}>{formatPrice(commission.commission_amount)}</Text>
                      </View>
                    </View>
                    <View style={styles.commissionFooter}>
                      <Text style={styles.commissionDate}>
                        {formatDate(commission.created_at)}
                      </Text>
                      {commission.status === 'pending' && (
                        <TouchableOpacity
                          style={styles.payButton}
                          onPress={() => markAsPaid(commission.id)}
                        >
                          <CheckCircle size={16} color="#FFF" />
                          <Text style={styles.payButtonText}>Marquer comme payée</Text>
                        </TouchableOpacity>
                      )}
                      {commission.status === 'paid' && commission.paid_at && (
                        <Text style={styles.paidDate}>
                          Payée le {formatDate(commission.paid_at)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Receipt size={64} color="#ddd" />
            <Text style={styles.emptyStateText}>Aucune commission</Text>
            <Text style={styles.emptyStateSubtext}>
              Les commissions apparaîtront ici quand les produits référés seront validés
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: getContainerPadding(),
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
  },
  statValuePrice: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#000',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: getContainerPadding(),
    paddingBottom: 100,
  },
  partnerSection: {
    marginBottom: 24,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
  },
  partnerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  partnerPhone: {
    fontSize: 13,
    color: '#666',
  },
  partnerTotal: {
    alignItems: 'flex-end',
  },
  partnerTotalLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  partnerTotalValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  commissionsContainer: {
    gap: 12,
  },
  commissionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  commissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  commissionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
    flex: 1,
  },
  commissionStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  commissionStatusPaid: {
    backgroundColor: '#D1FAE5',
  },
  commissionStatusPending: {
    backgroundColor: '#FEF3C7',
  },
  commissionStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  commissionSeller: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  commissionDetails: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  commissionDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commissionDetailLabel: {
    fontSize: 12,
    color: '#666',
  },
  commissionDetailValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#000',
  },
  commissionAmount: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  commissionDate: {
    fontSize: 11,
    color: '#999',
  },
  commissionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  payButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  paidDate: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600' as const,
  },
  partnerStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  partnerStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f5f5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  partnerStatText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    backgroundColor: '#fff',
    borderRadius: 16,
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
    marginBottom: 16,
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
  },
  backButtonText: {
    fontSize: isWeb ? 16 : 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
