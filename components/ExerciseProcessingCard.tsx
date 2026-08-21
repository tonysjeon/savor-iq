import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Line, Rect, Stop } from 'react-native-svg';

import { ExerciseOptionIcon, type ExerciseOptionId } from '@/components/ExerciseOptionIcon';
import { ProgressRing } from '@/components/ProgressRing';
import { colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import type { MessageKey } from '@/lib/i18n';
import {
  dismissExerciseEstimate,
  retryExerciseEstimate,
  type ExerciseEstimateJob,
  type ExerciseSource,
} from '@/lib/exerciseEstimateQueue';

const CARD_HEIGHT = 120;
const LOG_ROUTES: Record<ExerciseSource, Href> = {
  run: '/log-run',
  weights: '/log-weights',
  manual: '/log-manual',
  describe: '/log-describe',
};
const INTENSITY_KEYS: Record<'high' | 'medium' | 'low', MessageKey> = {
  high: 'exercise.high',
  medium: 'exercise.medium',
  low: 'exercise.low',
};

function formatTime(createdAt: number, locale: string): string {
  return new Date(createdAt).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function IntensitySunIcon() {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      {rays.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <Line
            key={deg}
            x1={12 + Math.cos(rad) * 5.2}
            y1={12 + Math.sin(rad) * 5.2}
            x2={12 + Math.cos(rad) * 10.4}
            y2={12 + Math.sin(rad) * 10.4}
            stroke={colors.text}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        );
      })}
      <Circle cx={12} cy={12} r={2.15} fill={colors.text} />
    </Svg>
  );
}

function SkeletonBar({
  width,
  height = 14,
  pulse,
}: {
  width: number | `${number}%`;
  height?: number;
  pulse: Animated.Value;
}) {
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const translateX = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [-measuredWidth, measuredWidth],
  });

  return (
    <View
      style={[styles.skeleton, { width, height }]}
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
    >
      {measuredWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shimmer,
            { width: measuredWidth, transform: [{ translateX }] },
          ]}
        >
          <Svg width={measuredWidth} height={height}>
            <Defs>
              <LinearGradient id="exerciseSkeletonShimmer" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.72" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect
              width={measuredWidth}
              height={height}
              fill="url(#exerciseSkeletonShimmer)"
            />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

function ExerciseThumb({
  progress,
  iconId,
}: {
  progress: number;
  iconId: ExerciseOptionId;
}) {
  const percentage = Math.min(100, Math.max(0, Math.round(progress)));
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(overlayOpacity, {
      toValue: percentage >= 100 ? 0 : 1,
      duration: percentage >= 100 ? 180 : 100,
      useNativeDriver: true,
    }).start();
  }, [overlayOpacity, percentage]);

  return (
    <View style={styles.thumbWrap}>
      <View style={styles.iconCircle}>
        <ExerciseOptionIcon id={iconId} size={28} />
      </View>
      <Animated.View
        style={[styles.progressFocus, { opacity: overlayOpacity }]}
        pointerEvents="none"
      >
        {percentage < 100 ? (
          <ProgressRing
            size={58}
            strokeWidth={6}
            progress={percentage / 100}
            color="#FFFFFF"
            trackColor="rgba(255,255,255,0.28)"
            animationDuration={180}
          >
            <Text style={styles.progressText}>{percentage}%</Text>
          </ProgressRing>
        ) : null}
      </Animated.View>
    </View>
  );
}

export function ExerciseProcessingCard({ job }: { job: ExerciseEstimateJob }) {
  const { t, locale } = useLanguage();
  const pulse = useRef(new Animated.Value(0)).current;
  const [displayProgress, setDisplayProgress] = useState(job.progress);
  const isError = job.status === 'error';
  const isReady = job.status === 'ready' && job.result;

  useEffect(() => {
    if (isError || isReady) {
      pulse.stopAnimation();
      pulse.setValue(0.5);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1250,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [isError, isReady, pulse]);

  useEffect(() => {
    if (isError) return;
    if (job.progress >= 100) {
      setDisplayProgress(100);
      return;
    }

    const ceiling = isReady ? 99 : 92;
    const interval = setInterval(() => {
      setDisplayProgress((current) => {
        const floor = Math.min(job.progress, ceiling);
        if (current < floor) {
          return Math.min(floor, current + Math.max(2.5, (floor - current) * 0.35));
        }
        if (current >= ceiling) return current;
        return Math.min(
          ceiling,
          current + Math.max(0.06, (ceiling - current) * 0.009),
        );
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isError, isReady, job.progress]);

  if (isReady && job.result) {
    const exercise = job.result;
    const iconId: ExerciseOptionId =
      exercise.source === 'run' ||
      exercise.source === 'weights' ||
      exercise.source === 'manual'
        ? exercise.source
        : 'describe';
    const isManual = exercise.source === 'manual';
    const title =
      exercise.source === 'manual'
        ? t('exercise.manual')
        : exercise.source === 'run'
          ? t('exercise.run')
          : exercise.source === 'weights'
            ? t('exercise.weights')
            : exercise.activity;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => router.push(LOG_ROUTES[exercise.source])}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <ExerciseThumb progress={displayProgress} iconId={iconId} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.time}>{formatTime(exercise.createdAt, locale)}</Text>
          </View>
          <View style={styles.calorieRow}>
            <Ionicons name="flame" size={18} color={colors.text} />
            <Text style={styles.calories}>
              {t('meal.calories', { count: Math.round(exercise.calories) })}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <IntensitySunIcon />
              <Text style={styles.metaText}>
                {isManual
                  ? t('exercise.unspecified')
                  : t('exercise.intensityNamed', {
                      level: t(INTENSITY_KEYS[exercise.intensity]),
                    })}
              </Text>
            </View>
            <View style={styles.meta}>
              <Ionicons name="stopwatch-outline" size={14} color={colors.text} />
              <Text style={styles.metaText}>
                {isManual
                  ? t('exercise.unspecified')
                  : t('exercise.cardMins', { count: exercise.durationMinutes })}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <ExerciseThumb progress={displayProgress} iconId="describe" />
      <View style={styles.body}>
        {isError ? (
          <>
            <Text style={styles.errorTitle} numberOfLines={2}>
              {t('processing.couldntEstimate')}
            </Text>
            <Text style={styles.errorBody} numberOfLines={2}>
              {job.error ?? t('meal.somethingWrong')}
            </Text>
            <View style={styles.errorActions}>
              <Pressable
                style={styles.retryButton}
                onPress={() => retryExerciseEstimate(job.id)}
              >
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </Pressable>
              <Pressable
                style={styles.dismissButton}
                onPress={() => dismissExerciseEstimate(job.id)}
              >
                <Text style={styles.dismissText}>{t('common.dismiss')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.titleRow}>
              <SkeletonBar width="62%" height={16} pulse={pulse} />
            </View>
            <View style={styles.calorieRow}>
              <Ionicons name="flame" size={18} color={colors.textMuted} />
              <SkeletonBar width={110} height={20} pulse={pulse} />
            </View>
            <View style={styles.metaRow}>
              <SkeletonBar width={108} height={14} pulse={pulse} />
              <SkeletonBar width={72} height={14} pulse={pulse} />
            </View>
            <Text style={styles.status}>{t('processing.analyzingExercise')}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    height: CARD_HEIGHT,
  },
  cardPressed: {
    opacity: 0.82,
  },
  thumbWrap: {
    width: 108,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    position: 'relative',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#E4E4E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressFocus: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  time: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '400',
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calories: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    marginLeft: -2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '400',
  },
  skeleton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 6,
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  status: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  errorTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  errorBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  retryButton: {
    backgroundColor: colors.buttonPrimaryBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryText: {
    color: colors.buttonPrimaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surfaceElevated,
  },
  dismissText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
