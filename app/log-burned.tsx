import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalorieFlameRing } from '@/components/CalorieFlameRing';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { enqueueTimedExercise } from '@/lib/exerciseEstimateQueue';
import {
  clearTimedBurnDraft,
  getTimedBurnDraft,
  subscribeTimedBurnDraft,
} from '@/lib/timedExerciseDraft';

export default function LogBurnedScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user } = useAuth();
  const draft = useSyncExternalStore(subscribeTimedBurnDraft, getTimedBurnDraft, getTimedBurnDraft);
  const bodyShift = useRef(new Animated.Value(0)).current;
  const returningFromEdit = useRef(false);
  const leaving = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (returningFromEdit.current) {
        bodyShift.setValue(-96);
        Animated.timing(bodyShift, {
          toValue: 0,
          duration: 480,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }).start();
      }
      return () => {
        returningFromEdit.current = true;
      };
    }, [bodyShift]),
  );

  useEffect(() => {
    if (!draft && !leaving.current) router.back();
  }, [draft]);

  function logExercise() {
    if (!draft || leaving.current) return;
    leaving.current = true;
    enqueueTimedExercise({
      kind: draft.kind,
      calories: draft.calories,
      durationMinutes: draft.durationMinutes,
      intensity: draft.intensity,
      userId: user?.uid ?? null,
    });
    if (router.canDismiss()) {
      router.dismissTo('/(tabs)' as Href);
    } else {
      router.replace('/(tabs)' as Href);
    }
    clearTimedBurnDraft();
  }

  if (!draft) return null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.pagePad}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.pageTitle}>{t('exercise.burnedTitle')}</Text>
        </View>
      </View>

      <Animated.View style={[styles.slidingBody, { transform: [{ translateY: bodyShift }] }]}>
        <View style={[styles.pagePad, styles.center]}>
          <CalorieFlameRing size={140} strokeWidth={11} innerSize={58} flameSize={28} />
          <View style={styles.copy}>
            <Text style={styles.caption}>{t('exercise.yourWorkoutBurned')}</Text>
            <View style={styles.valueRow}>
              <Text style={styles.cals}>{t('exercise.calsCount', { count: draft.calories })}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('exercise.editCalories')}
                hitSlop={8}
                onPress={() => router.push('/log-edit-calories' as Href)}
                style={styles.editButton}
              >
                <MaterialCommunityIcons name="pencil" size={22} color="#C4C4C4" />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.footerBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('exercise.log')}
            onPress={logExercise}
            style={styles.logButton}
          >
            <Text style={styles.logText}>{t('exercise.log')}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pagePad: {
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    position: 'relative',
    marginBottom: 28,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '400',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8E9F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    opacity: 0.72,
  },
  slidingBody: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingBottom: 72,
  },
  copy: {
    alignItems: 'center',
    gap: 8,
  },
  caption: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cals: {
    color: colors.text,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
  },
  editButton: {
    marginTop: 2,
  },
  footerBar: {
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  logButton: {
    marginHorizontal: 20,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.buttonPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logText: {
    color: colors.buttonPrimaryText,
    fontSize: 17,
    fontWeight: '600',
  },
});
