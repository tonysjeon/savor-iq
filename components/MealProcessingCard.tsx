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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AvocadoIcon } from '@/components/AvocadoIcon';
import { ProgressRing } from '@/components/ProgressRing';
import { colors } from '@/constants/theme';
import type { MealAnalysisJob } from '@/lib/mealAnalysisQueue';
import {
  dismissMealAnalysis,
  retryMealAnalysis,
} from '@/lib/mealAnalysisQueue';

function formatMealTime(createdAt: number | null | undefined): string {
  if (createdAt == null) return '';
  return new Date(createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
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
              <LinearGradient id="skeletonShimmer" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.72" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect
              width={measuredWidth}
              height={height}
              fill="url(#skeletonShimmer)"
            />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

function retakeFromAnalysisCard(jobId: string) {
  dismissMealAnalysis(jobId);
  router.push('/analyze' as Href);
}

function MealThumbnail({
  uri,
  progress,
}: {
  uri: string;
  progress: number;
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
      <Image source={{ uri }} style={styles.thumb} />
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

const CARD_HEIGHT = 120;

export function MealProcessingCard({ job }: { job: MealAnalysisJob }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [displayProgress, setDisplayProgress] = useState(job.progress);
  const isError = job.status === 'error';
  const isRetakeError = isError && job.errorKind === 'food_not_detected';
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

  // Keep the original capture as this card's preview to avoid swapping sources
  // while the resized display image is prepared.
  const imageUri = job.photo.uri;

  if (isReady && job.result) {
    const meal = job.result;
    const timeLabel = formatMealTime(meal.createdAt);
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/meal/${meal.id}` as Href)}
        accessibilityRole="button"
        accessibilityLabel={`Open nutrition for ${meal.foodName}`}
      >
        <MealThumbnail uri={imageUri} progress={displayProgress} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.mealTitle} numberOfLines={1}>
              {meal.foodName}
            </Text>
            {timeLabel ? <Text style={styles.mealTime}>{timeLabel}</Text> : null}
          </View>
          <View style={styles.calorieRow}>
            <Ionicons name="flame" size={18} color={colors.text} />
            <Text style={styles.mealCalories}>
              {Math.round(meal.calories)} calories
            </Text>
          </View>
          <View style={styles.macroRow}>
            <View style={styles.macro}>
              <MaterialCommunityIcons
                name="food-drumstick"
                size={16}
                color="#E57373"
              />
              <Text style={styles.macroText}>
                {Math.round(meal.macros.protein)}g
              </Text>
            </View>
            <View style={styles.macro}>
              <MaterialCommunityIcons name="barley" size={16} color="#FFA726" />
              <Text style={styles.macroText}>
                {Math.round(meal.macros.carbs)}g
              </Text>
            </View>
            <View style={styles.macro}>
              <AvocadoIcon size={16} color="#66BB6A" />
              <Text style={styles.macroText}>
                {Math.round(meal.macros.fat)}g
              </Text>
            </View>
          </View>
          {job.saveError ? (
            <Text style={styles.saveError} numberOfLines={2}>
              Not saved: {job.saveError}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  if (isRetakeError) {
    return (
      <View style={styles.card}>
        <Pressable
          style={styles.retakePressable}
          onPress={() => retakeFromAnalysisCard(job.id)}
          accessibilityRole="button"
          accessibilityLabel="No Food Detected. Tap to retry"
        >
          <Image source={{ uri: job.photo.uri }} style={styles.thumb} />
          <View style={styles.body}>
            <Text style={styles.retakeTitle} numberOfLines={1}>
              No Food Detected
            </Text>
            <View style={styles.retryPill}>
              <Text style={styles.retryPillText}>Tap to retry</Text>
            </View>
          </View>
        </Pressable>
        <Pressable
          style={styles.retakeDismiss}
          onPress={() => dismissMealAnalysis(job.id)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={8}
        >
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <MealThumbnail uri={job.photo.uri} progress={displayProgress} />
      <View style={styles.body}>
        {isError ? (
          <>
            <Text style={styles.errorTitle} numberOfLines={2}>
              Couldn’t analyze meal
            </Text>
            <Text style={styles.errorBody} numberOfLines={2}>
              {job.error ?? 'Something went wrong.'}
            </Text>
            <View style={styles.errorActions}>
              <Pressable
                style={styles.retryButton}
                onPress={() => retryMealAnalysis(job.id)}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
              <Pressable
                style={styles.dismissButton}
                onPress={() => dismissMealAnalysis(job.id)}
              >
                <Text style={styles.dismissText}>Dismiss</Text>
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
            <View style={styles.macroRow}>
              <View style={styles.macro}>
                <MaterialCommunityIcons
                  name="food-drumstick"
                  size={16}
                  color="#E57373"
                />
                <SkeletonBar width={28} height={14} pulse={pulse} />
              </View>
              <View style={styles.macro}>
                <MaterialCommunityIcons name="barley" size={16} color="#FFA726" />
                <SkeletonBar width={28} height={14} pulse={pulse} />
              </View>
              <View style={styles.macro}>
                <AvocadoIcon size={16} color="#66BB6A" />
                <SkeletonBar width={28} height={14} pulse={pulse} />
              </View>
            </View>
            <Text style={styles.status}>Analyzing meal…</Text>
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
    position: 'relative',
  },
  retakePressable: {
    flex: 1,
    flexDirection: 'row',
    height: CARD_HEIGHT,
  },
  retakeDismiss: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  thumb: {
    width: 108,
    height: CARD_HEIGHT,
    backgroundColor: colors.surfaceElevated,
  },
  thumbWrap: {
    width: 108,
    height: CARD_HEIGHT,
    position: 'relative',
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
  mealTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  mealTime: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealCalories: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    marginLeft: -2,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  macro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '400',
  },
  saveError: {
    color: '#EF5350',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
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
  retakeTitle: {
    color: '#EF5350',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 6,
    paddingRight: 28,
  },
  retryPill: {
    alignSelf: 'flex-start',
    marginLeft: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryPillText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
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
