import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { NutritionInfo } from '@/types/nutrition';

type NutritionCardProps = {
  info: NutritionInfo;
};

const MACRO_COLORS = {
  protein: '#E57373',
  carbs: '#64B5F6',
  fat: '#FFD54F',
  fiber: '#81C784',
  sugar: '#F48FB1',
  sodium: '#90A4AE',
} as const;

function healthScoreColor(score: number): string {
  if (score >= 8) return '#66BB6A';
  if (score >= 5) return '#FFA726';
  return '#EF5350';
}

export function NutritionCard({ info }: NutritionCardProps) {
  const { protein, carbs, fat, fiber } = info.macros;
  const sugar = info.macros.sugar ?? 0;
  const sodium = info.macros.sodium ?? 0;
  const total = protein + carbs + fat + fiber + sugar || 1;

  const macros = [
    { key: 'protein', label: 'Protein', value: protein, color: MACRO_COLORS.protein },
    { key: 'carbs', label: 'Carbs', value: carbs, color: MACRO_COLORS.carbs },
    { key: 'fat', label: 'Fat', value: fat, color: MACRO_COLORS.fat },
    { key: 'fiber', label: 'Fiber', value: fiber, color: MACRO_COLORS.fiber },
    { key: 'sugar', label: 'Sugar', value: sugar, color: MACRO_COLORS.sugar },
  ] as const;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Nutrition Analysis</Text>
          <Text style={styles.foodName}>{info.foodName}</Text>
        </View>
        <View
          style={[
            styles.scoreBadge,
            { backgroundColor: healthScoreColor(info.healthScore) },
          ]}
        >
          <Text style={styles.scoreText}>{info.healthScore}/10</Text>
        </View>
      </View>

      <Text style={styles.calories}>{info.calories} kcal</Text>

      <View style={styles.macroStack}>
        {macros.map((macro) => (
          <View key={macro.key} style={styles.macroRow}>
            <View style={styles.macroLabelRow}>
              <View style={[styles.dot, { backgroundColor: macro.color }]} />
              <Text style={styles.macroLabel}>{macro.label}</Text>
              <Text style={styles.macroValue}>{macro.value}g</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: macro.color,
                    width: `${Math.min(100, (macro.value / total) * 100)}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.sodiumRow}>
        <View style={[styles.dot, { backgroundColor: MACRO_COLORS.sodium }]} />
        <Text style={styles.macroLabel}>Sodium</Text>
        <Text style={styles.macroValue}>{sodium}mg</Text>
      </View>

      {info.description ? (
        <Text style={styles.description}>{info.description}</Text>
      ) : null}

      {info.nutritionTips.length > 0 ? (
        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Tips</Text>
          {info.nutritionTips.map((tip, index) => (
            <Text key={`${index}-${tip.slice(0, 24)}`} style={styles.tip}>
              • {tip}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  foodName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  scoreBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scoreText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '700',
  },
  calories: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 18,
  },
  macroStack: {
    gap: 12,
    marginBottom: 16,
  },
  macroRow: {
    gap: 6,
  },
  sodiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  macroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  macroValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 14,
  },
  tips: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 14,
  },
  tipsTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  tip: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
});
