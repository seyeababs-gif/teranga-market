import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { 
  Copy,
  Users,
  DollarSign,
  ShoppingBag,
  Calendar,
  Phone,
  Mail,
  Tag,
  UserCheck,
  X,
  Plus,
  Power,
  Eye,
  Trash2,
  Edit3,
} from 'lucide-react-native';
import { usePartners } from '@/contexts/PartnersContext';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useToast } from '@/contexts/ToastContext';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';
import { isWeb, getContainerPadding } from '@/constants/responsive';
import { FALLBACK_AVATAR_SMALL, FALLBACK_AVATAR_MEDIUM, formatPrice } from '@/constants/appConfig';

interface ReferredUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatar: string | null;
  location: string;
  type: string;
  created_at: string;
}

interface PartnerStats {
  total_sales: number;
  total_commission: number;
  total_referrals: number;
  active_discount_codes: number;
}

export default function PartnerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { partners, getPartnerStats, getReferredUsers, getPartnerDiscountCodes, createPartnerCode, togglePartnerActive, getCodeUsages, deactivateDiscountCode, updatePartnerCode } = usePartners();
  const { currentUser } = useMarketplace();
  const { globalSettings } = useGlobalSettings();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [discountCodes, setDiscountCodes] = useState<any[]>([]);
  const [showCreateCodeModal, setShowCreateCodeModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newCodeDescription, setNewCodeDescription] = useState('');
  const [isCreatingCode, setIsCreatingCode] = useState(false);
  const [selectedCodeUsages, setSelectedCodeUsages] = useState<any[]>([]);
  const [showUsagesModal, setShowUsagesModal] = useState(false);
  const [isLoadingUsages, setIsLoadingUsages] = useState(false);
  const [showEditCodeModal, setShowEditCodeModal] = useState(false);
  const [editingCode, setEditingCode] = useState('');
  const [isUpdatingCode, setIsUpdatingCode] = useState(false);

  const partner = partners.find((p) => p.id === id);
  const isSuperAdmin = currentUser?.isSuperAdmin === true;

  useEffect(() => {
    if (partner) {
      loadPartnerData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner?.id]);

  const loadPartnerData = async () => {
    if (!partner) return;
    
    try {
      setIsLoading(true);
      const [statsData, usersData, codesData] = await Promise.all([
        getPartnerStats(partner.id),
        getReferredUsers(partner.id),
        getPartnerDiscountCodes(partner.id),
      ]);

      if (statsData) {
        setStats({
          total_sales: statsData[0]?.total_sales || 0,
          total_commission: parseFloat(statsData[0]?.total_commission || '0'),
          total_referrals: statsData[0]?.total_referrals || 0,
          active_discount_codes: statsData[0]?.active_discount_codes || 0,
        });
      }

      setReferredUsers(usersData);
      setDiscountCodes(codesData);
    } catch (error) {
      console.error('Error loading partner data:', error);
      toast.showError('Erreur lors du chargement des données');
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

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const copyToClipboard = async (text: string) => {
    await ExpoClipboard.setStringAsync(text);
    toast.showSuccess('Copié');
  };

  const commissionRate = globalSettings.partnerCommissionRate;

  const handleToggleActive = async () => {
    if (!partner) return;
    
    toast.showAlert(
      partner.isActive ? 'Désactiver le partenaire' : 'Activer le partenaire',
      partner.isActive 
        ? 'Êtes-vous sûr de vouloir désactiver ce partenaire ? Tous ses codes seront également désactivés.'
        : 'Êtes-vous sûr de vouloir activer ce partenaire ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            const newStatus = !partner.isActive;
            const result = await togglePartnerActive(partner.id, newStatus);
            if (result.success) {
              toast.showSuccess(newStatus ? 'Partenaire activé' : 'Partenaire désactivé');
              router.back();
            } else {
              toast.showError(result.error || 'Erreur');
            }
          },
        },
      ]
    );
  };

  const handleCreateCode = async () => {
    if (!newCode.trim()) {
      toast.showError('Veuillez entrer un code');
      return;
    }

    if (!partner) return;

    setIsCreatingCode(true);
    const result = await createPartnerCode(
      partner.id,
      newCode.trim(),
      newCodeDescription.trim() || undefined,
      currentUser?.id
    );

    setIsCreatingCode(false);

    if (result.success) {
      toast.showSuccess('Code créé avec succès');
      setShowCreateCodeModal(false);
      setNewCode('');
      setNewCodeDescription('');
      loadPartnerData();
    } else {
      toast.showError(result.error || 'Erreur lors de la création');
    }
  };

  const handleViewCodeUsages = async (code: any) => {
    setIsLoadingUsages(true);
    setShowUsagesModal(true);
    const usages = await getCodeUsages(code.code);
    setSelectedCodeUsages(usages);
    setIsLoadingUsages(false);
  };

  const handleDeactivateCode = async (codeId: string) => {
    toast.showAlert(
      'Désactiver le code',
      'Êtes-vous sûr de vouloir désactiver ce code de réduction ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            const result = await deactivateDiscountCode(codeId);
            if (result.success) {
              toast.showSuccess('Code désactivé');
              loadPartnerData();
            } else {
              toast.showError(result.error || 'Erreur');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Détails du partenaire',
          headerShown: true,
          headerStyle: {
            backgroundColor: '#fff',
          },
        }} 
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.headerCard}>
            <Image 
              source={{ uri: partner.avatar || FALLBACK_AVATAR_MEDIUM }} 
              style={styles.avatar} 
            />
            <Text style={styles.partnerName}>{partner.name}</Text>
            <View style={styles.contactRow}>
              <Phone size={16} color="#666" />
              <Text style={styles.contactText}>{partner.phone}</Text>
            </View>
            {partner.email && (
              <View style={styles.contactRow}>
                <Mail size={16} color="#666" />
                <Text style={styles.contactText}>{partner.email}</Text>
              </View>
            )}
            {partner.bio && (
              <Text style={styles.bio}>{partner.bio}</Text>
            )}
            {partner.partnerReferralCode && (
              <View style={styles.codeCard}>
                <Tag size={20} color="#007AFF" />
                <View style={styles.codeInfo}>
                  <Text style={styles.codeLabel}>Code de parrainage</Text>
                  <Text style={styles.codeText}>{partner.partnerReferralCode}</Text>
                </View>
                <View style={styles.codeActions}>
                  <TouchableOpacity 
                    onPress={() => copyToClipboard(partner.partnerReferralCode || '')}
                    style={styles.copyIconButton}
                  >
                    <Copy size={20} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setEditingCode(partner.partnerReferralCode || '');
                      setShowEditCodeModal(true);
                    }}
                    style={styles.editIconButton}
                  >
                    <Edit3 size={20} color="#10B981" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <ShoppingBag size={24} color="#00A651" />
              </View>
              <Text style={styles.statValue}>{stats?.total_sales || 0}</Text>
              <Text style={styles.statLabel}>Ventes générées</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <DollarSign size={24} color="#FFD700" />
              </View>
              <Text style={styles.statValue}>{formatPrice(stats?.total_commission || 0)}</Text>
              <Text style={styles.statLabel}>Commission gagnée</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Users size={24} color="#007AFF" />
              </View>
              <Text style={styles.statValue}>{stats?.total_referrals || 0}</Text>
              <Text style={styles.statLabel}>Vendeurs référés</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Tag size={24} color="#E31B23" />
              </View>
              <Text style={styles.statValue}>{discountCodes.length}</Text>
              <Text style={styles.statLabel}>Codes actifs</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Taux de commission</Text>
              <Text style={styles.infoValue}>{commissionRate}%</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date d&apos;inscription</Text>
              <Text style={styles.infoValue}>{formatDate(partner.createdAt)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Statut</Text>
              <View style={partner.isActive ? styles.statusBadge : styles.statusBadgeInactive}>
                <View style={partner.isActive ? styles.statusDot : styles.statusDotInactive} />
                <Text style={partner.isActive ? styles.statusText : styles.statusTextInactive}>
                  {partner.isActive ? 'Actif' : 'Inactif'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.toggleButton}
            onPress={handleToggleActive}
          >
            <Power size={20} color="#fff" />
            <Text style={styles.toggleButtonText}>
              {partner.isActive ? 'Désactiver le partenaire' : 'Activer le partenaire'}
            </Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>📋 Codes de réduction</Text>
              <TouchableOpacity
                style={styles.addCodeButton}
                onPress={() => setShowCreateCodeModal(true)}
              >
                <Plus size={16} color="#fff" />
                <Text style={styles.addCodeButtonText}>Créer un code</Text>
              </TouchableOpacity>
            </View>
            {discountCodes.length > 0 ? (
              <View style={styles.codesContainer}>
                {discountCodes.map((code) => (
                  <View key={code.id} style={styles.codeItem}>
                    <View style={styles.codeItemLeft}>
                      <Tag size={18} color="#007AFF" />
                      <View style={styles.codeItemInfo}>
                        <Text style={styles.codeItemCode}>{code.code}</Text>
                        {code.description && (
                          <Text style={styles.codeItemDesc}>{code.description}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.codeItemRight}>
                      <Text style={styles.codeItemDiscount}>-{code.discount_percent}%</Text>
                      <Text style={styles.codeItemUsage}>{code.times_used || 0} utilisations</Text>
                    </View>
                    <View style={styles.codeItemActions}>
                      <TouchableOpacity
                        style={styles.codeActionButton}
                        onPress={() => handleViewCodeUsages(code)}
                      >
                        <Eye size={16} color="#007AFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.codeActionButton}
                        onPress={() => handleDeactivateCode(code.id)}
                      >
                        <Trash2 size={16} color="#E31B23" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCodeState}>
                <Tag size={48} color="#ddd" />
                <Text style={styles.emptyCodeText}>Aucun code créé</Text>
              </View>
            )}
          </View>

          {referredUsers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>👥 Vendeurs référés ({referredUsers.length})</Text>
              <View style={styles.usersContainer}>
                {referredUsers.map((user) => (
                  <View key={user.id} style={styles.userItem}>
                    <Image 
                      source={{ uri: user.avatar || FALLBACK_AVATAR_SMALL }} 
                      style={styles.userAvatar} 
                    />
                    <View style={styles.userInfo}>
                      <View style={styles.userNameRow}>
                        <Text style={styles.userName}>{user.name}</Text>
                        {user.type === 'premium' && (
                          <View style={styles.premiumBadge}>
                            <Text style={styles.premiumText}>Premium</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.userPhone}>{user.phone}</Text>
                      <Text style={styles.userLocation}>{user.location}</Text>
                      <View style={styles.userDateRow}>
                        <Calendar size={12} color="#999" />
                        <Text style={styles.userDate}>Inscrit le {formatDate(user.created_at)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {referredUsers.length === 0 && (
            <View style={styles.emptyState}>
              <UserCheck size={64} color="#ddd" />
              <Text style={styles.emptyStateText}>Aucun vendeur référé</Text>
              <Text style={styles.emptyStateSubtext}>
                Les vendeurs utilisant le code de ce partenaire appara&icirc;tront ici
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={showCreateCodeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateCodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Créer un code promo</Text>
              <TouchableOpacity onPress={() => setShowCreateCodeModal(false)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Code (sera converti en majuscules)</Text>
              <TextInput
                style={styles.input}
                value={newCode}
                onChangeText={setNewCode}
                placeholder="Ex: PROMO20"
                autoCapitalize="characters"
                maxLength={20}
              />

              <Text style={styles.inputLabel}>Description (optionnel)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={newCodeDescription}
                onChangeText={setNewCodeDescription}
                placeholder="Description du code..."
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateCode}
                disabled={isCreatingCode}
              >
                {isCreatingCode ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Créer le code</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showUsagesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUsagesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Utilisations du code</Text>
              <TouchableOpacity onPress={() => setShowUsagesModal(false)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {isLoadingUsages ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                </View>
              ) : selectedCodeUsages.length > 0 ? (
                <View style={styles.usagesContainer}>
                  {selectedCodeUsages.map((usage) => (
                    <View key={usage.id} style={styles.usageItem}>
                      <Image
                        source={{ uri: usage.seller_avatar || FALLBACK_AVATAR_SMALL }}
                        style={styles.usageAvatar}
                      />
                      <View style={styles.usageInfo}>
                        <Text style={styles.usageName}>{usage.seller_name}</Text>
                        <Text style={styles.usagePhone}>{usage.seller_phone}</Text>
                        <Text style={styles.usageProduct} numberOfLines={1}>{usage.title}</Text>
                        <Text style={styles.usageDate}>{formatDate(usage.created_at)}</Text>
                      </View>
                      <Text style={styles.usagePrice}>{formatPrice(usage.price)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyUsages}>
                  <Text style={styles.emptyUsagesText}>Aucune utilisation</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditCodeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditCodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier le code partenaire</Text>
              <TouchableOpacity onPress={() => setShowEditCodeModal(false)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nouveau code (sera converti en majuscules)</Text>
              <TextInput
                style={styles.input}
                value={editingCode}
                onChangeText={setEditingCode}
                placeholder="Ex: PARTNER2024"
                autoCapitalize="characters"
                maxLength={50}
              />

              <Text style={styles.codeWarning}>
                ⚠️ Attention : Le changement du code affectera tous les futurs usages. L&apos;ancien code ne fonctionnera plus.
              </Text>

              <TouchableOpacity
                style={styles.createButton}
                onPress={async () => {
                  if (!editingCode.trim()) {
                    toast.showError('Veuillez entrer un code');
                    return;
                  }

                  setIsUpdatingCode(true);
                  const result = await updatePartnerCode(partner!.id, editingCode.trim());
                  setIsUpdatingCode(false);

                  if (result.success) {
                    toast.showSuccess('Code modifié avec succès');
                    setShowEditCodeModal(false);
                    setTimeout(() => {
                      router.replace('/admin/partners');
                    }, 500);
                  } else {
                    toast.showError(result.error || 'Erreur lors de la modification');
                  }
                }}
                disabled={isUpdatingCode}
              >
                {isUpdatingCode ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Modifier le code</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: getContainerPadding(),
    paddingBottom: 100,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f5f5f5',
    marginBottom: 16,
  },
  partnerName: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
  },
  bio: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 12,
    width: '100%',
  },
  codeInfo: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  codeText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#007AFF',
    letterSpacing: 1,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  copyIconButton: {
    padding: 8,
  },
  editIconButton: {
    padding: 8,
  },
  codeWarning: {
    fontSize: 13,
    color: '#F59E0B',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600' as const,
  },
  infoValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '700' as const,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00A651',
  },
  statusText: {
    fontSize: 12,
    color: '#00A651',
    fontWeight: '700' as const,
  },
  statusBadgeInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDotInactive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E31B23',
  },
  statusTextInactive: {
    fontSize: 12,
    color: '#E31B23',
    fontWeight: '700' as const,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E31B23',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addCodeButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  codesContainer: {
    gap: 12,
  },
  codeItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  codeItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  codeItemInfo: {
    flex: 1,
  },
  codeItemCode: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#007AFF',
    marginBottom: 2,
  },
  codeItemDesc: {
    fontSize: 12,
    color: '#666',
  },
  codeItemRight: {
    alignItems: 'flex-end',
  },
  codeItemDiscount: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#E31B23',
    marginBottom: 2,
  },
  codeItemUsage: {
    fontSize: 11,
    color: '#999',
  },
  codeItemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  codeActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  emptyCodeState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyCodeText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: getContainerPadding(),
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  usagesContainer: {
    gap: 12,
  },
  usageItem: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  usageAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ddd',
  },
  usageInfo: {
    flex: 1,
  },
  usageName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 2,
  },
  usagePhone: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  usageProduct: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  usageDate: {
    fontSize: 11,
    color: '#999',
  },
  usagePrice: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#00A651',
  },
  emptyUsages: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyUsagesText: {
    fontSize: 14,
    color: '#999',
  },
  usersContainer: {
    gap: 12,
  },
  userItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
  },
  premiumBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#000',
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userLocation: {
    fontSize: 13,
    color: '#999',
    marginBottom: 6,
  },
  userDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
