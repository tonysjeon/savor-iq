import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseOptionIcon, type ExerciseOptionId } from '@/components/ExerciseOptionIcon';
import { colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import type { MessageKey } from '@/lib/i18n';

type ExerciseOption = {
  id: ExerciseOptionId;
  title: MessageKey;
  hint: MessageKey;
};

const OPTIONS: ExerciseOption[] = [
  { id: 'run', title: 'exercise.run', hint: 'exercise.runHint' },
  { id: 'weights', title: 'exercise.weights', hint: 'exercise.weightsHint' },
  { id: 'describe', title: 'exercise.describe', hint: 'exercise.describeHint' },
  { id: 'manual', title: 'exercise.manual', hint: 'exercise.manualHint' },
];

export default function LogExerciseScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

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
          <Text style={styles.pageTitle}>{t('tabs.logExercise')}</Text>
        </View>

        <View style={[styles.optionsWrap, { paddingBottom: insets.bottom }]}>
          <View style={styles.options}>
            {OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={`${t(option.title)}. ${t(option.hint)}`}
                onPress={() => {
                  if (option.id === 'run') router.push('/log-run' as Href);
                  if (option.id === 'weights') router.push('/log-weights' as Href);
                  if (option.id === 'describe') router.push('/log-describe' as Href);
                  if (option.id === 'manual') router.push('/log-manual' as Href);
                }}
                style={({ pressed }) => [styles.optionCard, pressed && styles.optionPressed]}
              >
                <View style={styles.optionIcon}>
                  <ExerciseOptionIcon id={option.id} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{t(option.title)}</Text>
                  <Text style={styles.optionHint}>{t(option.hint)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
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
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    position: 'relative',
    marginBottom: 20,
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
  optionsWrap: {
    flex: 1,
    justifyContent: 'center',
    marginTop: -52,
  },
  options: {
    gap: 14,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 92,
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  optionPressed: {
    opacity: 0.82,
  },
  optionIcon: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  optionHint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '400',
  },
});
