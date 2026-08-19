import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import type { MealPlan } from '@/types/mealPlan';

type MealPlanCardProps = {
  plan: MealPlan;
};

export function MealPlanCard({ plan }: MealPlanCardProps) {
  const { t } = useLanguage();
  return (
    <View style={styles.wrap}>
      {plan.days.map((day, index) => (
        <View key={`${day.name}-${index}`} style={styles.dayCard}>
          <Text style={styles.dayTitle}>
            {day.name}
            {index === 0 ? ` · ${t('plan.today')}` : ''}
          </Text>

          <Text style={styles.mealLabel}>{t('plan.breakfast')}</Text>
          <Text style={styles.mealText}>{day.breakfast}</Text>

          <Text style={styles.mealLabel}>{t('plan.lunch')}</Text>
          <Text style={styles.mealText}>{day.lunch}</Text>

          <Text style={styles.mealLabel}>{t('plan.dinner')}</Text>
          <Text style={styles.mealText}>{day.dinner}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  dayCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  dayTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  mealLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  mealText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
  },
});
