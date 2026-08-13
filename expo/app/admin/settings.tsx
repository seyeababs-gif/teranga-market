import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Settings, Save } from 'lucide-react-native';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useToast } from '@/contexts/ToastContext';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';
import { isWeb, getContainerPadding } from '@/constants/responsive';

export default function SettingsScreen() {
  const { currentUser } = useMarketplace();
  const toast = useToast();
  const { globalSettings, updateGlobalSettings, loadGlobalSettings } = useGlobalSettings();
  
  const [commissionRate, setCommissionRate] = useState<string>(String(globalSettings.commissionRate || 15));
  const [discountReduction, setDiscountReduction] = useState<string>(String(globalSettings.discountReduction || 5));
  const [partnerCommissionRate, setPartnerCommissionRate] = useState<string>(String(globalSettings.partnerCommissionRate || 5));
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSave = async () => {
    if (!currentUser) return;

    const commissionNum = parseFloat(commissionRate);
    const discountNum = parseFloat(discountReduction);
    const partnerCommissionNum = parseFloat(partnerCommissionRate);

    if (isNaN(commissionNum) || commissionNum < 0 || commissionNum > 100) {
      toast.showError('Taux de commission invalide (0-100%)');
      return;
    }

    if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
      toast.showError('Réduction invalide (0-100%)');
      return;
    }

    if (isNaN(partnerCommissionNum) || partnerCommissionNum < 0 || partnerCommissionNum > 100) {
      toast.showError('Commission partenaire invalide (0-100%)');
      return;
    }

    try {
      setIsLoading(true);
      const result = await updateGlobalSettings(
        commissionNum,
        discountNum,
        partnerCommissionNum,
        currentUser.id
      );

      if (result.success) {
        toast.showSuccess('Paramètres mis à jour');
        await loadGlobalSettings();
      } else {
        toast.showError(result.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.showError('Erreur lors de la mise à jour');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Paramètres Globaux', 
          headerShown: true,
          headerStyle: {
            backgroundColor: '#fff',
          },
        }} 
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.header}>
          <Settings size={32} color="#00853F" />
          <Text style={styles.headerTitle}>Paramètres de la plateforme</Text>
          <Text style={styles.headerSubtitle}>
            100% gratuit — 0% commission pour tous les utilisateurs
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Taux de Commission</Text>
          <Text style={styles.sectionDescription}>
            100% gratuit — 0% commission. Ce paramètre est conservé pour référence mais n'est pas appliqué.
          </Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Taux de commission plateforme</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={commissionRate}
                onChangeText={setCommissionRate}
                keyboardType="decimal-pad"
                placeholder="15"
                placeholderTextColor="#999"
                returnKeyType="done"
              />
              <Text style={styles.inputSuffix}>%</Text>
            </View>
            <Text style={styles.inputHint}>
              ⚠️ 100% gratuit — 0% commission appliquée à tous les vendeurs
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎟️ Réduction avec Code Promo</Text>
          <Text style={styles.sectionDescription}>
            Réduction accordée aux vendeurs qui utilisent un code partenaire (en %)
          </Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Taux de réduction</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={discountReduction}
                onChangeText={setDiscountReduction}
                keyboardType="decimal-pad"
                placeholder="5"
                placeholderTextColor="#999"
                returnKeyType="done"
              />
              <Text style={styles.inputSuffix}>%</Text>
            </View>
            <Text style={styles.inputHint}>
              Actuellement: {globalSettings.discountReduction}%
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤝 Commission Partenaire</Text>
          <Text style={styles.sectionDescription}>
            Commission versée aux partenaires quand leur code est utilisé (en %)
          </Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Taux de commission partenaire</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={partnerCommissionRate}
                onChangeText={setPartnerCommissionRate}
                keyboardType="decimal-pad"
                placeholder="5"
                placeholderTextColor="#999"
                returnKeyType="done"
              />
              <Text style={styles.inputSuffix}>%</Text>
            </View>
            <Text style={styles.inputHint}>
              Actuellement: {globalSettings.partnerCommissionRate}%
            </Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ Comment ça marche ?</Text>
          <Text style={styles.infoText}>
            • Commission plateforme: prélevée sur le prix du produit
          </Text>
          <Text style={styles.infoText}>
            • Réduction code promo: déduite de la commission plateforme
          </Text>
          <Text style={styles.infoText}>
            • Commission partenaire: versée au partenaire quand son code est utilisé
          </Text>
          <Text style={styles.infoExample}>
            Exemple: Produit à 152 € avec code partenaire
          </Text>
          <Text style={styles.infoExample}>
            - Commission normale: 23 € (15%)
          </Text>
          <Text style={styles.infoExample}>
            - Réduction vendeur: -8 € (5%)
          </Text>
          <Text style={styles.infoExample}>
            - Commission partenaire: 8 € (5%)
          </Text>
          <Text style={styles.infoExample}>
            - Total prélevé: 15 €
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Save size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
            </>
          )}
        </TouchableOpacity>


      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: getContainerPadding(),
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#000',
    fontWeight: '600' as const,
  },
  inputSuffix: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#666',
    marginLeft: 8,
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1E40AF',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
    marginBottom: 6,
    lineHeight: 18,
  },
  infoExample: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 4,
    marginLeft: 12,
  },
  saveButton: {
    backgroundColor: '#00853F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#00853F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
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
  bottomSpacing: {
    height: 20,
  },
});
