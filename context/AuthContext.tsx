import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
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
import { saveUserProfile } from '@/lib/firestore';
import {
  calculateRecommendation,
  clearOnboardingDraft,
  getOnboardingDraft,
} from '@/lib/onboarding';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
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
      await saveUserProfile({
        uid: credential.user.uid,
        name: displayName,
        email: email.trim(),
        onboarding: onboarding ?? undefined,
        recommendation: onboarding ? calculateRecommendation(onboarding) : undefined,
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

  const value = useMemo(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      signIn,
      signUp,
      signOut,
    }),
    [user, loading, signIn, signUp, signOut],
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
