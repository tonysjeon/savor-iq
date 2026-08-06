import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import type { MealAnalysisJob } from '@/lib/mealAnalysisQueue';
import {
  dismissMealAnalysis,
  retryMealAnalysis,
} from '@/lib/mealAnalysisQueue';

function SkeletonBar({
  width,
  height = 14,
  pulse,
}: {
  width: number | `${number}%`;
  height?: number;
  pulse: Animated.Value;
}) {
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, opacity },
      ]}
    />
  );
}

export function MealProcessingCard({ job }: { job: MealAnalysisJob }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const isError = job.status === 'error';

  useEffect(() => {
    if (isError) {
      pulse.stopAnimation();
      pulse.setValue(0.5);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isError, pulse]);

  return (
    <View style={styles.card}>
      <Image source={{ uri: job.photo.uri }} style={styles.thumb} />
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
              <ActivityIndicator size="small" color={colors.textMuted} />
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
                <MaterialCommunityIcons name="peanut" size={16} color="#66BB6A" />
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
    minHeight: 108,
  },
  thumb: {
    width: 108,
    height: 108,
    backgroundColor: colors.surfaceElevated,
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
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  skeleton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 6,
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
