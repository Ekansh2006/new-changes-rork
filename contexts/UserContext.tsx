import { useState, useCallback, useEffect, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { User as AppUser, RegistrationData, LoginData, UserStatus, GenderOption, AuthMethod } from '@/types/profile';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';

import { updateUserGender } from '@/services/firebase';

export const [UserProvider, useUser] = createContextHook(() => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [userGender, setUserGenderState] = useState<GenderOption | undefined>(undefined);
  const [userPhone, setUserPhoneState] = useState<string | undefined>(undefined);
  const [userDateOfBirth, setUserDateOfBirthState] = useState<Date | undefined>(undefined);
  const [userAuthMethod, setUserAuthMethodState] = useState<AuthMethod | undefined>(undefined);

  // Initialize user context with Firebase auth state listener
  useEffect(() => {
    let userDocUnsub: (() => void) | null = null;
    
    const authUnsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        // Clean up previous user document listener
        if (userDocUnsub) {
          userDocUnsub();
          userDocUnsub = null;
        }
        
        if (!fbUser) {
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        // Set up real-time listener for user document changes
        const userRef = doc(db, 'users', fbUser.uid);
        userDocUnsub = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Record<string, any>;
            const dob = data.dateOfBirth?.toDate ? data.dateOfBirth.toDate() : undefined;
            const appUser: AppUser = {
              id: fbUser.uid,
              name: data.name ?? fbUser.displayName ?? '',
              email: fbUser.email ?? data.email ?? '',
              phone: data.phone ?? undefined,
              location: data.location ?? '',
              selfieUrl: data.selfieUrl ?? '',
              status: (data.status ?? 'pending_verification') as UserStatus,
              username: data.username,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
              approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : undefined,
              gender: data.gender as GenderOption | undefined,
              dateOfBirth: dob,
              authMethod: data.authMethod as AuthMethod | undefined,
              googleAuthProvider: data.googleAuthProvider ?? false,
            };
            setUser(appUser);
            setUserGenderState(appUser.gender);
            setUserPhoneState(appUser.phone);
            setUserDateOfBirthState(appUser.dateOfBirth);
            setUserAuthMethodState(appUser.authMethod);
          } else {
            const fallbackUser: AppUser = {
              id: fbUser.uid,
              name: fbUser.displayName ?? '',
              email: fbUser.email ?? '',
              phone: undefined,
              location: '',
              selfieUrl: '',
              status: 'pending_verification',
              createdAt: new Date(),
              gender: undefined,
              dateOfBirth: undefined,
              authMethod: undefined,
              googleAuthProvider: false,
            };
            setUser(fallbackUser);
            setUserGenderState(undefined);
            setUserPhoneState(undefined);
            setUserDateOfBirthState(undefined);
            setUserAuthMethodState(undefined);
          }
          setIsLoading(false);
        }, (error) => {
          console.error('[auth] User document listener error:', error);
          setIsLoading(false);
        });
      } catch (e) {
        console.log('[auth] onAuthStateChanged error', e);
        setIsLoading(false);
      }
    });
    
    return () => {
      authUnsub();
      if (userDocUnsub) {
        userDocUnsub();
      }
    };
  }, []);



  const register = useCallback(async (registrationData: RegistrationData): Promise<AppUser> => {
    setIsRegistering(true);
    try {
      console.log('[auth] register start');
      const cred = await createUserWithEmailAndPassword(auth, registrationData.email, registrationData.password);
      const fbUser = cred.user;
      if (registrationData.name) {
        try { await updateProfile(fbUser, { displayName: registrationData.name }); } catch {}
      }
      if (!registrationData.gender) {
        throw new Error('Gender selection is required');
      }
      const sanitizedPhone = registrationData.phone?.replace(/[\s\-\(\)]/g, '') ?? '';
      const dobDate = new Date(registrationData.dateOfBirth);
      const userRef = doc(db, 'users', fbUser.uid);
      const userDoc = {
        email: registrationData.email,
        name: registrationData.name,
        phone: sanitizedPhone,
        location: registrationData.location,
        selfieUrl: '',
        status: 'pending_verification',
        createdAt: serverTimestamp(),
        gender: registrationData.gender,
        dateOfBirth: Timestamp.fromDate(dobDate),
        authMethod: 'email_password' as AuthMethod,
        googleAuthProvider: false,
      };
      await setDoc(userRef, userDoc, { merge: true });
      const appUser: AppUser = {
        id: fbUser.uid,
        name: registrationData.name,
        email: registrationData.email,
        phone: sanitizedPhone || undefined,
        location: registrationData.location,
        selfieUrl: '',
        status: 'pending_verification',
        createdAt: new Date(),
        gender: registrationData.gender,
        dateOfBirth: dobDate,
        authMethod: 'email_password',
        googleAuthProvider: false,
      };
      setUser(appUser);
      setUserGenderState(registrationData.gender);
      setUserPhoneState(sanitizedPhone || undefined);
      setUserDateOfBirthState(dobDate);
      setUserAuthMethodState('email_password');
      return appUser;
    } catch (error: any) {
      console.error('[auth] Registration error:', error);
      let message = 'Failed to create account. Please try again.';
      const code: string | undefined = error?.code;
      if (code === 'auth/email-already-in-use') message = 'Email already in use';
      if (code === 'auth/weak-password') message = 'Password is too weak';
      throw new Error(message);
    } finally {
      setIsRegistering(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setUser(null);
      setUserGenderState(undefined);
      setUserPhoneState(undefined);
      setUserDateOfBirthState(undefined);
      setUserAuthMethodState(undefined);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, []);

  const login = useCallback(async (loginData: LoginData): Promise<AppUser> => {
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, loginData.email, loginData.password);
      const fbUser = cred.user as FirebaseUser;
      const snap = await getDoc(doc(db, 'users', fbUser.uid));
      const data = snap.exists() ? (snap.data() as Record<string, any>) : {};
      const dob = data.dateOfBirth?.toDate ? data.dateOfBirth.toDate() : undefined;
      const phone = data.phone ?? undefined;
      const appUser: AppUser = {
        id: fbUser.uid,
        name: data.name ?? fbUser.displayName ?? '',
        email: fbUser.email ?? loginData.email,
        phone,
        location: data.location ?? '',
        selfieUrl: data.selfieUrl ?? '',
        status: (data.status ?? 'pending_verification') as UserStatus,
        username: data.username,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : undefined,
        gender: data.gender as GenderOption | undefined,
        dateOfBirth: dob,
        authMethod: data.authMethod as AuthMethod | undefined,
        googleAuthProvider: data.googleAuthProvider ?? false,
      };
      setUser(appUser);
      setUserGenderState(appUser.gender);
      setUserPhoneState(appUser.phone);
      setUserDateOfBirthState(appUser.dateOfBirth);
      setUserAuthMethodState(appUser.authMethod);
      return appUser;
    } catch (error: any) {
      console.error('[auth] Login error:', error);
      let message = 'Login failed. Please try again.';
      if (error?.code === 'auth/invalid-credential') message = 'Invalid email or password';
      if (error?.code === 'auth/user-not-found') message = 'No account found with this email';
      if (error?.code === 'auth/wrong-password') message = 'Incorrect password';
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);



  const updateUserStatus = useCallback(async (status: UserStatus, username?: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.id), {
        status: status,
        ...(username ? { username } : {}),
      }, { merge: true });
      setUser(prev => prev ? { ...prev, status, username: username ?? prev.username } : null);
    } catch (error) {
      console.error('[user] Error updating user status:', error);
    }
  }, [user]);

  const setUserGender = useCallback(async (nextGender: GenderOption) => {
    if (!user?.id) return;
    try {
      await updateUserGender(user.id, nextGender);
      setUser(prev => prev ? { ...prev, gender: nextGender } : prev);
      setUserGenderState(nextGender);
    } catch (error) {
      console.error('[user] Error updating gender:', error);
      throw error;
    }
  }, [user]);

  const setUserPhone = useCallback(async (nextPhone?: string) => {
    if (!user) return;
    try {
      const sanitized = nextPhone?.replace(/[\s\-\(\)]/g, '') ?? '';
      await setDoc(doc(db, 'users', user.id), { phone: sanitized }, { merge: true });
      setUser(prev => prev ? { ...prev, phone: sanitized || undefined } : prev);
      setUserPhoneState(sanitized || undefined);
    } catch (error) {
      console.error('[user] Error updating phone:', error);
    }
  }, [user]);

  const setUserDateOfBirth = useCallback(async (nextDob: Date) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.id), { dateOfBirth: Timestamp.fromDate(nextDob) }, { merge: true });
      setUser(prev => prev ? { ...prev, dateOfBirth: nextDob } : prev);
      setUserDateOfBirthState(nextDob);
    } catch (error) {
      console.error('[user] Error updating date of birth:', error);
    }
  }, [user]);

  const setUserAuthMethod = useCallback(async (nextMethod: AuthMethod) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.id), { authMethod: nextMethod }, { merge: true });
      setUser(prev => prev ? { ...prev, authMethod: nextMethod } : prev);
      setUserAuthMethodState(nextMethod);
    } catch (error) {
      console.error('[user] Error updating auth method:', error);
    }
  }, [user]);

  const isUserApproved = user?.status === 'approved_username_assigned';
  const isUserPending = user?.status === 'pending_verification';
  const isUserRejected = user?.status === 'rejected';
  const hasUsername = !!user?.username;

  return useMemo(() => ({
    user,
    isLoading,
    isRegistering,
    isUserApproved,
    isUserPending,
    isUserRejected,
    register,
    login,
    logout,
    updateUserStatus,
    hasUsername,
    userGender,
    userPhone,
    userDateOfBirth,
    userAuthMethod,
    setUserGender,
    setUserPhone,
    setUserDateOfBirth,
    setUserAuthMethod,
  }), [
    user,
    isLoading,
    isRegistering,
    isUserApproved,
    isUserPending,
    isUserRejected,
    register,
    login,
    logout,
    updateUserStatus,
    hasUsername,
    userGender,
    userPhone,
    userDateOfBirth,
    userAuthMethod,
    setUserGender,
    setUserPhone,
    setUserDateOfBirth,
    setUserAuthMethod,
  ]);
});