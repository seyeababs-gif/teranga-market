import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { 
  Crown,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  ArrowLeft,
  CheckCheck,
  Trash2,
  XCircle,
  Edit,
} from 'lucide-react-native';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useToast } from '@/contexts/ToastContext';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';
import { isWeb, getContainerPadding } from '@/constants/responsive';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/constants/appConfig';

interface Commission {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_phone: string;
  product_id: string;
  product_title: string;
  product_price: number;
  commission_amount: number;
  status: 'pending' | 'paid';
  created_at: string;
  paid_at?: string;
}

export default function AdminPartnerProfileScreen() {
  const { id } = useLocalSearchParams();
  const { currentUser, allUsers } = useMarketplace();
  const toast = useToast();
  const { globalSettings } = useGlobalSettings();
  
  const [partner, setPartner] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPayingCommission, setIsPayingCommission] = useState<string | null>(null);
  const [isUnpayingCommission, setIsUnpayingCommission] = useState<string | null>(null);
  const [isDeletingCommission, setIsDeletingCommission] = useState<string | null>(null);
  const [editCodeModalVisible, setEditCodeModalVisible] = useState(false);
  const [newPartnerCode, setNewPartnerCode] = useState('');
  const [isUpdatingCode, setIsUpdatingCode] = useState(false);

  const isSuperAdmin = currentUser?.isSuperAdmin === true;

  useEffect(() => {
    if (isSuperAdmin && id) {
      loadPartnerData();
    } else {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isSuperAdmin]);

  const handleEditCode = () => {
    setNewPartnerCode(partner?.partnerReferralCode || '');
    setEditCodeModalVisible(true);
  };

  const handleUpdateCode = async () => {
    if (!newPartnerCode.trim()) {
      toast.showError('Le code ne peut pas être vide');
      return;
    }

    if (newPartnerCode === partner?.partnerReferralCode) {
      setEditCodeModalVisible(false);
      return;
    }

    try {
      setIsUpdatingCode(true);
      console.log('[AdminPartnerProfile] Updating partner code to:', newPartnerCode);
      
      const { error } = await supabase
        .from('users')
        .update({ partner_referral_code: newPartnerCode.toUpperCase() })
        .eq('id', id);
      
      if (error) {
        console.error('[AdminPartnerProfile] Error updating code:', error);
        toast.showError('Erreur lors de la mise à jour du code');
        return;
      }
      
      setPartner({ ...partner, partnerReferralCode: newPartnerCode.toUpperCase() });
      toast.showSuccess('Code de parrainage mis à jour');
      setEditCodeModalVisible(false);
      await loadPartnerData();
    } catch (error) {
      console.error('[AdminPartnerProfile] Error:', error);
      toast.showError('Erreur lors de la mise à jour');
    } finally {
      setIsUpdatingCode(false);
    }
  };

  const loadPartnerData = async () => {
    if (!id) return;
    
    try {
      setIsLoading(true);
      console.log('[AdminPartnerProfile] Loading data for partner:', id);
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      
      if (userError || !userData || !userData.is_partner) {
        console.error('[AdminPartnerProfile] Error loading user:', userError);
        toast.showError('Partenaire introuvable');
        router.back();
        return;
      }
      
      const partnerUser = {
        id: userData.id,
        name: userData.name,
        phone: userData.phone,
        email: userData.email,
        avatar: userData.avatar,
        isPartner: userData.is_partner,
        partnerReferralCode: userData.partner_referral_code,
      };
      
      setPartner(partnerUser);
      
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('partner_id', id)
        .eq('discount_code_applied', true)
        .order('created_at', { ascending: false });
      
      console.log('[AdminPartnerProfile] Products with partner code:', productsData?.length || 0);
      
      if (productsError) {
        console.error('[AdminPartnerProfile] Error loading products:', productsError);
      }
      
      const productsWithCode = productsData || [];
      
      const uniqueClients = new Map();
      let totalCommission = 0;
      let totalPendingCommission = 0;
      let totalPaidCommission = 0;
      const commissionsData: Commission[] = [];
      
      productsWithCode.forEach((product: any) => {
        const sellerId = product.seller_id;
        if (!uniqueClients.has(sellerId)) {
          uniqueClients.set(sellerId, {
            id: sellerId,
            seller_name: product.seller_name,
            seller_phone: product.seller_phone,
            total_products: 0,
          });
        }
        
        const client = uniqueClients.get(sellerId);
        client.total_products += 1;
        
        if (product.status === 'approved') {
          const commissionRate = globalSettings?.partnerCommissionRate || 5;
          const commission = (product.price * commissionRate) / 100;
          totalCommission += commission;
          
          const commissionStatus = product.partner_commission_paid ? 'paid' : 'pending';
          if (commissionStatus === 'pending') {
            totalPendingCommission += commission;
          } else {
            totalPaidCommission += commission;
          }
          
          commissionsData.push({
            id: `${product.id}_commission`,
            seller_id: sellerId,
            seller_name: product.seller_name,
            seller_phone: product.seller_phone,
            product_id: product.id,
            product_title: product.title,
            product_price: product.price,
            commission_amount: commission,
            status: commissionStatus,
            created_at: product.created_at,
            paid_at: product.partner_commission_paid_at,
          });
        }
      });
      
      setStats({
        total_clients: uniqueClients.size,
        total_sales: productsWithCode.length,
        total_commission_earned: totalCommission,
        total_pending: totalPendingCommission,
        total_paid: totalPaidCommission,
      });
      
      setCommissions(commissionsData);
    } catch (error) {
      console.error('[AdminPartnerProfile] Error loading partner data:', error);
      toast.showError('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayCommission = async (commission: Commission) => {
    try {
      setIsPayingCommission(commission.id);
      console.log('[AdminPartnerProfile] Paying commission for product:', commission.product_id);
      
      const { error } = await supabase
        .from('products')
        .update({ 
          partner_commission_paid: true,
          partner_commission_paid_at: new Date().toISOString(),
        })
        .eq('id', commission.product_id);
      
      if (error) {
        console.error('[AdminPartnerProfile] Error paying commission:', error);
        toast.showError(`Erreur: ${error.message}`);
        setIsPayingCommission(null);
        return;
      }
      
      setCommissions(prev => 
        prev.map(c => 
          c.id === commission.id 
            ? { ...c, status: 'paid' as const, paid_at: new Date().toISOString() }
            : c
        )
      );
      
      if (stats) {
        setStats({
          ...stats,
          total_pending: stats.total_pending - commission.commission_amount,
          total_paid: stats.total_paid + commission.commission_amount,
        });
      }
      
      toast.showSuccess('Commission marquée comme payée');
      setIsPayingCommission(null);
    } catch (error) {
      console.error('[AdminPartnerProfile] Error:', error);
      toast.showError('Erreur lors du marquage');
      setIsPayingCommission(null);
    }
  };

  const handleUnpayCommission = async (commission: Commission) => {
    toast.showAlert(
      'Confirmer l\'annulation',
      'Êtes-vous sûr de vouloir annuler cette commission ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUnpayingCommission(commission.id);
              console.log('[AdminPartnerProfile] Unpaying commission for product:', commission.product_id);
              
              const { error } = await supabase
                .from('products')
                .update({ 
                  partner_commission_paid: false,
                  partner_commission_paid_at: null,
                })
                .eq('id', commission.product_id);
              
              if (error) {
                console.error('[AdminPartnerProfile] Error unpaying commission:', error);
                toast.showError('Erreur lors de l\'annulation de la commission');
                setIsUnpayingCommission(null);
                return;
              }
              
              setCommissions(prev => 
                prev.map(c => 
                  c.id === commission.id 
                    ? { ...c, status: 'pending' as const, paid_at: undefined }
                    : c
                )
              );
              
              if (stats) {
                setStats({
                  ...stats,
                  total_pending: stats.total_pending + commission.commission_amount,
                  total_paid: stats.total_paid - commission.commission_amount,
                });
              }
              
              toast.showSuccess('Commission annulée');
              setIsUnpayingCommission(null);
            } catch (error) {
              console.error('[AdminPartnerProfile] Error:', error);
              toast.showError('Erreur lors de l\'annulation');
              setIsUnpayingCommission(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteCommission = async (commission: Commission) => {
    toast.showAlert(
      'Supprimer définitivement',
      'Êtes-vous sûr de vouloir supprimer définitivement cette commission ? Cette action est irréversible.',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingCommission(commission.id);
              console.log('[AdminPartnerProfile] Deleting commission for product:', commission.product_id);
              
              const { error } = await supabase
                .from('products')
                .update({ 
                  discount_code_applied: false,
                  partner_commission_paid: false,
                  partner_commission_paid_at: null,
                  partner_id: null,
                })
                .eq('id', commission.product_id);
              
              if (error) {
                console.error('[AdminPartnerProfile] Error deleting commission:', error);
                toast.showError('Erreur lors de la suppression');
                setIsDeletingCommission(null);
                return;
              }
              
              setCommissions(prev => prev.filter(c => c.id !== commission.id));
              
              if (stats) {
                const newStats = { ...stats };
                newStats.total_sales = stats.total_sales - 1;
                
                if (commission.status === 'pending') {
                  newStats.total_pending = stats.total_pending - commission.commission_amount;
                } else {
                  newStats.total_paid = stats.total_paid - commission.commission_amount;
                }
                
                newStats.total_commission_earned = newStats.total_pending + newStats.total_paid;
                setStats(newStats);
              }
              
              toast.showSuccess('Commission supprimée définitivement');
              setIsDeletingCommission(null);
            } catch (error) {
              console.error('[AdminPartnerProfile] Error:', error);
              toast.showError('Erreur lors de la suppression');
              setIsDeletingCommission(null);
            }
          },
        },
      ]
    );
  };

  if (!isSuperAdmin) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Accès refusé', headerShown: true }} />
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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Chargement...', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00853F" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  if (!partner) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Partenaire introuvable', headerShown: true }} />
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Partenaire introuvable</Text>
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalClients = typeof stats?.total_clients === 'number' ? stats.total_clients : 0;
  const totalSales = typeof stats?.total_sales === 'number' ? stats.total_sales : 0;
  const totalCommission = typeof stats?.total_commission_earned === 'number' ? stats.total_commission_earned : 0;
  const totalPending = typeof stats?.total_pending === 'number' ? stats.total_pending : 0;
  const totalPaid = typeof stats?.total_paid === 'number' ? stats.total_paid : 0;

  const pendingCommissions = commissions.filter(c => c.status === 'pending');
  const paidCommissions = commissions.filter(c => c.status === 'paid');

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Profil Partenaire',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <ArrowLeft size={24} color="#000" />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <View style={styles.headerBanner}>
        <View style={styles.headerContent}>
          <Image source={{ uri: partner.avatar }} style={styles.partnerAvatar} />
          <View style={styles.headerText}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>{partner.name}</Text>
              <View style={styles.partnerBadge}>
                <Crown size={14} color="#FFD700" fill="#FFD700" />
                <Text style={styles.partnerBadgeText}>Partenaire</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>{partner.phone}</Text>
            {partner.partnerReferralCode && (
              <View style={styles.codeRow}>
                <Text style={styles.headerCode}>Code: {partner.partnerReferralCode}</Text>
                <TouchableOpacity
                  style={styles.editCodeButton}
                  onPress={handleEditCode}
                >
                  <Edit size={16} color="#00853F" />
                </TouchableOpacity>
              </View>
            )}
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
            <Text style={styles.statLabel}>Clients référés</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp size={24} color="#10B981" />
            <Text style={styles.statValue}>{totalSales}</Text>
            <Text style={styles.statLabel}>Produits référés</Text>
          </View>
          <View style={styles.statCard}>
            <DollarSign size={24} color="#FFD700" />
            <Text style={styles.statValuePrice}>{formatPrice(totalCommission)}</Text>
            <Text style={styles.statLabel}>Commission totale</Text>
          </View>
        </View>

        <View style={styles.statsCommissionContainer}>
          <View style={styles.commissionStatCard}>
            <Clock size={20} color="#F59E0B" />
            <Text style={styles.commissionStatValue}>{formatPrice(totalPending)}</Text>
            <Text style={styles.commissionStatLabel}>En attente</Text>
          </View>
          <View style={styles.commissionStatCard}>
            <CheckCircle size={20} color="#10B981" />
            <Text style={styles.commissionStatValue}>{formatPrice(totalPaid)}</Text>
            <Text style={styles.commissionStatLabel}>Payées</Text>
          </View>
        </View>

        {pendingCommissions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Clock size={20} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Commissions en attente ({pendingCommissions.length})</Text>
            </View>
            <View style={styles.commissionsGrid}>
              {pendingCommissions.map((commission) => (
                <View key={commission.id} style={styles.commissionCard}>
                  <View style={styles.commissionHeader}>
                    <View style={styles.commissionHeaderLeft}>
                      <Text style={styles.commissionTitle} numberOfLines={1}>
                        {commission.product_title}
                      </Text>
                      <Text style={styles.commissionSeller}>
                        Vendeur: {commission.seller_name}
                      </Text>
                    </View>
                    <View style={[styles.commissionStatusBadge, styles.commissionStatusPending]}>
                      <Clock size={12} color="#F59E0B" />
                      <Text style={[styles.commissionStatusText, { color: '#F59E0B' }]}>
                        En attente
                      </Text>
                    </View>
                  </View>
                  <View style={styles.commissionDetails}>
                    <View style={styles.commissionDetailRow}>
                      <Text style={styles.commissionDetailLabel}>Prix du produit</Text>
                      <Text style={styles.commissionDetailValue}>{formatPrice(commission.product_price)}</Text>
                    </View>
                    <View style={styles.commissionDetailRow}>
                      <Text style={styles.commissionDetailLabel}>Commission ({globalSettings?.partnerCommissionRate || 5}%)</Text>
                      <Text style={styles.commissionAmount}>{formatPrice(commission.commission_amount)}</Text>
                    </View>
                  </View>
                  <Text style={styles.commissionDate}>Créé le {formatDate(commission.created_at)}</Text>
                  <View style={styles.commissionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.payButton, styles.flexButton]}
                      onPress={() => handlePayCommission(commission)}
                      disabled={isPayingCommission === commission.id}
                    >
                      {isPayingCommission === commission.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <CheckCheck size={16} color="#fff" />
                          <Text style={styles.payButtonText}>Marquer comme payée</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteCommission(commission)}
                      disabled={isDeletingCommission === commission.id}
                    >
                      {isDeletingCommission === commission.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Trash2 size={20} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {paidCommissions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <CheckCircle size={20} color="#10B981" />
              <Text style={styles.sectionTitle}>Historique des commissions ({paidCommissions.length})</Text>
            </View>
            <View style={styles.commissionsGrid}>
              {paidCommissions.map((commission) => (
                <View key={commission.id} style={styles.commissionCard}>
                  <View style={styles.commissionHeader}>
                    <View style={styles.commissionHeaderLeft}>
                      <Text style={styles.commissionTitle} numberOfLines={1}>
                        {commission.product_title}
                      </Text>
                      <Text style={styles.commissionSeller}>
                        Vendeur: {commission.seller_name}
                      </Text>
                    </View>
                    <View style={[styles.commissionStatusBadge, styles.commissionStatusPaid]}>
                      <CheckCircle size={12} color="#10B981" />
                      <Text style={[styles.commissionStatusText, { color: '#10B981' }]}>
                        Payée
                      </Text>
                    </View>
                  </View>
                  <View style={styles.commissionDetails}>
                    <View style={styles.commissionDetailRow}>
                      <Text style={styles.commissionDetailLabel}>Prix du produit</Text>
                      <Text style={styles.commissionDetailValue}>{formatPrice(commission.product_price)}</Text>
                    </View>
                    <View style={styles.commissionDetailRow}>
                      <Text style={styles.commissionDetailLabel}>Commission ({globalSettings?.partnerCommissionRate || 5}%)</Text>
                      <Text style={styles.commissionAmount}>{formatPrice(commission.commission_amount)}</Text>
                    </View>
                  </View>
                  <Text style={styles.commissionDate}>
                    Payée le {commission.paid_at ? formatDate(commission.paid_at) : 'N/A'}
                  </Text>
                  <View style={styles.commissionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.unpayButton, styles.flexButton]}
                      onPress={() => handleUnpayCommission(commission)}
                      disabled={isUnpayingCommission === commission.id}
                    >
                      {isUnpayingCommission === commission.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <XCircle size={16} color="#fff" />
                          <Text style={styles.unpayButtonText}>Annuler la commission</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteCommission(commission)}
                      disabled={isDeletingCommission === commission.id}
                    >
                      {isDeletingCommission === commission.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Trash2 size={20} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {commissions.length === 0 && (
          <View style={styles.emptyState}>
            <DollarSign size={64} color="#ddd" />
            <Text style={styles.emptyStateText}>Aucune commission</Text>
            <Text style={styles.emptyStateSubtext}>
              Ce partenaire n&apos;a pas encore de commissions
            </Text>
          </View>
        )}

        <Modal
          visible={editCodeModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditCodeModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Modifier le code de parrainage</Text>
                <TouchableOpacity onPress={() => setEditCodeModalVisible(false)}>
                  <XCircle size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>
                Entrez le nouveau code de parrainage pour ce partenaire.
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Code (ex: PARTNER123)"
                value={newPartnerCode}
                onChangeText={(text) => setNewPartnerCode(text.toUpperCase())}
                autoCapitalize="characters"
                maxLength={20}
                editable={!isUpdatingCode}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setEditCodeModalVisible(false)}
                  disabled={isUpdatingCode}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleUpdateCode}
                  disabled={isUpdatingCode || !newPartnerCode.trim()}
                >
                  {isUpdatingCode ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Mettre à jour</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
  partnerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f5f5f5',
  },
  headerText: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
  },
  partnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  partnerBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFD700',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  headerCode: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#00853F',
    letterSpacing: 1,
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: getContainerPadding(),
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
  },
  accessDeniedText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#00853F',
    paddingVertical: isWeb ? 16 : 14,
    paddingHorizontal: isWeb ? 40 : 32,
    borderRadius: 12,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  commissionHeaderLeft: {
    flex: 1,
  },
  commissionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  commissionStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    marginBottom: 12,
  },
  commissionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flexButton: {
    flex: 1,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  payButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  unpayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  unpayButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  deleteButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 10,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editCodeButton: {
    padding: 4,
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
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    fontSize: isWeb ? 16 : 15,
    fontWeight: '600' as const,
    color: '#666',
  },
  confirmButton: {
    backgroundColor: '#00853F',
  },
  confirmButtonText: {
    fontSize: isWeb ? 16 : 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
