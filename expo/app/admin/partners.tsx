import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { formatPrice } from '@/constants/appConfig';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  UserPlus,
  Copy,
  TrendingUp,
  Users,
  DollarSign,
  ArrowRight,
} from 'lucide-react-native';
import { usePartners } from '@/contexts/PartnersContext';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useToast } from '@/contexts/ToastContext';
import { isWeb, getContainerPadding } from '@/constants/responsive';

export default function PartnersScreen() {
  const insets = useSafeAreaInsets();
  const { partners, isLoading } = usePartners();
  const { currentUser, togglePartnerStatus } = useMarketplace();
  const toast = useToast();

  const isSuperAdmin = currentUser?.isSuperAdmin === true;

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

  const copyToClipboard = async (text: string) => {
    await ExpoClipboard.setStringAsync(text);
    toast.showSuccess('Code copié');
  };

  const handleViewPartnerDetails = (partnerId: string) => {
    router.push(`/admin/partners/${partnerId}` as any);
  };

  const totalCommission = partners.reduce((acc, p) => acc + p.totalCommissionEarned, 0);
  const totalSales = partners.reduce((acc, p) => acc + p.totalSales, 0);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Partenaires', 
          headerShown: true,
          headerStyle: {
            backgroundColor: '#fff',
          },
        }} 
      />
      
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <UserPlus size={24} color="#007AFF" />
          <Text style={styles.statValue}>{partners.length}</Text>
          <Text style={styles.statLabel}>Partenaires</Text>
        </View>
        <View style={styles.statCard}>
          <TrendingUp size={24} color="#00A651" />
          <Text style={styles.statValue}>{totalSales}</Text>
          <Text style={styles.statLabel}>Ventes totales</Text>
        </View>
        <View style={styles.statCard}>
          <DollarSign size={24} color="#FFD700" />
          <Text style={styles.statValue}>{formatPrice(totalCommission)}</Text>
          <Text style={styles.statLabel}>Commission</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤝 Tous les partenaires</Text>
          <Text style={styles.sectionDescription}>
            Gérez vos partenaires et suivez leurs performances
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : partners.length > 0 ? (
            <View style={styles.partnersGrid}>
              {partners.map((partner) => (
                <View key={partner.id} style={styles.partnerCard}>
                  <Image source={{ uri: partner.avatar || '' }} style={styles.partnerAvatar} />
                  <View style={styles.partnerInfo}>
                    <Text style={styles.partnerName} numberOfLines={1}>
                      {partner.name}
                    </Text>
                    <Text style={styles.partnerPhone}>{partner.phone}</Text>
                    {partner.partnerReferralCode && (
                      <View style={styles.codeContainer}>
                        <Text style={styles.codeLabel}>Code:</Text>
                        <Text style={styles.codeText}>{partner.partnerReferralCode}</Text>
                        <TouchableOpacity 
                          onPress={() => copyToClipboard(partner.partnerReferralCode || '')}
                          style={styles.copyButton}
                        >
                          <Copy size={14} color="#007AFF" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <View style={styles.partnerStats}>
                    <View style={styles.statItem}>
                      <Users size={14} color="#666" />
                      <Text style={styles.statItemText}>{partner.totalReferrals || 0} référés</Text>
                    </View>
                    <View style={styles.statItem}>
                      <TrendingUp size={14} color="#666" />
                      <Text style={styles.statItemText}>{partner.totalSales} ventes</Text>
                    </View>
                    <View style={styles.statItem}>
                      <DollarSign size={14} color="#666" />
                      <Text style={styles.statItemText}>{formatPrice(partner.totalCommissionEarned)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => handleViewPartnerDetails(partner.id)}
                  >
                    <Text style={styles.viewButtonText}>Voir détails</Text>
                    <ArrowRight size={16} color="#007AFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <UserPlus size={64} color="#ddd" />
              <Text style={styles.emptyStateText}>Aucun partenaire</Text>
              <Text style={styles.emptyStateSubtext}>
                Les partenaires apparaîtront ici
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
    backgroundColor: '#f5f5f5',
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
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  partnersGrid: {
    gap: 16,
  },
  partnerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  partnerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
    marginBottom: 12,
  },
  partnerInfo: {
    marginBottom: 12,
  },
  partnerName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  partnerPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    padding: 8,
    borderRadius: 8,
  },
  codeLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600' as const,
  },
  codeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800' as const,
    color: '#007AFF',
    letterSpacing: 1,
  },
  copyButton: {
    padding: 4,
  },
  partnerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statItemText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600' as const,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E8F4FF',
    paddingVertical: 12,
    borderRadius: 10,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
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
