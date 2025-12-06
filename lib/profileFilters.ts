import { collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const normalizeGender = (gender: string): string => gender.trim().toLowerCase();

export const getProfilesByGender = (userGender: string) => {
  if (!userGender) {
    throw new Error('Missing gender for profile filtering');
  }
  return query(collection(db, 'profiles'), where('creatorGender', '==', normalizeGender(userGender)));
};

export const getAllProfiles = () => {
  return query(collection(db, 'profiles'));
};

export const canUserSeeProfile = (userGender: string, profileCreatorGender: string) => {
  if (!userGender || !profileCreatorGender) {
    return false;
  }
  return normalizeGender(userGender) === normalizeGender(profileCreatorGender);
};
