import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';
import {
  getAnalyzeSession,
  setAnalyzeResult,
} from '@/lib/analyzeSession';
import { saveNutritionAnalysis } from '@/lib/firestore';
import { analyzeNutritionFromImage } from '@/lib/gemini';

const STEPS = [
  'Detecting food…',
  'Estimating portions…',
  'Calculating macros…',
  'Writing nutrition tips…',
] as const;

export default function AnalyzeProcessingScreen() {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const cancelled = useRef(false);

  useEffect(() => {
    const session = getAnalyzeSession();
    if (!session) {
      router.replace('/(tabs)');
      return;
    }

    setPhotoUri(session.photo.uri);
    setError(null);
    setStepIndex(0);
    progress.setValue(0);
    cancelled.current = false;

    const { base64, mimeType } = session.photo;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    Animated.timing(progress, {
      toValue: 0.85,
      duration: 12000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const stepTimer = setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
    }, 2200);

    async function run() {
      try {
        const info = await analyzeNutritionFromImage(base64, mimeType);

        if (cancelled.current) return;

        let saveWarning: string | null = null;
        if (user) {
          try {
            await saveNutritionAnalysis(user.uid, info);
          } catch (cloudErr) {
            saveWarning =
              cloudErr instanceof Error
                ? `Saved analysis locally, but cloud save failed: ${cloudErr.message}`
                : 'Saved analysis locally, but cloud save failed.';
          }
        }

        setAnalyzeResult(info, saveWarning);

        Animated.timing(progress, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start(() => {
          if (!cancelled.current) {
            router.replace('/analyze/result');
          }
        });
      } catch (err) {
        if (cancelled.current) return;
        setError(err instanceof Error ? err.message : 'Analysis failed.');
        progress.stopAnimation();
      }
    }

    void run();

    return () => {
      cancelled.current = true;
      pulseLoop.stop();
      clearInterval(stepTimer);
    };
  }, [attempt, pulse, progress, user]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });
  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  function goBackHome() {
    cancelled.current = true;
    router.replace('/(tabs)');
  }

  function retry() {
    setAttempt((value) => value + 1);
  }

  return (
    <View style={styles.flex}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.backdrop} blurRadius={18} />
      ) : null}
      <View style={styles.scrim} />

      <View style={styles.content}>
        {error ? (
          <>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={40} color="#FF6B6B" />
            </View>
            <Text style={styles.title}>Couldn’t finish analysis</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <View style={styles.errorActions}>
              <Pressable style={styles.secondaryButton} onPress={goBackHome}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={retry}>
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.radar}>
              <Animated.View
                style={[
                  styles.ring,
                  { opacity: ringOpacity, transform: [{ scale: ringScale }] },
                ]}
              />
              <View style={styles.core}>
                <Ionicons name="restaurant-outline" size={28} color={colors.text} />
              </View>
            </View>

            <Text style={styles.title}>Processing meal</Text>
            <Text style={styles.step}>{STEPS[stepIndex]}</Text>

            <View style={styles.barTrack}>
              <Animated.View style={[styles.barFill, { width: barWidth }]} />
            </View>
            <Text style={styles.caption}>This usually takes a few seconds</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  radar: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.text,
  },
  core: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  step: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    minHeight: 22,
  },
  barTrack: {
    width: '100%',
    maxWidth: 280,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    marginTop: 16,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.text,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  errorIcon: {
    marginBottom: 4,
  },
  errorBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
    maxWidth: 320,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.buttonPrimaryBg,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
