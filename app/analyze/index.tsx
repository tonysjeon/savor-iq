import { useState } from 'react';
import { router } from 'expo-router';
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
  const [navigatingHome, setNavigatingHome] = useState(false);
  const leaveAnalyze = useLeaveAnalyze();

  function dismissCamera() {
    // Keep CameraView mounted so the live preview remains visible throughout
    // the downward dismissal animation.
    setLeaving(true);
    requestAnimationFrame(() => {
      leaveAnalyze();
    });
  }

  function handleClose() {
    dismissCamera();
  }

  function handleCapture(photo: CapturedMealPhoto, source: 'camera' | 'gallery') {
    if (!isGeminiConfigured || leaving || navigatingHome) return;
    enqueueMealAnalysis({
      photo,
      source,
      userId: user?.uid ?? null,
    });
    // Keep the restored live preview visible until navigation occurs. The black
    // cover used when manually closing the camera is intentionally skipped here.
    setNavigatingHome(true);
    // Analyze is opened on top of Home. Reveal the existing Home screen instead
    // of replacing this route, which can animate Home in as a new screen.
    if (router.canDismiss()) {
      router.dismiss();
    } else {
      router.replace('/(tabs)');
    }
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

  return (
    <MealCamera
      onClose={handleClose}
      onCapture={handleCapture}
      disabled={leaving || navigatingHome}
    />
  );
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
