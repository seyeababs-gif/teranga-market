import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { Stack, router } from 'expo-router';
import { 
  Copy,
  TrendingUp,
  Users,
  DollarSign,
  Crown,
  CheckCircle,
  Clock,
} from 'lucide-react-native';
import { usePartners } from '@/contexts/PartnersContext';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useToast } from '@/contexts/ToastContext';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';
import { isWeb, getContainerPadding } from '@/constants/responsive';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/constants/appConfig';

export default function PartnerDashboardScreen() {
  usePartners();
  const { currentUser } = useMarketplace();
  const toast = useToast();
  const { globalSettings } = useGlobalSettings();
  
  const [stats, setStats] = useState<any>(null);
  const [partnerCode, setPartnerCode] = useState<string>('');
  const [commissionStats, setCommissionStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isPartner = currentUser?.isPartner === true;

  useEffect(() => {
    if (isPartner && currentUser) {
      loadPartnerData();
    } else {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isPartner]);

  const loadPartnerData = async () => {
    if (!currentUser) return;
    
    try {
      setIsLoading(true);
      console.log('[Dashboard] Loading partner data for:', currentUser.id);
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('partner_referral_code')
        .eq('id', currentUser.id)
        .single();
      
      if (userError) {
        console.error('[Dashboard] Error loading user data:', userError);
      } else if (userData?.partner_referral_code) {
        setPartnerCode(userData.partner_referral_code);
        console.log('[Dashboard] Partner referral code:', userData.partner_referral_code);
      }
      
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('partner_id', currentUser.id)
        .eq('discount_code_applied', true)
        .order('created_at', { ascending: false });
      
      console.log('[Dashboard] Products with partner code:', productsData?.length || 0);
      console.log('[Dashboard] Products error:', productsError);
      
      if (productsError) {
        console.error('[Dashboard] Error loading products:', productsError);
      }
      
      const productsWithCode = productsData || [];
      
      const uniqueClients = new Map();
      let totalCommission = 0;
      let totalApprovedCommission = 0;
      let totalPendingCommission = 0;
      let totalPaidCommission = 0;
      
      productsWithCode.forEach((product: any) => {
        const sellerId = product.seller_id;
        if (!uniqueClients.has(sellerId)) {
          uniqueClients.set(sellerId, {
            id: sellerId,
            seller_name: product.seller_name,
            seller_phone: product.seller_phone,
            seller_avatar: product.seller_avatar,
            total_products: 0,
            total_discount_received: 0,
            first_use_date: product.created_at,
            products: [],
          });
        }
        
        const client = uniqueClients.get(sellerId);
        client.total_products += 1;
        client.total_discount_received += product.discount_amount || 0;
        client.products.push({
          product_id: product.id,
          product_title: product.title,
          product_price: product.price,
          created_at: product.created_at,
          status: product.status,
        });
        
        if (product.status === 'approved') {
          const commissionRate = globalSettings.partnerCommissionRate || 5;
          const commission = (product.price * commissionRate) / 100;
          totalCommission += commission;
          totalApprovedCommission += commission;
          
          if (product.partner_commission_paid) {
            totalPaidCommission += commission;
          } else {
            totalPendingCommission += commission;
          }
        }
      });
      
      setStats({
        total_clients: uniqueClients.size,
        total_sales: productsWithCode.length,
        total_commission_earned: totalCommission,
      });
      
      setCommissionStats({
        total_earned: totalApprovedCommission,
        total_pending: totalPendingCommission,
        total_paid: totalPaidCommission,
      });
    } catch (error) {
      console.error('[Dashboard] Error loading partner data:', error);
      toast.showError('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Connexion requise', headerShown: true }} />
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Connexion requise</Text>
          <Text style={styles.accessDeniedText}>
            Connectez-vous pour accéder à votre tableau de bord partenaire.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.backButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!isPartner) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Accès Refusé', headerShown: true }} />
        <View style={styles.accessDeniedContainer}>
          <Crown size={64} color="#FFD700" />
          <Text style={styles.accessDeniedTitle}>Statut Partenaire Requis</Text>
          <Text style={styles.accessDeniedText}>
            Cette section est réservée aux partenaires. Contactez l&apos;administrateur pour devenir partenaire.
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

  const copyToClipboard = async (text: string) => {
    await ExpoClipboard.setStringAsync(text);
    toast.showSuccess('Code copié dans le presse-papier');
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Tableau de bord', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00853F" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  const totalClients = typeof stats?.total_clients === 'number' ? stats.total_clients : 0;
  const totalSales = typeof stats?.total_sales === 'number' ? stats.total_sales : 0;
  const totalCommission = typeof stats?.total_commission_earned === 'number' ? stats.total_commission_earned : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: '👑 Tableau de bord Partenaire', 
          headerShown: true,
          headerStyle: {
            backgroundColor: '#fff',
          },
        }} 
      />
      
      <View style={styles.headerBanner}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Crown size={28} color="#FFD700" fill="#FFD700" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Bienvenue, Partenaire !</Text>
            <Text style={styles.headerSubtitle}>{currentUser.name}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Users size={24} color="#3B82F6" />
            <Text style={styles.statValue}>{totalClients}</Text>
            <Text style={styles.statLabel}>Clients utilisant mon code</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp size={24} color="#10B981" />
            <Text style={styles.statValue}>{totalSales}</Text>
            <Text style={styles.statLabel}>Produits référés</Text>
          </View>
          <View style={styles.statCard}>
            <DollarSign size={24} color="#FFD700" />
            <Text style={styles.statValuePrice}>{formatPrice(typeof commissionStats?.total_earned === 'number' ? commissionStats.total_earned : totalCommission)}</Text>
            <Text style={styles.statLabel}>Commission totale</Text>
          </View>
        </View>

        {partnerCode && (
          <View style={styles.personalCodeSection}>
            <View style={styles.personalCodeRow}>
              <View style={styles.personalCodeContent}>
                <Text style={styles.personalCodeLabel}>Votre code de parrainage</Text>
                <Text style={styles.personalCodeText}>{partnerCode}</Text>
                <Text style={styles.personalCodeHint}>
                  Partagez ce code avec les vendeurs pour gagner des commissions !
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => copyToClipboard(partnerCode)}
                style={styles.personalCodeCopyButton}
              >
                <Copy size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {(commissionStats && (commissionStats.total_pending > 0 || commissionStats.total_paid > 0)) && (
          <View style={styles.statsCommissionContainer}>
            <View style={styles.commissionStatCard}>
              <Clock size={20} color="#F59E0B" />
              <Text style={styles.commissionStatValue}>{formatPrice(typeof commissionStats.total_pending === 'number' ? commissionStats.total_pending : 0)}</Text>
              <Text style={styles.commissionStatLabel}>En attente</Text>
            </View>
            <View style={styles.commissionStatCard}>
              <CheckCircle size={20} color="#10B981" />
              <Text style={styles.commissionStatValue}>{formatPrice(typeof commissionStats.total_paid === 'number' ? commissionStats.total_paid : 0)}</Text>
              <Text style={styles.commissionStatLabel}>Payées</Text>
            </View>
          </View>
        )}



        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 Comment ça marche ?</Text>
          <Text style={styles.infoText}>
            1. Partagez votre code <Text style={styles.infoBold}>{partnerCode}</Text> avec des vendeurs
          </Text>
          <Text style={styles.infoText}>
            2. Quand ils publient un produit, ils entrent votre code
          </Text>
          <Text style={styles.infoText}>
            3. Ils obtiennent une réduction sur les frais de publication
          </Text>
          <Text style={styles.infoText}>
            4. Dès que le produit est validé, vous gagnez une commission !
          </Text>
          <Text style={styles.infoText}>
            5. Vous pouvez suivre vos gains en temps réel ici
          </Text>
        </View>
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
  headerBanner: {
    backgroundColor: '#fff',
    paddingHorizontal: getContainerPadding(),
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF9E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: getContainerPadding(),
    paddingVertical: 20,
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
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
  },
  statValuePrice: {
    fontSize: 16,
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
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: getContainerPadding(),
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  usersGrid: {
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: getContainerPadding(),
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1E40AF',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 8,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '700' as const,
    fontSize: 16,
    letterSpacing: 1,
  },
  personalCodeSection: {
    backgroundColor: '#00853F',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: getContainerPadding(),
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  personalCodeContent: {
    flex: 1,
  },
  personalCodeLabel: {
    fontSize: 12,
    color: '#FFF',
    marginBottom: 6,
    fontWeight: '600' as const,
    opacity: 0.9,
  },
  personalCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  personalCodeText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 6,
  },
  personalCodeCopyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalCodeHint: {
    fontSize: 12,
    color: '#FFF',
    lineHeight: 16,
    opacity: 0.9,
  },
  accessDeniedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
    textAlign: 'center',
    marginTop: 16,
  },
  accessDeniedText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  backButton: {
    backgroundColor: '#00853F',
    paddingVertical: isWeb ? 16 : 14,
    paddingHorizontal: isWeb ? 40 : 32,
    borderRadius: 12,
    marginTop: 16,
  },
  backButtonText: {
    fontSize: isWeb ? 16 : 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  statsCommissionContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: getContainerPadding(),
    marginBottom: 20,
  },
  commissionStatCard: {
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
  },
  commissionStatValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
    textAlign: 'center',
  },
  commissionStatLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  commissionsGrid: {
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
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  commissionDate: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
  },
  clientCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  clientPhone: {
    fontSize: 13,
    color: '#666',
  },
  clientStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  clientStatItem: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
  },
  clientStatLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  clientStatValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#000',
  },
  clientFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    gap: 8,
  },
  clientDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clientDate: {
    fontSize: 11,
    color: '#999',
  },
  clientProductsPreview: {
    marginTop: 8,
    gap: 6,
  },
  clientProductsTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 4,
  },
  clientProductItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  clientProductTitle: {
    fontSize: 12,
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  clientProductPrice: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#00853F',
  },
  clientProductsMore: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
});
