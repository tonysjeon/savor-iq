import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { MealCamera, type CapturedMealPhoto } from '@/components/MealCamera';
import { colors } from '@/constants/theme';
import { startAnalyzeSession } from '@/lib/analyzeSession';
import { isGeminiConfigured } from '@/lib/gemini';

export default function AnalyzeScreen() {
  function handleClose() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  function handleCapture(photo: CapturedMealPhoto, source: 'camera' | 'gallery') {
    if (!isGeminiConfigured) return;
    startAnalyzeSession(photo, source);
    router.push('/analyze/confirm');
  }

  if (!isGeminiConfigured) {
    return (
      <View style={styles.noticeScreen}>
        <Text style={styles.noticeTitle}>Gemini not configured</Text>
        <Text style={styles.noticeBody}>
          Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file, then restart Expo.
        </Text>
        <Pressable onPress={handleClose}>
          <Text style={styles.backHint}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return <MealCamera onClose={handleClose} onCapture={handleCapture} />;
}

const styles = StyleSheet.create({
  noticeScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  noticeBody: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  backHint: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
});
