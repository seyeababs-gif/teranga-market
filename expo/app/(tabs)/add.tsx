import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { X, Camera, Image as ImageIcon, Clock, Gift, Tag } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useToast } from '@/contexts/ToastContext';
import { categories, getSubCategoriesForCategory } from '@/constants/categories';
import { eurToFcfa, PRODUCT_EXPIRY_DAYS } from '@/constants/appConfig';
import { Category, SaleType } from '@/types/marketplace';

export default function AddProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { addProduct, currentUser, isAuthenticated } = useMarketplace();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [category, setCategory] = useState<Category | undefined>(undefined);
  const [subCategory, setSubCategory] = useState<string | undefined>(undefined);

  const [images, setImages] = useState<string[]>([]);

  const [saleType, setSaleType] = useState<SaleType>('sale');

  const pickImage = async () => {
    if (images.length >= 3) {
      toast.showAlert(
        'Limite atteinte',
        'Vous pouvez ajouter jusqu\'à 3 photos par produit.'
      );
      return;
    }

    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.showAlert('Permission requise', 'Nous avons besoin de votre permission pour accéder à vos photos.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let imageUri = asset.uri;

      if (Platform.OS === 'web') {
        try {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          imageUri = base64 as string;
        } catch (e) {
          console.error('Error converting blob to base64:', e);
          toast.showError('Erreur lors du traitement de l\'image');
          return;
        }
      } else if (asset.base64) {
        const mimeType = asset.mimeType || 'image/jpeg';
        imageUri = `data:${mimeType};base64,${asset.base64}`;
      }

      const compressedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      let finalImageUri = compressedImage.uri;
      if (Platform.OS === 'web') {
        const response = await fetch(compressedImage.uri);
        const blob = await response.blob();
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        finalImageUri = base64 as string;
      }

      setImages([...images, finalImageUri]);
    }
  };

  const takePhoto = async () => {
    if (images.length >= 3) {
      toast.showAlert(
        'Limite atteinte',
        'Vous pouvez ajouter jusqu\'à 3 photos par produit.'
      );
      return;
    }

    if (Platform.OS === 'web') {
      toast.showAlert('Non disponible', 'La caméra n&apos;est pas disponible sur le web.');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      toast.showAlert('Permission requise', 'Nous avez besoin de votre permission pour accéder à la caméra.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let imageUri = asset.uri;

      if (asset.base64) {
        const mimeType = asset.mimeType || 'image/jpeg';
        imageUri = `data:${mimeType};base64,${asset.base64}`;
      }

      const compressedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      let finalImageUri = compressedImage.uri;
      if (asset.base64) {
        const response = await fetch(compressedImage.uri);
        const blob = await response.blob();
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        finalImageUri = base64 as string;
      }

      setImages([...images, finalImageUri]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      toast.showAlert(
        'Connexion requise',
        'Vous devez être connecté pour ajouter un produit.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }

    if (!title.trim()) {
      toast.showAlert('Erreur', 'Veuillez entrer un titre');
      return;
    }
    if (!description.trim()) {
      toast.showAlert('Erreur', 'Veuillez entrer une description');
      return;
    }
    if (saleType === 'sale' && (!price.trim() || isNaN(Number(price)) || Number(price) <= 0)) {
      toast.showAlert('Erreur', 'Veuillez entrer un prix valide en €');
      return;
    }
    if (!location.trim()) {
      toast.showAlert('Erreur', 'Veuillez entrer une localisation');
      return;
    }
    if (!category) {
      toast.showAlert('Erreur', 'Veuillez sélectionner une catégorie');
      return;
    }
    if (category !== 'all' && getSubCategoriesForCategory(category).length > 0 && !subCategory) {
      toast.showAlert('Erreur', 'Veuillez sélectionner une sous-catégorie');
      return;
    }
    if (images.length === 0) {
      toast.showAlert('Erreur', 'Veuillez ajouter au moins une photo');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addProduct({
        title: title.trim(),
        description: description.trim(),
        price: saleType === 'donation' ? 0 : eurToFcfa(Number(price)),
        location: location.trim(),
        category: category!,
        subCategory: subCategory as any,
        images,
        sellerPhone: currentUser?.phone || '',
        isDonation: saleType === 'donation',
        saleType,
      });

      if (result && result.success) {
        setTitle('');
        setDescription('');
        setPrice('');
        setLocation('');
        setCategory(undefined);
        setSubCategory(undefined);
        setImages([]);
        setSaleType('sale');

        let message = `✅ Votre ${saleType === 'donation' ? 'don' : 'annonce'} a été publié${saleType === 'donation' ? '' : 'e'} avec succès !\n\nLe vendeur sera contacté via WhatsApp.`;
        
        toast.showAlert(
          'Succès',
          message,
          [
            {
              text: 'OK',
              onPress: () => {
                router.push('/(tabs)/profile' as any);
              },
            },
          ]
        );
      } else {
        toast.showAlert('Erreur', result?.error || 'Erreur lors de la soumission');
      }
    } catch (error: any) {
      const errorMsg = error?.message || JSON.stringify(error) || 'Une erreur inattendue est survenue';
      console.error('Error adding product:', errorMsg, error);
      toast.showError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={[styles.authRequired, { paddingTop: insets.top + 60 }]}>
          <Text style={styles.authTitle}>Connexion requise</Text>
          <Text style={styles.authSubtitle}>
            Vous devez être connecté pour ajouter un article
          </Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.authButtonText}>Se connecter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.authButtonSecondary}
            onPress={() => router.push('/auth/register')}
          >
            <Text style={styles.authButtonSecondaryText}>Créer un compte</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingBottom: 12 }]}>
        <Text style={styles.headerTitle}>Vendre un article</Text>
        <Text style={styles.headerSubtitle}>
          Annonces simples — jusqu'à 3 photos
        </Text>
        <View style={styles.durationBanner}>
          <Clock size={16} color="#00853F" />
          <Text style={styles.durationText}>
            Votre annonce reste visible {PRODUCT_EXPIRY_DAYS} jours. Vous pouvez la renouveler gratuitement à tout moment.
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <Text style={styles.photoCount}>
              {images.length}/3
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imagePreview}>
                <Image source={{ uri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
              <ImageIcon size={24} color="#00853F" />
              <Text style={styles.addImageText}>Galerie</Text>
            </TouchableOpacity>
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.addImageButton} onPress={takePhoto}>
                <Camera size={24} color="#00853F" />
                <Text style={styles.addImageText}>Photo</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Catégorie</Text>
            {category && (
              <TouchableOpacity onPress={() => {
                setCategory(undefined);
                setSubCategory(undefined);
              }}>
                <Text style={styles.changeButtonText}>Modifier</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {!category ? (
            <View style={styles.categoriesGrid}>
              {categories
                .filter(c => c.id !== 'all')
                .map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryButton}
                  onPress={() => {
                    setCategory(cat.id);
                    setSubCategory(undefined);
                  }}
                >
                  <Text style={styles.categoryButtonIcon}>{cat.icon}</Text>
                  <Text style={styles.categoryButtonText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.selectedItemCard}>
              <Text style={styles.selectedItemIcon}>
                {categories.find(c => c.id === category)?.icon}
              </Text>
              <Text style={styles.selectedItemText}>
                {categories.find(c => c.id === category)?.name}
              </Text>
            </View>
          )}
        </View>

        {category && getSubCategoriesForCategory(category).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sous-catégorie</Text>
              {subCategory && (
                <TouchableOpacity onPress={() => setSubCategory(undefined)}>
                  <Text style={styles.changeButtonText}>Modifier</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {!subCategory ? (
              <View style={styles.categoriesGrid}>
                {getSubCategoriesForCategory(category).map((subCat) => (
                  <TouchableOpacity
                    key={subCat.id}
                    style={styles.categoryButton}
                    onPress={() => setSubCategory(subCat.id)}
                  >
                    <Text style={styles.categoryButtonIcon}>{subCat.icon}</Text>
                    <Text style={styles.categoryButtonText}>{subCat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.selectedItemCard}>
                <Text style={styles.selectedItemIcon}>
                  {getSubCategoriesForCategory(category).find(s => s.id === subCategory)?.icon}
                </Text>
                <Text style={styles.selectedItemText}>
                  {getSubCategoriesForCategory(category).find(s => s.id === subCategory)?.name}
                </Text>
              </View>
            )}
          </View>
        )}

        {category && subCategory && (
          <View style={styles.stepContainer}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations</Text>
              <TextInput
                style={styles.input}
                placeholder="Titre de l'annonce"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor="#999"
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description détaillée"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#999"
              />
              <View style={styles.saleTypeContainer}>
                <TouchableOpacity
                  style={[styles.saleTypeButton, saleType === 'sale' && styles.saleTypeButtonSelected]}
                  onPress={() => setSaleType('sale')}
                >
                  <Tag size={18} color={saleType === 'sale' ? '#fff' : '#00853F'} />
                  <Text style={[styles.saleTypeButtonText, saleType === 'sale' && styles.saleTypeButtonTextSelected]}>À vendre</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saleTypeButton, saleType === 'donation' && styles.saleTypeButtonDonation]}
                  onPress={() => setSaleType('donation')}
                >
                  <Gift size={18} color={saleType === 'donation' ? '#fff' : '#E31B23'} />
                  <Text style={[styles.saleTypeButtonText, saleType === 'donation' && styles.saleTypeButtonTextSelected]}>Don gratuit</Text>
                </TouchableOpacity>
              </View>
              {saleType === 'sale' ? (
                <TextInput
                  style={styles.input}
                  placeholder="Prix (€)"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              ) : (
                <View style={styles.donationBanner}>
                  <Gift size={20} color="#E31B23" />
                  <Text style={styles.donationBannerText}>
                    Ce article sera affiché comme un don gratuit. Le prix sera de 0 €.
                  </Text>
                </View>
              )}
              <TextInput
                style={styles.input}
                placeholder="Localisation (ex: Paris, Marseille, Lyon...)"
                value={location}
                onChangeText={setLocation}
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Publication en cours...' : "Publier l'annonce"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    borderBottomColor: '#E8D5B7',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#00853F',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  durationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  durationText: {
    fontSize: 12,
    color: '#006B32',
    flex: 1,
    lineHeight: 17,
    fontWeight: '500' as const,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#1a1a1a',
  },
  photoCount: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#00853F',
  },
  changeButtonText: {
    fontSize: 14,
    color: '#00853F',
    fontWeight: '700' as const,
  },
  imagesScroll: {
    flexDirection: 'row',
  },
  imagePreview: {
    width: 120,
    height: 160,
    borderRadius: 12,
    marginRight: 12,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 120,
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00853F',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addImageText: {
    fontSize: 12,
    color: '#00853F',
    marginTop: 4,
    fontWeight: '600' as const,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E8D5B7',
  },
  categoryButtonIcon: {
    fontSize: 20,
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
  },
  selectedItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00853F',
    gap: 12,
  },
  selectedItemIcon: {
    fontSize: 24,
  },
  selectedItemText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#00853F',
  },
  stepContainer: {},
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#000',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8D5B7',
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  submitButton: {
    backgroundColor: '#00853F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#00853F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#fff',
  },
  submitButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#999',
  },
  authRequired: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#00853F',
    marginBottom: 12,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  authButton: {
    backgroundColor: '#00853F',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  authButtonSecondary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8D5B7',
  },
  authButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#00853F',
  },
  saleTypeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  saleTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E8D5B7',
  },
  saleTypeButtonSelected: {
    backgroundColor: '#00853F',
    borderColor: '#00853F',
  },
  saleTypeButtonDonation: {
    backgroundColor: '#E31B23',
    borderColor: '#E31B23',
  },
  saleTypeButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#00853F',
  },
  saleTypeButtonTextSelected: {
    color: '#fff',
  },
  donationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD0D0',
  },
  donationBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#E31B23',
    fontWeight: '600' as const,
    lineHeight: 18,
  },
});
