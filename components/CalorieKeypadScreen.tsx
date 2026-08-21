import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalorieFlameRing } from '@/components/CalorieFlameRing';
import { colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

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

export function CalorieKeypadScreen({
  headerTitle,
  headerIcon,
  heading,
  submitLabel,
  initialValue = '0',
  onSubmit,
}: {
  headerTitle: string;
  headerIcon?: ReactNode;
  heading: string;
  submitLabel: string;
  initialValue?: string;
  onSubmit: (calories: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [calories, setCalories] = useState(initialValue.replace(/^0+(?=\d)/, '') || '0');
  const amount = Number(calories) || 0;
  const canSubmit = amount > 0;

  function appendDigit(digit: string) {
    setCalories((current) => {
      const next = `${current === '0' ? '' : current}${digit}`;
      if (next.length > 5) return current;
      return next;
    });
  }

  function backspace() {
    setCalories((current) => {
      const next = current.slice(0, -1);
      return next.length === 0 ? '0' : next;
    });
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
          <View style={styles.titleRow}>
            {headerIcon}
            <Text style={styles.pageTitle}>{headerTitle}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{heading}</Text>

        <View style={styles.inputRow}>
          <CalorieFlameRing innerSize={27} flameSize={14} />

          <View
            accessibilityRole="text"
            accessibilityLabel={t('exercise.caloriesBurnedHeading')}
            style={styles.field}
          >
            <Text style={styles.fieldLabel}>{t('exercise.caloriesBurnedHeading')}</Text>
            <View style={styles.valueRow}>
              <Text style={styles.fieldValue}>{calories}</Text>
              <View style={styles.caret} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.bottomDock}>
        <View style={styles.doneBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            disabled={!canSubmit}
            onPress={() => {
              if (!canSubmit) return;
              onSubmit(amount);
            }}
            style={[styles.addButton, !canSubmit && styles.addButtonDisabled]}
          >
            <Text style={styles.addButtonText}>{submitLabel}</Text>
          </Pressable>
        </View>

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
  sectionTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  field: {
    flex: 1,
    height: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  fieldLabel: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldValue: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '500',
  },
  caret: {
    width: 2,
    height: 18,
    marginLeft: 1,
    backgroundColor: '#3478F6',
    borderRadius: 1,
  },
  bottomDock: {
    marginTop: 'auto',
  },
  doneBar: {
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    paddingTop: 16,
    paddingBottom: 10,
  },
  addButton: {
    marginHorizontal: 16,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.buttonPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#C8C8C8',
  },
  addButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 17,
    fontWeight: '600',
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
