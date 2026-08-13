import React, { useState, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ArrowRight, Eye, EyeOff, ArrowLeft, Mail } from 'lucide-react-native';
import { useMarketplace } from '@/contexts/MarketplaceContext';
import { useToast } from '@/contexts/ToastContext';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useMarketplace();
  const toast = useToast();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    loadRedirectPath();
  }, []);

  const loadRedirectPath = async () => {
    try {
      if (Platform.OS === 'web') {
        const path = localStorage.getItem('redirectAfterLogin');
        if (path) setRedirectPath(path);
      } else {
        const path = await AsyncStorage.getItem('redirectAfterLogin');
        if (path) setRedirectPath(path);
      }
    } catch (error) {
      console.error('Error loading redirect path:', error);
    }
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      toast.showError('Veuillez entrer votre adresse email');
      return;
    }

    if (!password.trim()) {
      toast.showError('Veuillez entrer votre mot de passe');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        let finalRedirect = '/(tabs)';

        if (redirectPath) {
          finalRedirect = redirectPath;
          if (Platform.OS === 'web') {
            localStorage.removeItem('redirectAfterLogin');
          } else {
            await AsyncStorage.removeItem('redirectAfterLogin');
          }
        }

        router.replace(finalRedirect as any);
      } else {
        toast.showError(result.error || 'Une erreur est survenue');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.showError('Une erreur est survenue lors de la connexion');
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
          <Text style={styles.title}>Nanga def !</Text>
          <Text style={styles.subtitle}>
            La marketplace de la diaspora sénégalaise en France
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Adresse email</Text>
            <View style={styles.inputWrapper}>
              <View style={styles.inputIcon}>
                <Mail size={20} color="#999" />
              </View>
              <TextInput
                style={[styles.input, styles.emailInput]}
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
                placeholder="Entrez votre mot de passe"
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

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </Text>
            <ArrowRight size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/auth/register')}
            disabled={isLoading}
          >
            <Text style={styles.linkText}>
              Pas encore de compte ? <Text style={styles.linkTextBold}>Inscrivez-vous</Text>
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
            onPress={() => router.canGoBack() ? router.back() : router.push('/(tabs)')}
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
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
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
