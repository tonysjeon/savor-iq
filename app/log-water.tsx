import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { G, Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { ProgressRing } from '@/components/ProgressRing';
import { useLanguage } from '@/context/LanguageContext';
import type { MessageKey } from '@/lib/i18n';
import { addTodayWaterMl, ML_PER_FL_OZ } from '@/lib/waterLog';

const WATER_GOAL_ML = 2000;
const ML_PER_OZ = ML_PER_FL_OZ;

type WaterUnit = 'oz' | 'ml';
type PresetKind = 'glass' | 'bottle' | 'large';

const PRESETS: {
  oz: number;
  ml: number;
  kind: PresetKind;
  label: MessageKey;
}[] = [
  { oz: 8, ml: 250, kind: 'glass', label: 'water.glass' },
  { oz: 16, ml: 500, kind: 'bottle', label: 'water.bottle' },
  { oz: 32, ml: 1000, kind: 'large', label: 'water.largeBottle' },
];

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

function GlassIcon() {
  return (
    <Svg width={27} height={29} viewBox="0 0 28 28">
      <Path
        d="M7.2 4.8 H20.8 L19.15 22.1 C18.98 23.65 17.7 24.8 16.14 24.8 H11.86 C10.3 24.8 9.02 23.65 8.85 22.1 Z"
        stroke={colors.text}
        strokeWidth={1.75}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M8.35 12.4 H19.65"
        stroke={colors.text}
        strokeWidth={1.55}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function BottleIcon() {
  return (
    <Svg width={32} height={34} viewBox="0 0 28 28">
      <Path
        d="M12.15 2.15 H15.85 C16.2 2.15 16.4 2.35 16.4 2.7 V4.2 H11.6 V2.7 C11.6 2.35 11.8 2.15 12.15 2.15 Z"
        stroke={colors.text}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M11.6 4.75 H16.4 V5.45 H11.6 Z"
        stroke={colors.text}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M11.6 5.45 C10.15 6.4 9.05 7.95 9.05 9.65 V11.95 C9.5 12.4 9.5 12.85 9.05 13.3 V15.75 C9.5 16.2 9.5 16.65 9.05 17.1 V19.55 C9.5 20.0 9.5 20.45 9.05 20.9 V23.4 C9.05 24.6 10.15 25.6 11.55 25.6 H16.45 C17.85 25.6 18.95 24.6 18.95 23.4 V20.9 C18.5 20.45 18.5 20.0 18.95 19.55 V17.1 C18.5 16.65 18.5 16.2 18.95 15.75 V13.3 C18.5 12.85 18.5 12.4 18.95 11.95 V9.65 C18.95 7.95 17.85 6.4 16.4 5.45 Z"
        stroke={colors.text}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M9.55 13.3 H18.45"
        stroke={colors.text}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Path
        d="M9.55 17.1 H18.45"
        stroke={colors.text}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Path
        d="M9.55 20.9 H18.45"
        stroke={colors.text}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function LargeBottleIcon() {
  return (
    <Svg width={32} height={34} viewBox="0 0 28 30">
      <G transform="translate(14 16) scale(1.1) translate(-14 -16)">
      <Path
        d="M10.75 6.7 H17.25 C17.55 6.7 17.75 6.9 17.75 7.2 V9.7 H10.25 V7.2 C10.25 6.9 10.45 6.7 10.75 6.7 Z"
        stroke={colors.text}
        strokeWidth={1.45}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M10.25 7.55 A 3.75 5.05 0 0 1 17.75 7.55"
        stroke={colors.text}
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M10.25 9.7 H17.75"
        stroke={colors.text}
        strokeWidth={1.35}
        strokeLinecap="round"
      />
      <Path
        d="M10.25 9.7 C10.25 11.05 8.5 12.4 8.5 13.85 V25.35 C8.5 26.7 9.7 27.8 11.1 27.8 H16.9 C18.3 27.8 19.5 26.7 19.5 25.35 V13.85 C19.5 12.4 17.75 11.05 17.75 9.7 Z"
        stroke={colors.text}
        strokeWidth={1.45}
        fill="none"
        strokeLinejoin="round"
      />
      </G>
    </Svg>
  );
}

function PresetIcon({ kind }: { kind: PresetKind }) {
  if (kind === 'glass') return <GlassIcon />;
  if (kind === 'bottle') return <BottleIcon />;
  return <LargeBottleIcon />;
}

function presetAmount(preset: (typeof PRESETS)[number], unit: WaterUnit) {
  return unit === 'ml' ? preset.ml : preset.oz;
}

function amountToMl(amount: number, unit: WaterUnit) {
  return unit === 'ml' ? Math.round(amount) : Math.round(amount * ML_PER_OZ);
}

function mlToUnit(ml: number, unit: WaterUnit) {
  return unit === 'ml' ? Math.round(ml) : Math.round(ml / ML_PER_OZ);
}

export default function LogWaterScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [unit, setUnit] = useState<WaterUnit>('oz');
  const [amount, setAmount] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [shownTotal, setShownTotal] = useState(0);
  const [ringProgress, setRingProgress] = useState(0);
  const caret = useRef(new Animated.Value(1)).current;
  const logging = useRef(false);

  useEffect(() => {
    if (confirming) return;
    let visible = true;
    const timer = setInterval(() => {
      visible = !visible;
      caret.setValue(visible ? 1 : 0);
    }, 530);
    return () => clearInterval(timer);
  }, [caret, confirming]);

  const display = amount;
  const canLog = amount > 0 && !confirming;

  function toggleUnit() {
    setUnit((current) => (current === 'oz' ? 'ml' : 'oz'));
  }

  function appendDigit(digit: string) {
    const next = Number(`${display === 0 ? '' : display}${digit}`);
    if (!Number.isFinite(next) || next > 9999) return;
    setAmount(next);
  }

  function backspace() {
    const asText = String(display);
    if (asText.length <= 1) {
      setAmount(0);
      return;
    }
    setAmount(Number(asText.slice(0, -1)));
  }

  function addPreset(value: number) {
    setAmount((current) => current + value);
  }

  async function logWater() {
    if (!canLog || logging.current) return;
    logging.current = true;
    try {
      const addedMl = amountToMl(amount, unit);
      const { from, to } = await addTodayWaterMl(addedMl);
      setConfirming(true);
      setShownTotal(mlToUnit(from, unit));
      setRingProgress(from / WATER_GOAL_ML);
      requestAnimationFrame(() => {
        setShownTotal(mlToUnit(to, unit));
        setRingProgress(to / WATER_GOAL_ML);
      });
      setTimeout(() => {
        router.back();
      }, 1250);
    } catch {
      logging.current = false;
    }
  }

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
          <Text style={styles.pageTitle}>{t('tabs.logWater')}</Text>
        </View>
      </View>

      {confirming ? (
        <View style={[styles.confirmOverlay, { top: insets.top + 56 }]}>
          <View style={styles.confirmContent}>
            <AnimatedNumber
              value={shownTotal}
              suffix={` ${t(unit === 'oz' ? 'water.oz' : 'water.ml')}`}
              style={styles.confirmValue}
              fadeColor={colors.page}
            />
            <Text style={styles.confirmLabel}>{t('water.dailyTotal')}</Text>
            <ProgressRing
              size={148}
              strokeWidth={12}
              progress={ringProgress}
              color="#42A5F5"
              trackColor={colors.surfaceElevated}
            >
              <MaterialCommunityIcons name="cup-water" size={44} color="#42A5F5" />
            </ProgressRing>
          </View>
        </View>
      ) : null}

      <View style={styles.amountRow}>
        <View style={styles.amountCluster}>
          <Text style={[styles.amountValue, amount === 0 && styles.amountEmpty]}>
            {display}
          </Text>
          <Animated.View style={[styles.caret, { opacity: caret }]} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(unit === 'oz' ? 'water.oz' : 'water.ml')}
          onPress={toggleUnit}
          style={styles.unitButton}
        >
          <Text style={styles.unitText}>{t(unit === 'oz' ? 'water.oz' : 'water.ml')}</Text>
          <View style={styles.unitChevrons}>
            <Svg width={8} height={4.5} viewBox="0 0 12 7">
              <Path
                d="M1.2 5.6 L6 1.4 L10.8 5.6"
                stroke={colors.text}
                strokeWidth={2.55}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Svg width={8} height={4.5} viewBox="0 0 12 7">
              <Path
                d="M1.2 1.4 L6 5.6 L10.8 1.4"
                stroke={colors.text}
                strokeWidth={2.55}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </Pressable>
      </View>

      <View style={styles.presetRow}>
        {PRESETS.map((preset) => (
          <Pressable
            key={preset.label}
            accessibilityRole="button"
            accessibilityLabel={`${t(preset.label)} ${presetAmount(preset, unit)} ${t(unit === 'oz' ? 'water.oz' : 'water.ml')}`}
            onPress={() => addPreset(presetAmount(preset, unit))}
            style={({ pressed }) => [styles.presetCard, pressed && styles.presetPressed]}
          >
            <View style={styles.presetIconSlot}>
              <PresetIcon kind={preset.kind} />
            </View>
            <Text style={styles.presetTitle}>{t(preset.label)}</Text>
            <Text style={styles.presetAmount}>
              {presetAmount(preset, unit)} {t(unit === 'oz' ? 'water.oz' : 'water.ml')}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.bottomDock}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('water.log')}
        disabled={!canLog}
        onPress={logWater}
        style={[styles.logButton, !canLog && styles.logButtonDisabled]}
      >
        <Text style={styles.logButtonText}>{t('water.log')}</Text>
      </Pressable>

      <View
        style={[
          styles.keypad,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  pagePad: {
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    position: 'relative',
    marginBottom: 8,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
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
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 28,
    marginBottom: 36,
  },
  amountCluster: {
    position: 'relative',
    paddingRight: 4,
    justifyContent: 'center',
  },
  amountValue: {
    color: colors.text,
    fontSize: 54,
    fontWeight: '600',
    letterSpacing: -2,
    lineHeight: 54,
    includeFontPadding: false,
  },
  amountEmpty: {
    color: 'rgba(17, 17, 17, 0.18)',
  },
  caret: {
    position: 'absolute',
    right: 0,
    top: '50%',
    width: 2,
    height: 64,
    marginTop: -35,
    backgroundColor: colors.text,
  },
  unitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginLeft: 3,
  },
  unitText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 26,
    includeFontPadding: false,
  },
  unitChevrons: {
    justifyContent: 'center',
    gap: 2,
    marginLeft: 5,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  presetCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  presetIconSlot: {
    height: 36,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  presetPressed: {
    opacity: 0.82,
  },
  presetTitle: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  presetAmount: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: -2,
    includeFontPadding: false,
  },
  confirmOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.page,
    alignItems: 'stretch',
    justifyContent: 'center',
    zIndex: 5,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  confirmContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmValue: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '600',
    lineHeight: 48,
  },
  confirmLabel: {
    color: colors.textMuted,
    fontSize: 17,
    marginTop: 6,
    marginBottom: 36,
    textAlign: 'center',
  },
  bottomDock: {
    marginTop: 'auto',
  },
  logButton: {
    marginHorizontal: 20,
    marginBottom: 12,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.buttonPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButtonDisabled: {
    backgroundColor: '#C8C8C8',
  },
  logButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 17,
    fontWeight: '600',
  },
  keypad: {
    backgroundColor: '#D8D8DC',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
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
