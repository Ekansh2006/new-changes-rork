import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';

import { auth, db } from '@/lib/firebase';
import { CLOUDINARY_CONFIG } from '@/lib/cloudinary';
import { GenderOption } from '@/types/profile';

type GoogleProfileData = {
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

export interface GoogleAuthData {
  profile?: GoogleProfileData;
}

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

export const updateUserGender = async (userId: string, gender: GenderOption) => {
  if (!userId) {
    throw new Error('Missing user identifier');
  }
  await setDoc(
    doc(db, 'users', userId),
    {
      gender,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const deleteUserAccountData = async (userId: string) => {
  if (!userId) {
    throw new Error('Missing user identifier');
  }
  const batch = writeBatch(db);
  const userRef = doc(db, 'users', userId);
  batch.delete(userRef);

  const profilesByUserId = await getDocs(query(collection(db, 'profiles'), where('userId', '==', userId)));
  profilesByUserId.forEach((profileDoc) => {
    batch.delete(profileDoc.ref);
  });

  const profilesByUploader = await getDocs(query(collection(db, 'profiles'), where('uploaderUserId', '==', userId)));
  profilesByUploader.forEach((profileDoc) => {
    if (!profilesByUserId.docs.find((docSnap) => docSnap.id === profileDoc.id)) {
      batch.delete(profileDoc.ref);
    }
  });

  await batch.commit();
};

export { auth };
