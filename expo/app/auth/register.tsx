import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ArrowRight, Eye, EyeOff, ArrowLeft, Phone, MapPin, User } from 'lucide-react-native';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useToast } from '@/contexts/ToastContext';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useMarketplace();
  const toast = useToast();

  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const validateWhatsAppPhone = (value: string): boolean => {
    const cleaned = value.replace(/[\s\-\.()]/g, '');
    return /^\+33\d{9}$/.test(cleaned);
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      toast.showError('Veuillez entrer votre nom');
      return;
    }

    if (!email.trim()) {
      toast.showError('Veuillez entrer votre adresse email');
      return;
    }

    if (!password.trim()) {
      toast.showError('Veuillez entrer un mot de passe');
      return;
    }

    if (password !== confirmPassword) {
      toast.showError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!phone.trim()) {
      toast.showError('Veuillez entrer votre numéro WhatsApp');
      return;
    }

    const cleanedPhone = phone.replace(/[\s\-\.()]/g, '');
    if (!validateWhatsAppPhone(cleanedPhone)) {
      toast.showError('Numéro WhatsApp invalide — format requis : +33 6 12 34 56 78');
      return;
    }

    if (!city.trim()) {
      toast.showError('Veuillez entrer votre ville');
      return;
    }

    setIsLoading(true);

    try {
      const result = await register({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: password,
        location: city.trim(),
        deliveryAddress: address.trim() || city.trim(),
        deliveryCity: city.trim(),
        phone: cleanedPhone,
      });

      if (result.success) {
        router.replace('/(tabs)');
      } else {
        toast.showError(result.error || 'Une erreur est survenue');
      }
    } catch (error) {
      console.error('Register error:', error);
      toast.showError('Une erreur est survenue lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  const isWebPlatform = Platform.OS === 'web';

  const content = (
    <ScrollView
      style={styles.scrollViewContainer}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={isWebPlatform}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={{ uri: 'https://r2-pub.rork.com/attachments/e8zeao0aaslczraw1jrp3.png' }}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Rejoignez Teranga Market</Text>
          <Text style={styles.subtitle}>
            Vendez, achetez et donnez dans la diaspora sénégalaise
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nom complet</Text>
            <View style={styles.inputWrapper}>
              <View style={styles.inputIcon}>
                <User size={20} color="#00853F" />
              </View>
              <TextInput
                style={[styles.input, styles.emailInput]}
                placeholder="Entrez votre nom"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Adresse email</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="vous@exemple.com"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Choisissez un mot de passe"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} color="#666" /> : <Eye size={20} color="#666" />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirmer le mot de passe</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Retapez votre mot de passe"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={20} color="#666" /> : <Eye size={20} color="#666" />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Téléphone WhatsApp *</Text>
            <View style={styles.inputWrapper}>
              <View style={styles.inputIcon}>
                <Phone size={20} color="#00853F" />
              </View>
              <TextInput
                style={[styles.input, styles.emailInput]}
                placeholder="Ex: +33 6 12 34 56 78"
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                editable={!isLoading}
              />
            </View>
            <Text style={styles.hint}>
              Format français obligatoire (ex: +33 6 12 34 56 78)
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Adresse</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.textAreaInput]}
                placeholder="Votre adresse"
                placeholderTextColor="#999"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={2}
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Ville (France) *</Text>
            <View style={styles.inputWrapper}>
              <View style={styles.inputIcon}>
                <MapPin size={20} color="#00853F" />
              </View>
              <TextInput
                style={[styles.input, styles.emailInput]}
                placeholder="Ex: Paris, Marseille, Lyon..."
                placeholderTextColor="#999"
                value={city}
                onChangeText={setCity}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Inscription...' : 'S\'inscrire'}
            </Text>
            <ArrowRight size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/auth/login')}
            disabled={isLoading}
          >
            <Text style={styles.linkText}>
              Vous avez déjà un compte ? <Text style={styles.linkTextBold}>Connectez-vous</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const headerOptions = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: '',
        headerTransparent: true,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            style={styles.backButton2}
          >
            <ArrowLeft size={24} color="#2C1810" />
          </TouchableOpacity>
        ),
      }}
    />
  );

  if (isWebPlatform) {
    return (
      <>
        {headerOptions}
        {content}
      </>
    );
  }

  return (
    <>
      {headerOptions}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {content}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  scrollViewContainer: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 450,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#2C1810',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: 18,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2C1810',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8D5B7',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#2C1810',
  },
  emailInput: {
    paddingLeft: 8,
  },
  passwordInput: {
    paddingRight: 48,
  },
  textAreaInput: {
    height: 72,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#00853F',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkText: {
    color: '#666',
    fontSize: 14,
  },
  linkTextBold: {
    color: '#00853F',
    fontWeight: '700' as const,
  },
  backButton2: {
    padding: 8,
    marginLeft: 8,
  },
});
