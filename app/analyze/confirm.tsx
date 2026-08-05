import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import { getAnalyzeSession } from '@/lib/analyzeSession';
import { isGeminiConfigured } from '@/lib/gemini';

export default function AnalyzeConfirmScreen() {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    const session = getAnalyzeSession();
    if (!session) {
      router.replace('/(tabs)');
      return;
    }
    setUri(session.photo.uri);
  }, []);

  function startAnalysis() {
    if (!isGeminiConfigured) return;
    router.replace('/analyze/processing');
  }

  function retake() {
    router.back();
  }

  if (!uri) {
    return <View style={styles.flex} />;
  }

  return (
    <View style={styles.flex}>
      <Image source={{ uri }} style={styles.photo} resizeMode="cover" />

      <View style={styles.footer}>
        <Text style={styles.hint}>Looks good? Continue to analyze, or retake.</Text>
        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={retake}>
            <Ionicons name="refresh" size={18} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Retake</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, !isGeminiConfigured && styles.buttonDisabled]}
            disabled={!isGeminiConfigured}
            onPress={startAnalysis}
          >
            <Ionicons name="restaurant-outline" size={18} color={colors.buttonPrimaryText} />
            <Text style={styles.primaryButtonText}>Analyze</Text>
          </Pressable>
        </View>
        {!isGeminiConfigured ? (
          <Text style={styles.error}>
            Add EXPO_PUBLIC_GEMINI_API_KEY to your .env and restart Expo.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  photo: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.surface,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.buttonPrimaryBg,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  error: {
    color: '#FF6B6B',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
