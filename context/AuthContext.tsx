import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { auth, isFirebaseConfigured } from '@/lib/firebase';
import {
  deleteUserProfile,
  getUserProfile,
  saveUserProfile,
  type SavedUserProfile,
} from '@/lib/firestore';
import {
  calculateRecommendation,
  clearOnboardingDraft,
  getOnboardingDraft,
} from '@/lib/onboarding';

type AuthContextValue = {
  user: User | null;
  profile: SavedUserProfile | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SavedUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const savedProfile = await getUserProfile(nextUser.uid);
        if (savedProfile) {
          setProfile(savedProfile);
        } else {
          const onboarding = await getOnboardingDraft();
          setProfile(
            onboarding
              ? {
                  name: nextUser.displayName ?? '',
                  email: nextUser.email ?? '',
                  onboarding,
                  recommendation: calculateRecommendation(onboarding),
                }
              : null,
          );
        }
      } catch {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* to your .env.');
    }
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* to your .env.');
    }
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const displayName = name.trim();
    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }
    try {
      const onboarding = await getOnboardingDraft();
      const recommendation = onboarding ? calculateRecommendation(onboarding) : undefined;
      await saveUserProfile({
        uid: credential.user.uid,
        name: displayName,
        email: email.trim(),
        onboarding: onboarding ?? undefined,
        recommendation,
      });
      setProfile({
        name: displayName,
        email: email.trim(),
        onboarding: onboarding ?? undefined,
        recommendation,
      });
      if (onboarding) await clearOnboardingDraft();
    } catch {
      // Profile doc is best-effort; auth account still succeeds.
    }
  }, []);

  const signInWithGoogle = useCallback(async (idToken: string) => {
    if (!auth) {
      throw new Error('Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_* to your .env.');
    }

    const credential = await signInWithCredential(
      auth,
      GoogleAuthProvider.credential(idToken),
    );

    if (!getAdditionalUserInfo(credential)?.isNewUser) return;

    try {
      const onboarding = await getOnboardingDraft();
      const recommendation = onboarding ? calculateRecommendation(onboarding) : undefined;
      await saveUserProfile({
        uid: credential.user.uid,
        name: credential.user.displayName ?? '',
        email: credential.user.email ?? '',
        onboarding: onboarding ?? undefined,
        recommendation,
      });
      setProfile({
        name: credential.user.displayName ?? '',
        email: credential.user.email ?? '',
        onboarding: onboarding ?? undefined,
        recommendation,
      });
      if (onboarding) await clearOnboardingDraft();
    } catch {
      // Profile doc is best-effort; auth account still succeeds.
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!auth?.currentUser) return;
    const currentUser = auth.currentUser;
    await deleteUserProfile(currentUser.uid);
    await deleteUser(currentUser);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      configured: isFirebaseConfigured,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      deleteAccount,
    }),
    [user, profile, loading, signIn, signInWithGoogle, signUp, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
