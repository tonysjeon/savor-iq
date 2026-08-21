import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line } from 'react-native-svg';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { estimateTimedExerciseCalories, type TimedExerciseKind } from '@/lib/exerciseCalories';
import type { MessageKey } from '@/lib/i18n';
import { getOnboardingDraft } from '@/lib/onboarding';
import { setTimedBurnDraft } from '@/lib/timedExerciseDraft';

const DURATION_PRESETS = [15, 30, 60, 90] as const;
const INTENSITY_ORDER = ['high', 'medium', 'low'] as const;
const THUMB_SIZE = 20;
const TRACK_WIDTH = 7;
const TRACK_FILL = '#E6E6E6';

const KEY_LETTERS: Record<string, string> = {
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
};

type IntensityId = (typeof INTENSITY_ORDER)[number];

const INTENSITY_TITLES: Record<IntensityId, MessageKey> = {
  high: 'exercise.high',
  medium: 'exercise.medium',
  low: 'exercise.low',
};

export type TimedExerciseConfig = {
  kind: TimedExerciseKind;
  title: MessageKey;
  headerIcon: ReactNode;
  intensityHints: Record<IntensityId, MessageKey>;
};

function IntensityIcon() {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
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

function snapIntensity(y: number, height: number): IntensityId {
  const t = height <= 0 ? 0 : Math.max(0, Math.min(1, y / height));
  if (t < 1 / 3) return 'high';
  if (t < 2 / 3) return 'medium';
  return 'low';
}

function IntensitySlider({
  value,
  onChange,
}: {
  value: IntensityId;
  onChange: (next: IntensityId) => void;
}) {
  const [trackHeight, setTrackHeight] = useState(0);
  const originY = useRef(0);
  const heightRef = useRef(0);
  const hitRef = useRef<View>(null);

  function applyFromPageY(pageY: number) {
    onChange(snapIntensity(pageY - originY.current, heightRef.current));
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          hitRef.current?.measureInWindow((_, y) => {
            originY.current = y;
            applyFromPageY(event.nativeEvent.pageY);
          });
        },
        onPanResponderMove: (event) => {
          applyFromPageY(event.nativeEvent.pageY);
        },
      }),
    [onChange],
  );

  const index = INTENSITY_ORDER.indexOf(value);
  const travel = Math.max(trackHeight - THUMB_SIZE, 0);
  const thumbTop = (index / (INTENSITY_ORDER.length - 1)) * travel;

  const fillHeight = Math.max(TRACK_WIDTH, trackHeight - thumbTop - THUMB_SIZE);

  return (
    <View
      ref={hitRef}
      {...panResponder.panHandlers}
      onLayout={(event) => {
        const nextHeight = event.nativeEvent.layout.height;
        heightRef.current = nextHeight;
        setTrackHeight(nextHeight);
      }}
      style={styles.sliderHit}
    >
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { height: fillHeight }]} />
      </View>
      <View style={[styles.sliderThumb, { top: thumbTop }]} />
    </View>
  );
}

function IntensityOption({
  id,
  hint,
  active,
  onPress,
}: {
  id: IntensityId;
  hint: MessageKey;
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  const scale = useRef(new Animated.Value(active ? 1.04 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.04 : 1,
      friction: 7,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${t(INTENSITY_TITLES[id])}. ${t(hint)}`}
      onPress={onPress}
      style={styles.intensityRow}
    >
      <Animated.View
        style={[
          styles.intensityCopy,
          { transform: [{ scale }], transformOrigin: 'left center' },
        ]}
      >
        <Text style={[styles.intensityName, active && styles.intensityNameActive]}>
          {t(INTENSITY_TITLES[id])}
        </Text>
        <Text style={[styles.intensityHint, active && styles.intensityHintActive]}>
          {t(hint)}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function LogTimedExerciseScreen({
  kind,
  title,
  headerIcon,
  intensityHints,
}: TimedExerciseConfig) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [intensity, setIntensity] = useState<IntensityId>('medium');
  const [duration, setDuration] = useState('15');
  const [editingDuration, setEditingDuration] = useState(false);
  const committedDuration = useRef('15');
  const editProgress = useRef(new Animated.Value(0)).current;
  const minutes = Number(duration);
  const canContinue = Number.isFinite(minutes) && minutes > 0;

  function animateEditing(next: boolean) {
    setEditingDuration(next);
    Animated.timing(editProgress, {
      toValue: next ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }

  function openDurationEditor() {
    if (editingDuration) return;
    committedDuration.current = duration || committedDuration.current;
    setDuration('');
    animateEditing(true);
  }

  function closeDurationEditor(keepValue: boolean) {
    if (!keepValue || !duration || Number(duration) <= 0) {
      setDuration(committedDuration.current);
    } else {
      committedDuration.current = duration;
    }
    animateEditing(false);
  }

  function applyPreset(value: number) {
    setDuration(String(value));
    committedDuration.current = String(value);
  }

  function appendDigit(digit: string) {
    setDuration((current) => {
      const next = `${current === '0' ? '' : current}${digit}`;
      if (next.length > 3) return current;
      return next;
    });
  }

  function backspace() {
    setDuration((current) => current.slice(0, -1));
  }

  async function continueToEstimate() {
    if (!canContinue) return;
    const profile = await getOnboardingDraft();
    const calories = estimateTimedExerciseCalories({
      kind,
      intensity,
      durationMinutes: minutes,
      weightKg: profile?.weightKg,
    });
    setTimedBurnDraft({
      kind,
      intensity,
      durationMinutes: minutes,
      calories,
    });
    router.push('/log-burned' as Href);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.pagePad}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={8}
            onPress={() => (editingDuration ? closeDurationEditor(true) : router.back())}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.titleRow}>
            {headerIcon}
            <Text style={styles.pageTitle}>{t(title)}</Text>
          </View>
        </View>

        <Animated.View
          pointerEvents={editingDuration ? 'none' : 'auto'}
          style={[
            styles.intensitySection,
            {
              opacity: editProgress.interpolate({
                inputRange: [0, 0.55, 1],
                outputRange: [1, 0, 0],
              }),
              maxHeight: editProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [280, 0],
              }),
              marginBottom: editProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [28, 0],
              }),
              transform: [
                {
                  translateY: editProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -36],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.sectionLabel}>
            <IntensityIcon />
            <Text style={styles.sectionTitle}>{t('exercise.setIntensity')}</Text>
          </View>
          <View style={styles.intensityCard}>
            <View style={styles.intensityLevels}>
              {INTENSITY_ORDER.map((id) => (
                <IntensityOption
                  key={id}
                  id={id}
                  hint={intensityHints[id]}
                  active={id === intensity}
                  onPress={() => setIntensity(id)}
                />
              ))}
            </View>
            <IntensitySlider value={intensity} onChange={setIntensity} />
          </View>
        </Animated.View>

        <View style={styles.durationSection}>
          <View style={styles.sectionLabel}>
            <Ionicons name="stopwatch-outline" size={22} color={colors.text} />
            <Text style={styles.sectionTitle}>{t('exercise.duration')}</Text>
          </View>
          <View style={styles.chipRow}>
            {DURATION_PRESETS.map((preset) => {
              const selected = minutes === preset && duration === String(preset);
              return (
                <Pressable
                  key={preset}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t('exercise.mins', { count: preset })}
                  onPress={() => applyPreset(preset)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {t('exercise.mins', { count: preset })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('exercise.minutes')}
            onPress={openDurationEditor}
            style={styles.durationInput}
          >
            <Text style={[styles.durationValue, !duration && styles.durationPlaceholder]}>
              {duration || t('exercise.minutes')}
            </Text>
          </Pressable>
        </View>

        {editingDuration ? (
          <Pressable style={styles.dismissArea} onPress={() => closeDurationEditor(true)} />
        ) : null}
      </View>

      <View style={styles.bottomDock}>
        {editingDuration ? (
          <View style={styles.doneBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('exercise.done')}
              onPress={() => closeDurationEditor(true)}
              style={styles.continueButton}
            >
              <Text style={styles.continueText}>{t('exercise.done')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('exercise.continue')}
            disabled={!canContinue}
            onPress={() => {
              void continueToEstimate();
            }}
            style={[
              styles.continueButton,
              { marginBottom: Math.max(insets.bottom, 16) },
              !canContinue && styles.continueDisabled,
            ]}
          >
            <Text style={styles.continueText}>{t('exercise.continue')}</Text>
          </Pressable>
        )}

        {editingDuration ? (
          <View style={[styles.keypad, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['', '0', 'back'],
            ].map((row) => (
              <View key={row.join('-')} style={styles.keypadRow}>
                {row.map((key) => {
                  if (key === '') {
                    return <View key="spacer" style={styles.keyGhost} />;
                  }
                  if (key === 'back') {
                    return (
                      <Pressable
                        key="back"
                        accessibilityRole="button"
                        accessibilityLabel={t('common.delete')}
                        onPress={backspace}
                        style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                      >
                        <Ionicons name="backspace-outline" size={26} color={colors.text} />
                      </Pressable>
                    );
                  }
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={key}
                      onPress={() => appendDigit(key)}
                      style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                    >
                      <Text style={styles.keyDigit}>{key}</Text>
                      {KEY_LETTERS[key] ? (
                        <Text style={styles.keyLetters}>{KEY_LETTERS[key]}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pagePad: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    position: 'relative',
    marginBottom: 28,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  intensitySection: {
    overflow: 'hidden',
    gap: 12,
  },
  durationSection: {
    gap: 12,
  },
  dismissArea: {
    flex: 1,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
  },
  intensityCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 214,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 10,
    paddingLeft: 18,
    paddingRight: 16,
    gap: 12,
  },
  intensityLevels: {
    flex: 1,
  },
  intensityRow: {
    flex: 1,
    justifyContent: 'center',
  },
  intensityCopy: {
    alignSelf: 'flex-start',
    gap: 2,
  },
  intensityName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  intensityNameActive: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
  },
  intensityHint: {
    color: 'rgba(17, 17, 17, 0.26)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  intensityHintActive: {
    color: colors.text,
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '400',
  },
  sliderHit: {
    width: 32,
    alignItems: 'center',
  },
  sliderTrack: {
    position: 'absolute',
    top: THUMB_SIZE / 2,
    bottom: THUMB_SIZE / 2,
    width: TRACK_WIDTH,
    borderRadius: TRACK_WIDTH / 2,
    backgroundColor: TRACK_FILL,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  sliderFill: {
    width: TRACK_WIDTH,
    backgroundColor: colors.text,
    borderRadius: TRACK_WIDTH / 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    zIndex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.text,
  },
  chipText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.buttonPrimaryText,
  },
  durationInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.text,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  durationValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  durationPlaceholder: {
    color: 'rgba(17, 17, 17, 0.32)',
    fontWeight: '400',
  },
  bottomDock: {
    marginTop: 'auto',
  },
  continueButton: {
    marginHorizontal: 20,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.buttonPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBar: {
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    paddingBottom: 12,
  },
  continueDisabled: {
    backgroundColor: '#C8C8C8',
  },
  continueText: {
    color: colors.buttonPrimaryText,
    fontSize: 17,
    fontWeight: '700',
  },
  keypad: {
    backgroundColor: '#D8D8DC',
    paddingHorizontal: 6,
    paddingTop: 8,
    gap: 7,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 7,
  },
  key: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyGhost: {
    flex: 1,
    height: 48,
  },
  keyPressed: {
    backgroundColor: '#E8E8E8',
  },
  keyDigit: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 24,
  },
  keyLetters: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: -1,
  },
});
