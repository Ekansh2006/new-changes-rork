import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import DateTimePicker, { DateTimePickerEvent, DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Camera, Check, X, User, CalendarDays, LogIn } from 'lucide-react-native';
import { router } from 'expo-router';
import { GoogleAuthProvider, User as FirebaseUser, getAdditionalUserInfo, signInWithCredential } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import Colors from '@/constants/colors';
import FormInput from '@/components/FormInput';
import SelfieCamera from '@/components/SelfieCamera';
import GenderSelectionModal from '@/components/GenderSelectionModal';
import { useUser } from '@/contexts/UserContext';
import { RegistrationData, GenderOption } from '@/types/profile';
import { auth, db } from '@/lib/firebase';
import { handleGoogleAuthResponse, GoogleAuthData } from '@/services/firebase';

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  password?: string;
  confirmPassword?: string;
  selfieUri?: string;
  dateOfBirth?: string;
  gender?: string;
}

const genderOptions: { label: string; value: GenderOption }[] = [
  { label: 'male', value: 'male' },
  { label: 'female', value: 'female' },
  { label: 'prefer not to say', value: 'other' },
];

const defaultDob = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 25);
  return date;
};

WebBrowser.maybeCompleteAuthSession();

export default function RegistrationScreen() {
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 60;
  const { register, isRegistering } = useUser();
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [formData, setFormData] = useState<RegistrationData>({
    name: '',
    email: '',
    phone: '',
    location: '',
    password: '',
    confirmPassword: '',
    selfieUri: '',
    dateOfBirth: '',
    gender: null,
  });
  const [selectedDob, setSelectedDob] = useState<Date | null>(null);
  const [isDobPickerVisible, setIsDobPickerVisible] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
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
      console.log('[register] Google auth response', googleResponse.type);
    }
  }, [googleResponse]);

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  type TextField = Exclude<keyof RegistrationData, 'gender'>;
  const handleInputChange = (field: TextField, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field in errors) {
      clearError(field as keyof FormErrors);
    }
  };

  const handleGenderSelect = (gender: GenderOption) => {
    setFormData(prev => ({ ...prev, gender }));
    clearError('gender');
  };

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'ios') {
      if (date) {
        setSelectedDob(date);
        handleInputChange('dateOfBirth', date.toISOString());
        clearError('dateOfBirth');
      }
      return;
    }
    setIsDobPickerVisible(false);
    if (date) {
      setSelectedDob(date);
      handleInputChange('dateOfBirth', date.toISOString());
      clearError('dateOfBirth');
    }
  };

  const openDatePicker = () => {
    const pickerDate = selectedDob ?? defaultDob();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerDate,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (_event, date) => {
          if (date) {
            setSelectedDob(date);
            handleInputChange('dateOfBirth', date.toISOString());
            clearError('dateOfBirth');
          }
        },
      });
      return;
    }
    setIsDobPickerVisible(true);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const phoneValue = (formData.phone ?? '').trim();

    if (!formData.name.trim()) {
      newErrors.name = 'name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'name must be at least 2 characters';
    } else if (formData.name.trim().length > 50) {
      newErrors.name = 'name must be less than 50 characters';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'email is required';
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'please enter a valid email address';
    }

    if (phoneValue && !/^[\+]?[1-9][\d]{0,15}$/.test(phoneValue.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.phone = 'please enter a valid phone number';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'location is required';
    } else if (formData.location.trim().length < 2) {
      newErrors.location = 'location must be at least 2 characters';
    } else if (formData.location.trim().length > 100) {
      newErrors.location = 'location must be less than 100 characters';
    }

    if (!formData.password) {
      newErrors.password = 'password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'password must be at least 8 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'passwords do not match';
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'date of birth is required';
    }

    if (!formData.gender) {
      newErrors.gender = 'gender selection is required';
    }

    if (!formData.selfieUri) {
      newErrors.selfieUri = 'verification selfie is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSelfieCapture = (selfie: { uri: string }) => {
    setFormData(prev => ({ ...prev, selfieUri: selfie.uri }));
    setShowCamera(false);
    clearError('selfieUri');
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
      console.error('[register] navigation after auth error', error);
      router.replace('/verification-pending');
    }
  };

  const handleGoogleSignUp = async () => {
    if (!googleClientId) {
      Alert.alert('Google Sign-Up Unavailable', 'Missing Google client configuration.');
      return;
    }

    if (!googleRequest) {
      Alert.alert('Google Sign-Up Unavailable', 'Google auth is initializing. Please try again.');
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
      const fallbackMessage = error instanceof Error ? error.message : 'Unable to sign up with Google right now. Please try again later.';
      Alert.alert('Google Sign-Up Failed', fallbackMessage);
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
      console.error('[register] google gender error', error);
      Alert.alert('Google Sign-Up', 'We could not finish setting up your account. Please try again.');
    } finally {
      setGoogleSaving(false);
      setGoogleUser(null);
      setGoogleProfile(null);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const user = await register(formData);
      console.log('[register] registration success, user:', user);
      setTimeout(() => {
        router.replace('/verification-pending');
      }, 120);
    } catch (error) {
      console.error('[register] Registration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account. Please try again.';
      Alert.alert('Registration Error', errorMessage);
    }
  };

  const handleCancel = () => {
    router.replace('/login');
  };

  const isFormValid = () => {
    const nameOk = formData.name.trim().length >= 2 && formData.name.trim().length <= 50;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
    const phoneValue = (formData.phone ?? '').trim();
    const phoneOk = !phoneValue || /^[\+]?[1-9][\d]{0,15}$/.test(phoneValue.replace(/[\s\-\(\)]/g, ''));
    const locationOk = formData.location.trim().length >= 2 && formData.location.trim().length <= 100;
    const passwordOk = formData.password.length >= 8 && formData.password === formData.confirmPassword;
    const selfieOk = !!formData.selfieUri;
    const dobOk = !!formData.dateOfBirth;
    const genderOk = !!formData.gender;
    return nameOk && emailOk && phoneOk && locationOk && passwordOk && selfieOk && dobOk && genderOk;
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

  if (showCamera) {
    return (
      <SelfieCamera
        onCapture={handleSelfieCapture}
        onCancel={() => setShowCamera(false)}
      />
    );
  }

  const formattedDob = selectedDob ? selectedDob.toLocaleDateString() : 'select your date of birth';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <BeerLogo />
            <Text style={styles.appTitle}>beer</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleCancel} style={styles.headerButton} testID="register-cancel">
              <X size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              testID="register-header-submit"
              style={[styles.headerButton, (!isFormValid() || isRegistering) && styles.headerButtonDisabled]}
              disabled={!isFormValid() || isRegistering}
            >
              <Check
                size={24}
                color={isFormValid() && !isRegistering ? Colors.light.text : Colors.light.tabIconDefault}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.titleSection}>
            <Text style={styles.title}>create account</Text>
            <Text style={styles.subtitle}>join the men-only beer community</Text>
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignUp}
            activeOpacity={0.85}
            disabled={isGoogleLoading || !googleRequest}
            testID="google-signup-button"
          >
            <View style={styles.googleButtonLeft}>
              <Image
                source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.png' }}
                style={styles.googleIcon}
                contentFit="contain"
              />
              <Text style={styles.googleButtonText}>sign up with google</Text>
            </View>
            {isGoogleLoading ? <ActivityIndicator color={Colors.light.text} /> : <LogIn size={18} color={Colors.light.text} />}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>verification selfie *</Text>
            <TouchableOpacity
              style={[styles.selfieContainer, errors.selfieUri && styles.selfieContainerError]}
              onPress={() => setShowCamera(true)}
              activeOpacity={0.7}
            >
              {formData.selfieUri ? (
                <Image source={{ uri: formData.selfieUri }} style={styles.selfiePreview} contentFit="cover" />
              ) : (
                <View style={styles.selfiePlaceholder}>
                  <User size={48} color={Colors.light.tabIconDefault} />
                  <Text style={styles.selfiePlaceholderText}>take verification selfie</Text>
                  <View style={styles.selfieInstructions}>
                    <Text style={styles.selfieInstructionText}>• clear face photo required</Text>
                    <Text style={styles.selfieInstructionText}>• for men-only verification</Text>
                    <Text style={styles.selfieInstructionText}>• camera only (no gallery)</Text>
                  </View>
                  <View style={styles.cameraIcon}>
                    <Camera size={20} color={Colors.light.tabIconDefault} />
                    <Text style={styles.cameraIconText}>camera</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
            {errors.selfieUri && <Text style={styles.errorText}>{errors.selfieUri}</Text>}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>gender *</Text>
            <View style={styles.genderOptions}>
              {genderOptions.map((option) => {
                const selected = formData.gender === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.genderOption, selected && styles.genderOptionSelected]}
                    onPress={() => handleGenderSelect(option.value)}
                    activeOpacity={0.85}
                    testID={`gender-radio-${option.value}`}
                  >
                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                      {selected && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.genderLabel}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
          </View>

          <View style={styles.section}>
            <FormInput
              label="name"
              value={formData.name}
              onChangeText={(value) => handleInputChange('name', value)}
              placeholder="enter your full name"
              error={errors.name}
              required
              maxLength={50}
              autoCapitalize="words"
              returnKeyType="next"
            />

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

            <FormInput
              label="location"
              value={formData.location}
              onChangeText={(value) => handleInputChange('location', value)}
              placeholder="enter your city/location"
              error={errors.location}
              required
              maxLength={100}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <FormInput
              label="password"
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              placeholder="create a password (min 8 characters)"
              error={errors.password}
              required
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <View style={styles.dobGroup}>
              <Text style={styles.sectionTitle}>date of birth *</Text>
              <TouchableOpacity
                style={[styles.dobInput, errors.dateOfBirth && styles.selfieContainerError]}
                onPress={openDatePicker}
                activeOpacity={0.85}
                testID="dob-picker"
              >
                <View style={styles.dobContent}>
                  <CalendarDays size={18} color={Colors.light.text} />
                  <Text style={styles.dobText}>{formattedDob}</Text>
                </View>
              </TouchableOpacity>
              {errors.dateOfBirth && <Text style={styles.errorText}>{errors.dateOfBirth}</Text>}
            </View>

            <FormInput
              label="phone (optional)"
              value={formData.phone ?? ''}
              onChangeText={(value) => handleInputChange('phone', value)}
              placeholder="enter your phone number"
              error={errors.phone}
              keyboardType="phone-pad"
              returnKeyType="next"
            />

            <FormInput
              label="confirm password"
              value={formData.confirmPassword}
              onChangeText={(value) => handleInputChange('confirmPassword', value)}
              placeholder="confirm your password"
              error={errors.confirmPassword}
              required
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
          </View>

          <View style={styles.disclaimerContainer}>
            <Text style={styles.disclaimerText}>
              your account will be reviewed by our team. username will be assigned after approval.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (!isFormValid() || isRegistering) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!isFormValid() || isRegistering}
            activeOpacity={0.85}
            testID="register-submit"
          >
            <Text style={[styles.submitButtonText, (!isFormValid() || isRegistering) && styles.submitButtonTextDisabled]}>
              {isRegistering ? 'creating account...' : 'create account'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {isDobPickerVisible && Platform.OS !== 'android' && (
        <Modal transparent animationType="fade">
          <View style={styles.dobModalOverlay}>
            <View style={styles.dobModalCard}>
              <DateTimePicker
                value={selectedDob ?? defaultDob()}
                mode="date"
                maximumDate={new Date()}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
              />
              <TouchableOpacity style={styles.dobModalDone} onPress={() => setIsDobPickerVisible(false)}>
                <Text style={styles.dobModalDoneText}>done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  logoImage: {
    width: 28,
    height: 28,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900' as const,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
    color: Colors.light.text,
    textTransform: 'lowercase' as const,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 24,
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
    marginBottom: 16,
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: Colors.light.text,
    marginBottom: 12,
    textTransform: 'lowercase' as const,
  },
  selfieContainer: {
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  selfieContainerError: {
    borderColor: '#000000',
  },
  selfiePreview: {
    width: '100%',
    height: '100%',
  },
  selfiePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    gap: 12,
  },
  selfiePlaceholderText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '900' as const,
    textTransform: 'lowercase' as const,
  },
  selfieInstructions: {
    alignItems: 'center',
    gap: 4,
  },
  selfieInstructionText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '900' as const,
  },
  cameraIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cameraIconText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '900' as const,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: '30%',
    gap: 10,
  },
  genderOptionSelected: {
    backgroundColor: '#f0ece4',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.light.text,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.light.text,
  },
  genderLabel: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: Colors.light.text,
    textTransform: 'lowercase' as const,
  },
  dobGroup: {
    marginBottom: 16,
  },
  dobInput: {
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.background,
  },
  dobContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dobText: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: Colors.light.text,
    textTransform: 'lowercase' as const,
  },
  disclaimerContainer: {
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  disclaimerText: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: Colors.light.text,
    textAlign: 'center',
    lineHeight: 20,
    textTransform: 'lowercase' as const,
  },
  submitButton: {
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: Colors.light.text,
    fontSize: 18,
    fontWeight: '900' as const,
    textTransform: 'lowercase' as const,
  },
  submitButtonTextDisabled: {
    color: Colors.light.text,
  },
  errorText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '900' as const,
    marginTop: 4,
    textTransform: 'lowercase' as const,
  },
  dobModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dobModalCard: {
    width: '100%',
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 16,
    gap: 12,
  },
  dobModalDone: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 8,
  },
  dobModalDoneText: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: Colors.light.text,
    textTransform: 'lowercase' as const,
  },
});
