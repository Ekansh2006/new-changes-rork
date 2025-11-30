import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, User as FirebaseUser, getAdditionalUserInfo, signInWithCredential } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import Colors from '@/constants/colors';
import FormInput from '@/components/FormInput';
import GenderSelectionModal from '@/components/GenderSelectionModal';
import { useUser } from '@/contexts/UserContext';
import { LoginData, GenderOption } from '@/types/profile';
import { auth, db } from '@/lib/firebase';
import { handleGoogleAuthResponse, GoogleAuthData } from '@/services/firebase';

interface FormErrors {
  email?: string;
  password?: string;
}

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { login, isLoading } = useUser();
  const [formData, setFormData] = useState<LoginData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [googleModalVisible, setGoogleModalVisible] = useState<boolean>(false);
  const [googleSaving, setGoogleSaving] = useState<boolean>(false);
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleProfile, setGoogleProfile] = useState<GoogleAuthData | null>(null);
  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? '';
  const [googleRequest, googleResponse, promptGoogleAuth] = Google.useAuthRequest({
    webClientId: googleClientId,
  });

  useEffect(() => {
    if (googleResponse?.type) {
      console.log('[login] Google auth response', googleResponse.type);
    }
  }, [googleResponse]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'email is required';
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof LoginData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    const emailLc = formData.email.trim().toLowerCase();
    const pass = formData.password;

    // Check for admin credentials and authenticate through Firebase
    if (emailLc === 'admin@gmail.com' && pass === 'ekansh68') {
      try {
        // Authenticate admin through Firebase first
        await login(formData);
        router.replace('/admin-dashboard');
        return;
      } catch (e) {
        console.error('Admin authentication error:', e);
        Alert.alert('Admin Login Failed', 'Invalid admin credentials or admin account not set up properly.');
        return;
      }
    }

    try {
      const user = await login(formData);

      if (user.status === 'pending_verification') {
        router.replace('/verification-pending');
      } else if (user.status === 'approved_username_assigned') {
        router.replace('/(tabs)');
      } else if (user.status === 'rejected') {
        router.replace('/account-rejected');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('login failed', 'invalid email or password. please try again.');
    }
  };

  const handleRegister = () => {
    router.push('/register');
  };

  const navigateAfterAuth = async (userId: string) => {
    try {
      const snapshot = await getDoc(doc(db, 'users', userId));
      const status = snapshot.exists() ? snapshot.data()?.status : 'pending_verification';
      if (status === 'approved_username_assigned') {
        router.replace('/(tabs)');
        return;
      }
      if (status === 'rejected') {
        router.replace('/account-rejected');
        return;
      }
      router.replace('/verification-pending');
    } catch (error) {
      console.error('[login] navigation after auth error', error);
      router.replace('/verification-pending');
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleClientId) {
      Alert.alert('Google Sign-In Unavailable', 'Missing Google client configuration.');
      return;
    }

    if (!googleRequest) {
      Alert.alert('Google Sign-In Unavailable', 'Google auth is initializing. Please try again.');
      return;
    }

    try {
      setIsGoogleLoading(true);
      const result = await promptGoogleAuth();

      if (!result) {
        throw new Error('Google sign-in failed');
      }

      if (result.type !== 'success' || !result.params?.id_token) {
        if (result.type === 'dismiss' || result.type === 'cancel') {
          return;
        }
        throw new Error('Google sign-in failed');
      }

      const credential = GoogleAuthProvider.credential(result.params.id_token);
      const userCredential = await signInWithCredential(auth, credential);
      setGoogleUser(userCredential.user);
      const additionalInfo = getAdditionalUserInfo(userCredential);
      setGoogleProfile(additionalInfo?.profile ? { profile: additionalInfo.profile as GoogleAuthData['profile'] } : null);
      setGoogleModalVisible(true);
    } catch (error: any) {
      const fallbackMessage = error instanceof Error ? error.message : 'Unable to sign in with Google right now. Please try again later.';
      Alert.alert('Google Sign-In Failed', fallbackMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleGender = async (gender: GenderOption) => {
    if (!googleUser) {
      setGoogleModalVisible(false);
      return;
    }

    try {
      setGoogleSaving(true);
      await handleGoogleAuthResponse(googleUser, googleProfile, gender);
      setGoogleModalVisible(false);
      await navigateAfterAuth(googleUser.uid);
    } catch (error) {
      console.error('[login] google gender error', error);
      Alert.alert('Google Sign-In', 'We could not finish setting up your account. Please try again.');
    } finally {
      setGoogleSaving(false);
      setGoogleUser(null);
      setGoogleProfile(null);
    }
  };

  const isFormValid = () => {
    return (
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()) &&
      formData.password.length > 0 &&
      Object.keys(errors).length === 0
    );
  };

  const BeerLogo = () => (
    <View style={styles.logoContainer}>
      <Image 
        source={{ uri: 'https://r2-pub.rork.com/attachments/bcjlgxvpsdw5ajmunl9az' }}
        style={styles.logoImage}
        contentFit="contain"
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <BeerLogo />
            <Text style={styles.appTitle}>beer</Text>
          </View>
        </View>
        
        <View style={styles.content}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>welcome back</Text>
            <Text style={styles.subtitle}>
              sign in to your account
            </Text>
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            activeOpacity={0.85}
            disabled={isGoogleLoading || !googleRequest}
            testID="google-login-button"
          >
            <View style={styles.googleButtonLeft}>
              <Image
                source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.png' }}
                style={styles.googleIcon}
                contentFit="contain"
              />
              <Text style={styles.googleButtonText}>sign in with google</Text>
            </View>
            {isGoogleLoading ? (
              <ActivityIndicator color={Colors.light.text} />
            ) : (
              <LogIn size={18} color={Colors.light.text} />
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form Fields */}
          <View style={styles.section}>
            <FormInput
              label="email"
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              placeholder="enter your email address"
              error={errors.email}
              required
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <View style={styles.passwordContainer}>
              <FormInput
                label="password"
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
                placeholder="enter your password"
                error={errors.password}
                required
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                {showPassword ? (
                  <EyeOff size={20} color={Colors.light.text} />
                ) : (
                  <Eye size={20} color={Colors.light.text} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              (!isFormValid() || isLoading) && styles.loginButtonDisabled
            ]}
            onPress={handleLogin}
            disabled={!isFormValid() || isLoading}
            activeOpacity={0.8}
          >
            <LogIn size={20} color={isFormValid() && !isLoading ? Colors.light.text : Colors.light.tabIconDefault} />
            <Text style={[
              styles.loginButtonText,
              (!isFormValid() || isLoading) && styles.loginButtonTextDisabled
            ]}>
              {isLoading ? 'signing in...' : 'sign in'}
            </Text>
          </TouchableOpacity>

          {/* Register Link */}
          <View style={styles.registerSection}>
            <Text style={styles.registerText}>don&apos;t have an account?</Text>
            <TouchableOpacity
              style={styles.registerButton}
              onPress={handleRegister}
              activeOpacity={0.8}
            >
              <UserPlus size={16} color={Colors.light.text} />
              <Text style={styles.registerButtonText}>create account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      <GenderSelectionModal
        isVisible={googleModalVisible}
        onGenderSelected={handleGoogleGender}
        isLoading={googleSaving}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '900' as const,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
    color: Colors.light.text,
    textTransform: 'lowercase' as const,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '900' as const,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '900' as const,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
    color: Colors.light.text,
    textAlign: 'center',
  },
  googleButton: {
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  googleButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: Colors.light.text,
    textTransform: 'lowercase' as const,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#000000',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: Colors.light.text,
    textTransform: 'uppercase' as const,
  },
  section: {
    marginBottom: 32,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 44,
    padding: 8,
    zIndex: 1,
  },
  loginButton: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
    minHeight: 52,
  },
  loginButtonDisabled: {
    backgroundColor: Colors.light.background,
    opacity: 0.5,
  },
  loginButtonText: {
    color: Colors.light.text,
    fontSize: 18,
    fontWeight: '900' as const,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
  },
  loginButtonTextDisabled: {
    color: Colors.light.text,
  },
  registerSection: {
    alignItems: 'center',
    gap: 16,
  },
  registerText: {
    fontSize: 16,
    fontWeight: '900' as const,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
    color: Colors.light.text,
  },
  registerButton: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  registerButtonText: {
    color: Colors.light.text,
    fontSize: 16,
    fontWeight: '900' as const,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
  },
});