import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, User as FirebaseUser, UserCredential } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { CLOUDINARY_CONFIG } from '@/lib/cloudinary';
import { GenderOption } from '@/types/profile';

WebBrowser.maybeCompleteAuthSession();

type GoogleProfileData = {
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

export interface GoogleAuthData {
  profile?: GoogleProfileData;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

const googleDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

type ExpoExtra = { googleClientId?: string };

const getGoogleClientId = (): string => {
  const extra = (Constants?.expoConfig?.extra as ExpoExtra | undefined) ?? (Constants?.manifest?.extra as ExpoExtra | undefined);
  return (
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
    process.env.GOOGLE_CLIENT_ID ??
    extra?.googleClientId ??
    ''
  );
};

const getAppScheme = (): string => {
  const configuredScheme = (Constants?.expoConfig?.scheme ?? Constants?.manifest?.scheme) as string | string[] | undefined;
  if (Array.isArray(configuredScheme)) {
    return configuredScheme[0] ?? 'myapp';
  }
  if (configuredScheme && typeof configuredScheme === 'string') {
    return configuredScheme;
  }
  return 'myapp';
};

const createRandomString = (length: number): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return result;
};

export const uploadImage = async (
  file: File | Blob,
  fileName: string,
  onProgress?: (progress: number) => void
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', 'beer-app/images');

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.secure_url) {
            resolve(response.secure_url);
          } else {
            reject(new Error('No secure URL returned from Cloudinary'));
          }
        } catch {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`);
    xhr.send(formData);
  });
};

export const signInWithGoogle = async (): Promise<UserCredential> => {
  if (Platform.OS === 'web') {
    return signInWithPopup(auth, googleProvider);
  }

  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Missing Google client configuration');
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: getAppScheme(),
  });

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.IdToken,
    extraParams: {
      prompt: 'select_account',
      nonce: createRandomString(16),
    },
  });

  await request.makeAuthUrlAsync(googleDiscovery);

  const result = await request.promptAsync(googleDiscovery);

  if (result.type !== 'success' || !result.params?.id_token) {
    throw new Error(result.type === 'dismiss' ? 'Google sign-in was dismissed' : 'Google sign-in failed');
  }

  const credential = GoogleAuthProvider.credential(result.params.id_token);
  return signInWithCredential(auth, credential);
};

export const handleGoogleAuthResponse = async (
  firebaseUser: FirebaseUser,
  googleData: GoogleAuthData | null,
  selectedGender: GenderOption,
) => {
  if (!firebaseUser?.uid) {
    throw new Error('Invalid Google user response');
  }

  const userRef = doc(db, 'users', firebaseUser.uid);
  const existingSnap = await getDoc(userRef);
  const existingData = existingSnap.exists() ? existingSnap.data() : null;

  const nameFromProfile =
    firebaseUser.displayName ??
    googleData?.profile?.name ??
    `${googleData?.profile?.given_name ?? ''} ${googleData?.profile?.family_name ?? ''}`.trim();

  const payload: Record<string, unknown> = {
    email: (firebaseUser.email ?? existingData?.email ?? '').toLowerCase(),
    name: nameFromProfile || existingData?.name || '',
    selfieUrl: firebaseUser.photoURL ?? existingData?.selfieUrl ?? '',
    gender: selectedGender,
    authMethod: 'google',
    googleAuthProvider: true,
    phone: existingData?.phone ?? '',
    location: existingData?.location ?? '',
    dateOfBirth: existingData?.dateOfBirth ?? null,
    status: existingData?.status ?? 'pending_verification',
  };

  if (!existingSnap.exists()) {
    payload.createdAt = serverTimestamp();
  }
  payload.updatedAt = serverTimestamp();

  await setDoc(userRef, payload, { merge: true });
};
