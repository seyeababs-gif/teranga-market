import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,

  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { X, Camera, Image as ImageIcon, ArrowLeft, Calendar as CalendarIcon } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useToast } from '@/contexts/ToastContext';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { categories, getSubCategoriesForCategory } from '@/constants/categories';
import { Category, SubCategory, ListingType } from '@/types/marketplace';
import { formatPrice, eurToFcfa } from '@/constants/appConfig';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function EditProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getProduct, updateProduct, getMaxImages, currentUser } = useMarketplace();
  const toast = useToast();

  const product = getProduct(id || '');

  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [category, setCategory] = useState<Category>('vetements_homme');
  const [subCategory, setSubCategory] = useState<SubCategory | undefined>(undefined);
  const [condition, setCondition] = useState<'new' | 'used' | 'refurbished'>('used');
  const [images, setImages] = useState<string[]>([]);
  const [stockQuantity, setStockQuantity] = useState<string>('');
  const [manageStock, setManageStock] = useState<boolean>(false);
  const isPremium = currentUser?.type === 'premium';
  const [isOutOfStock, setIsOutOfStock] = useState<boolean>(false);
  const [hasDiscount, setHasDiscount] = useState<boolean>(false);
  const [discountPercent, setDiscountPercent] = useState<string>('');
  
  const [departureLocation, setDepartureLocation] = useState<string>('');
  const [arrivalLocation, setArrivalLocation] = useState<string>('');
  const [departureDate, setDepartureDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [pricePerKg, setPricePerKg] = useState<string>('');
  const [tripPrice, setTripPrice] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<string>('');
  const [availableSeats, setAvailableSeats] = useState<string>('');
  
  const listingType: ListingType = product?.listingType || 'product';

  useEffect(() => {
    if (product) {
      setTitle(product.title);
      setDescription(product.description);
      setPrice(product.price.toString());
      setCategory(product.category);
      setSubCategory(product.subCategory);
      setImages(product.images);
      
      if (product.listingType === 'product') {
        setLocation(product.location);
        setCondition(product.condition || 'used');
        setManageStock(product.stockQuantity !== undefined);
        setStockQuantity(product.stockQuantity ? product.stockQuantity.toString() : '');
        setIsOutOfStock(product.isOutOfStock || false);
        setHasDiscount(product.hasDiscount || false);
        setDiscountPercent(product.discountPercent ? product.discountPercent.toString() : '');
      } else if (product.listingType === 'service' && product.serviceDetails) {
        setDepartureLocation(product.serviceDetails.departureLocation || '');
        setArrivalLocation(product.serviceDetails.arrivalLocation || '');
        setDepartureDate(product.serviceDetails.departureDate ? new Date(product.serviceDetails.departureDate) : undefined);
        setPricePerKg(product.serviceDetails.pricePerKg ? product.serviceDetails.pricePerKg.toString() : '');
        setTripPrice(product.serviceDetails.tripPrice ? product.serviceDetails.tripPrice.toString() : '');
        setVehicleType(product.serviceDetails.vehicleType || '');
        setAvailableSeats(product.serviceDetails.availableSeats ? product.serviceDetails.availableSeats.toString() : '');
      }
    }
  }, [product]);

  if (!product) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.errorContainer, { paddingTop: insets.top + 60 }]}>
          <Text style={styles.errorText}>Produit introuvable</Text>
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

  const isAdmin = currentUser?.isAdmin === true;
  const isSuperAdmin = currentUser?.isSuperAdmin === true;
  const canEdit = product.sellerId === currentUser?.id || isAdmin || isSuperAdmin;

  if (!canEdit) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.errorContainer, { paddingTop: insets.top + 60 }]}>
          <Text style={styles.errorText}>Vous n&apos;êtes pas autorisé à modifier ce produit</Text>
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

  const pickImage = async () => {
    const maxImages = getMaxImages();
    if (images.length >= maxImages) {
      toast.showInfo('Limite de 10 photos atteinte.');
      return;
    }

    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.showWarning('Nous avons besoin de votre permission pour accéder à vos photos.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let imageUri = asset.uri;

      // Handle Web: Convert blob URL to base64
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
        // Native: use base64 if available
        const mimeType = asset.mimeType || 'image/jpeg';
        imageUri = `data:${mimeType};base64,${asset.base64}`;
      }

      setImages([...images, imageUri]);
    }
  };

  const takePhoto = async () => {
    const maxImages = getMaxImages();
    if (images.length >= maxImages) {
      toast.showInfo('Limite de 10 photos atteinte.');
      return;
    }

    if (Platform.OS === 'web') {
      toast.showInfo('La caméra n\'est pas disponible sur le web.');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      toast.showWarning('Nous avez besoin de votre permission pour accéder à la caméra.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let imageUri = asset.uri;

      if (asset.base64) {
        const mimeType = asset.mimeType || 'image/jpeg';
        imageUri = `data:${mimeType};base64,${asset.base64}`;
      }
      
      setImages([...images, imageUri]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.showError('Veuillez entrer un titre');
      return;
    }
    if (!description.trim()) {
      toast.showError('Veuillez entrer une description');
      return;
    }
    
    if (!category) {
      toast.showError('Veuillez sélectionner une catégorie');
      return;
    }
    
    const subCategoriesForCategory = getSubCategoriesForCategory(category);
    if (subCategoriesForCategory.length > 0 && !subCategory) {
      toast.showError('Veuillez sélectionner une sous-catégorie');
      return;
    }
    
    if (listingType === 'product') {
      if (!price.trim() || isNaN(Number(price))) {
        toast.showError('Veuillez entrer un prix valide');
        return;
      }
      if (!location.trim()) {
        toast.showError('Veuillez entrer une localisation');
        return;
      }
    } else if (listingType === 'service') {
      if (!departureLocation.trim()) {
        toast.showError('Veuillez entrer le lieu de départ');
        return;
      }
      if (!arrivalLocation.trim()) {
        toast.showError('Veuillez entrer le lieu d\'arrivée');
        return;
      }
      if (!departureDate) {
        toast.showError('Veuillez sélectionner la date de départ');
        return;
      }
    }
    
    if (images.length === 0) {
      toast.showError('Veuillez ajouter au moins une photo');
      return;
    }

    let servicePrice = 0;
    if (listingType === 'service') {
      if (pricePerKg) servicePrice = Number(pricePerKg);
      else if (tripPrice) servicePrice = Number(tripPrice);
    }
    
    const updates: any = {
      title: title.trim(),
      description: description.trim(),
      category,
      subCategory,
      images,
    };
    
    if (listingType === 'product') {
      updates.price = Number(price);
      updates.location = location.trim();
      updates.condition = condition;
      
      if (isPremium || product.stockQuantity !== undefined) {
        updates.stockQuantity = manageStock && stockQuantity ? Number(stockQuantity) : undefined;
        updates.isOutOfStock = isOutOfStock;
      }
      
      if (isPremium || product.hasDiscount) {
        updates.hasDiscount = hasDiscount;
        updates.discountPercent = hasDiscount && discountPercent ? Number(discountPercent) : undefined;
        updates.originalPrice = hasDiscount && discountPercent ? Number(price) : undefined;
      }
    } else if (listingType === 'service') {
      updates.price = servicePrice;
      updates.location = departureLocation.trim();
      updates.serviceDetails = {
        departureLocation: departureLocation.trim(),
        arrivalLocation: arrivalLocation.trim(),
        departureDate: departureDate ? departureDate.toISOString() : undefined,
        pricePerKg: pricePerKg ? Number(pricePerKg) : undefined,
        tripPrice: tripPrice ? Number(tripPrice) : undefined,
        vehicleType: vehicleType.trim() || undefined,
        availableSeats: availableSeats ? Number(availableSeats) : undefined,
      };
    }
    
    await updateProduct(product.id, updates);

    toast.showAlert('Succès', 'Votre annonce a été modifiée !', [
      {
        text: 'OK',
        onPress: () => {
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Modifier l&apos;annonce</Text>
          <Text style={styles.headerSubtitle}>
            {listingType === 'product' ? 'Produit' : 'Service'} - 10 photos max (gratuit)
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catégorie</Text>
          <View style={styles.categoriesGrid}>
            {categories.filter(c => c.id !== 'all').map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton,
                  category === cat.id && styles.categoryButtonSelected,
                ]}
                onPress={() => {
                  setCategory(cat.id);
                  setSubCategory(undefined);
                }}
              >
                <Text style={styles.categoryButtonIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryButtonText,
                    category === cat.id && styles.categoryButtonTextSelected,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {getSubCategoriesForCategory(category).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{listingType === 'service' ? 'Type de service' : 'Sous-catégorie'}</Text>
            <View style={styles.categoriesGrid}>
              {getSubCategoriesForCategory(category).map((subCat) => (
                <TouchableOpacity
                  key={subCat.id}
                  style={[
                    styles.categoryButton,
                    subCategory === subCat.id && styles.categoryButtonSelected,
                  ]}
                  onPress={() => setSubCategory(subCat.id)}
                >
                  <Text style={styles.categoryButtonIcon}>{subCat.icon}</Text>
                  <Text
                    style={[
                      styles.categoryButtonText,
                      subCategory === subCat.id && styles.categoryButtonTextSelected,
                    ]}
                  >
                    {subCat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <Text style={styles.photoCount}>
              {images.length}/10
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
              <ImageIcon size={24} color="#00A651" />
              <Text style={styles.addImageText}>Galerie</Text>
            </TouchableOpacity>
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.addImageButton} onPress={takePhoto}>
                <Camera size={24} color="#00A651" />
                <Text style={styles.addImageText}>Photo</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <TextInput
            style={styles.input}
            placeholder="Titre de l&apos;annonce"
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

          {listingType === 'product' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Prix (€)"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
              <TextInput
                style={styles.input}
                placeholder="Localisation (ex: Dakar, Plateau)"
                value={location}
                onChangeText={setLocation}
                placeholderTextColor="#999"
              />
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Lieu de départ (ex: Dakar)"
                value={departureLocation}
                onChangeText={setDepartureLocation}
                placeholderTextColor="#999"
              />
              <TextInput
                style={styles.input}
                placeholder="Lieu d'arrivée (ex: Saint-Louis)"
                value={arrivalLocation}
                onChangeText={setArrivalLocation}
                placeholderTextColor="#999"
              />
              <View style={styles.dateInputWrapper}>
                <TouchableOpacity 
                  style={styles.dateInputContainer}
                  onPress={() => {
                    setTempDate(departureDate || new Date());
                    setShowDatePicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <CalendarIcon size={22} color="#00A651" style={styles.calendarIcon} />
                  <View style={styles.dateDisplayContainer}>
                    {departureDate ? (
                      <>
                        <Text style={styles.dateDisplayText}>
                          {departureDate.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </Text>
                        <Text style={styles.timeDisplayText}>
                          {departureDate.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.dateInputPlaceholder}>Sélectionner la date et l&apos;heure</Text>
                    )}
                  </View>
                  <View style={styles.calendarButton}>
                    <CalendarIcon size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
                <Text style={styles.dateHint}>Appuyez pour sélectionner la date et l&apos;heure de départ</Text>
              </View>
              

            </>
          )}
        </View>

        {listingType === 'product' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>État</Text>
            <View style={styles.conditionRow}>
              {[
                { value: 'new' as const, label: 'Neuf' },
                { value: 'used' as const, label: 'Occasion' },
                { value: 'refurbished' as const, label: 'Reconditionné' },
              ].map((cond) => (
                <TouchableOpacity
                  key={cond.value}
                  style={[
                    styles.conditionButton,
                    condition === cond.value && styles.conditionButtonSelected,
                  ]}
                  onPress={() => setCondition(cond.value)}
                >
                  <Text
                    style={[
                      styles.conditionButtonText,
                      condition === cond.value && styles.conditionButtonTextSelected,
                    ]}
                  >
                    {cond.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {listingType === 'product' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Réduction / Promotion</Text>
            </View>
            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setHasDiscount(!hasDiscount)}
            >
              <View style={[styles.checkbox, hasDiscount && styles.checkboxChecked]}>
                {hasDiscount && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Ce produit est en promotion</Text>
            </TouchableOpacity>
            {hasDiscount && (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Pourcentage de réduction (ex: 20 pour 20%)"
                  value={discountPercent}
                  onChangeText={(text) => {
                    const num = Number(text);
                    if (text === '' || (!isNaN(num) && num > 0 && num <= 100)) {
                      setDiscountPercent(text);
                    }
                  }}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
                {discountPercent && price && (
                  <View style={styles.discountPreview}>
                    <Text style={styles.discountPreviewLabel}>Prix après réduction :</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.originalPrice}>{formatPrice(eurToFcfa(Number(price)))}</Text>
                      <Text style={styles.discountedPrice}>
                        {formatPrice(eurToFcfa(Math.round(Number(price) * (1 - Number(discountPercent) / 100))))}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {listingType === 'product' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Gestion du stock</Text>
            </View>
            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setManageStock(!manageStock)}
            >
              <View style={[styles.checkbox, manageStock && styles.checkboxChecked]}>
                {manageStock && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Gérer le stock de ce produit</Text>
            </TouchableOpacity>
            {manageStock && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Quantité disponible"
                  value={stockQuantity}
                  onChangeText={setStockQuantity}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
                <TouchableOpacity 
                  style={styles.checkboxRow}
                  onPress={() => setIsOutOfStock(!isOutOfStock)}
                >
                  <View style={[styles.checkbox, isOutOfStock && styles.checkboxChecked]}>
                    {isOutOfStock && <Text style={styles.checkboxCheck}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Produit en rupture de stock</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Enregistrer les modifications</Text>
        </TouchableOpacity>
      </ScrollView>

      {Platform.OS !== 'web' && showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.nativeDateModalContent}>
              <Text style={styles.modalTitle}>Sélectionner la date et l&apos;heure</Text>
              <View style={styles.nativePickerContainer}>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  textColor="#00A651"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setTempDate(selectedDate);
                    }
                  }}
                  style={styles.datePicker}
                />
                <DateTimePicker
                  value={tempDate}
                  mode="time"
                  display="spinner"
                  textColor="#00A651"
                  onChange={(event, selectedTime) => {
                    if (selectedTime) {
                      setTempDate(selectedTime);
                    }
                  }}
                  style={styles.timePicker}
                />
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setShowDatePicker(false);
                    setTempDate(departureDate || new Date());
                  }}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={() => {
                    setDepartureDate(tempDate);
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.modalConfirmText}>Valider</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'web' && showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Sélectionner la date et l&apos;heure</Text>
              <View style={styles.webDatePickerContainer}>
                <View style={styles.webDatePickerRow}>
                  <View style={styles.webDatePickerField}>
                    <Text style={styles.webDatePickerLabel}>Jour</Text>
                    <TextInput
                      style={styles.webDatePickerInput}
                      placeholder="JJ"
                      keyboardType="numeric"
                      maxLength={2}
                      value={tempDate ? tempDate.getDate().toString().padStart(2, '0') : ''}
                      onChangeText={(text) => {
                        const day = parseInt(text);
                        if (!isNaN(day) && day >= 1 && day <= 31) {
                          const newDate = new Date(tempDate || new Date());
                          newDate.setDate(day);
                          setTempDate(newDate);
                        }
                      }}
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={styles.webDatePickerField}>
                    <Text style={styles.webDatePickerLabel}>Mois</Text>
                    <TextInput
                      style={styles.webDatePickerInput}
                      placeholder="MM"
                      keyboardType="numeric"
                      maxLength={2}
                      value={tempDate ? (tempDate.getMonth() + 1).toString().padStart(2, '0') : ''}
                      onChangeText={(text) => {
                        const month = parseInt(text);
                        if (!isNaN(month) && month >= 1 && month <= 12) {
                          const newDate = new Date(tempDate || new Date());
                          newDate.setMonth(month - 1);
                          setTempDate(newDate);
                        }
                      }}
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={styles.webDatePickerField}>
                    <Text style={styles.webDatePickerLabel}>Année</Text>
                    <TextInput
                      style={styles.webDatePickerInput}
                      placeholder="AAAA"
                      keyboardType="numeric"
                      maxLength={4}
                      value={tempDate ? tempDate.getFullYear().toString() : ''}
                      onChangeText={(text) => {
                        const year = parseInt(text);
                        if (!isNaN(year) && year >= 2024) {
                          const newDate = new Date(tempDate || new Date());
                          newDate.setFullYear(year);
                          setTempDate(newDate);
                        }
                      }}
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>
                <View style={styles.webDatePickerRow}>
                  <View style={styles.webDatePickerField}>
                    <Text style={styles.webDatePickerLabel}>Heure</Text>
                    <TextInput
                      style={styles.webDatePickerInput}
                      placeholder="HH"
                      keyboardType="numeric"
                      maxLength={2}
                      value={tempDate ? tempDate.getHours().toString().padStart(2, '0') : ''}
                      onChangeText={(text) => {
                        const hour = parseInt(text);
                        if (!isNaN(hour) && hour >= 0 && hour <= 23) {
                          const newDate = new Date(tempDate || new Date());
                          newDate.setHours(hour);
                          setTempDate(newDate);
                        }
                      }}
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={styles.webDatePickerField}>
                    <Text style={styles.webDatePickerLabel}>Minutes</Text>
                    <TextInput
                      style={styles.webDatePickerInput}
                      placeholder="MM"
                      keyboardType="numeric"
                      maxLength={2}
                      value={tempDate ? tempDate.getMinutes().toString().padStart(2, '0') : ''}
                      onChangeText={(text) => {
                        const minute = parseInt(text);
                        if (!isNaN(minute) && minute >= 0 && minute <= 59) {
                          const newDate = new Date(tempDate || new Date());
                          newDate.setMinutes(minute);
                          setTempDate(newDate);
                        }
                      }}
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setShowDatePicker(false);
                    setTempDate(departureDate || new Date());
                  }}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={() => {
                    setDepartureDate(tempDate);
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.modalConfirmText}>Valider</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
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
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 12,
  },
  photoCount: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#00A651',
  },
  imagesScroll: {
    flexDirection: 'row',
  },
  imagePreview: {
    width: 120,
    height: 120,
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00A651',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addImageText: {
    fontSize: 12,
    color: '#00A651',
    marginTop: 4,
    fontWeight: '600' as const,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    gap: 8,
  },
  categoryButtonSelected: {
    backgroundColor: '#00A651',
  },
  categoryButtonIcon: {
    fontSize: 20,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  conditionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  conditionButtonSelected: {
    backgroundColor: '#00A651',
  },
  conditionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
  },
  conditionButtonTextSelected: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#00A651',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#00A651',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#00A651',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#00A651',
  },
  checkboxCheck: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700' as const,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  discountPreview: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#00A651',
  },
  discountPreviewLabel: {
    fontSize: 14,
    color: '#00A651',
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  originalPrice: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through' as const,
  },
  discountedPrice: {
    fontSize: 20,
    color: '#00A651',
    fontWeight: '700' as const,
  },
  premiumBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
  },
  checkboxDisabled: {
    opacity: 0.5,
    borderColor: '#999',
  },
  checkboxLabelDisabled: {
    opacity: 0.5,
    color: '#999',
  },
  dateInputWrapper: {
    marginBottom: 12,
  },
  dateInputContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#00A651',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendarIcon: {
    flexShrink: 0,
  },
  dateDisplayContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateDisplayText: {
    fontSize: 16,
    color: '#00A651',
    fontWeight: '700' as const,
  },
  timeDisplayText: {
    fontSize: 16,
    color: '#00A651',
    fontWeight: '700' as const,
  },
  dateInputPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  calendarButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#00A651',
  },
  dateHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#00A651',
    marginBottom: 16,
    textAlign: 'center',
  },
  webDatePickerContainer: {
    marginBottom: 16,
  },
  webDatePickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  webDatePickerField: {
    flex: 1,
  },
  webDatePickerLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#00A651',
    marginBottom: 6,
  },
  webDatePickerInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#ddd',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#64748B',
  },
  modalConfirmButton: {
    backgroundColor: '#00A651',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  nativeDateModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  nativePickerContainer: {
    marginBottom: 16,
  },
  datePicker: {
    height: 200,
    width: '100%',
  },
  timePicker: {
    height: 200,
    width: '100%',
    marginTop: 8,
  },
});
