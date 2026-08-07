import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MealCamera, type CapturedMealPhoto } from '@/components/MealCamera';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';
import { isGeminiConfigured } from '@/lib/gemini';
import { useLeaveAnalyze } from '@/lib/leaveAnalyze';
import { enqueueMealAnalysis } from '@/lib/mealAnalysisQueue';

export default function AnalyzeScreen() {
  const { user } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const leaveAnalyze = useLeaveAnalyze();

  function dismissCamera() {
    // Drop CameraView before dismiss so it doesn't flash corners.
    setLeaving(true);
    requestAnimationFrame(() => {
      leaveAnalyze();
    });
  }

  function handleClose() {
    dismissCamera();
  }

  function handleCapture(photo: CapturedMealPhoto, source: 'camera' | 'gallery') {
    if (!isGeminiConfigured || leaving) return;
    enqueueMealAnalysis({
      photo,
      source,
      userId: user?.uid ?? null,
    });
    dismissCamera();
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

  if (leaving) {
    return <View style={styles.cover} />;
  }

  return (
    <MealCamera
      onClose={handleClose}
      onCapture={handleCapture}
      disabled={leaving}
    />
  );
}

const styles = StyleSheet.create({
  cover: {
    flex: 1,
    backgroundColor: '#000000',
  },
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
