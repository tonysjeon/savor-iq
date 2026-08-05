import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';

export default function LoginScreen() {
  const { user, loading, configured, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) {
    return <Redirect href="/(tabs)" />;
  }

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.brand}>Savor IQ</Text>
      <Text style={styles.subtitle}>Sign in to save recipes and meal plans.</Text>

      {!configured ? (
        <Text style={styles.notice}>
          Firebase is not configured yet. Add EXPO_PUBLIC_FIREBASE_* values to a local .env
          file, then restart Expo.
        </Text>
      ) : null}

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, (!configured || submitting) && styles.buttonDisabled]}
        disabled={!configured || submitting}
        onPress={onSubmit}
      >
        {submitting ? (
          <ActivityIndicator color={colors.buttonPrimaryText} />
        ) : (
          <Text style={styles.buttonText}>Sign in</Text>
        )}
      </Pressable>

      <Link href="/(auth)/signup" style={styles.link}>
        Create an account
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brand: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 28,
  },
  notice: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  error: {
    color: '#FF6B6B',
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.buttonPrimaryBg,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.buttonPrimaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: colors.text,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 15,
  },
});
