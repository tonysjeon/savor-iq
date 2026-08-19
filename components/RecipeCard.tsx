import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AvocadoIcon } from '@/components/AvocadoIcon';
import { colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import type { Recipe } from '@/types/recipe';

type RecipeMacros = {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
};

type RecipeCardProps = {
  recipe: Recipe;
  dietFilter?: string;
  cuisineFilter?: string;
  macros?: RecipeMacros | null;
};

function firstNumber(raw: string, label: string) {
  const match = raw.match(new RegExp(`${label}[^0-9]*~?\\s*(\\d+)`, 'i'));
  return match ? Number(match[1]) : null;
}

function macrosFromNutrition(raw: string): RecipeMacros | null {
  const calories = firstNumber(raw, 'calories');
  const proteinGrams = firstNumber(raw, 'protein');
  const carbsGrams = firstNumber(raw, 'carb');
  const fatGrams = firstNumber(raw, 'fat');
  if (
    calories == null &&
    proteinGrams == null &&
    carbsGrams == null &&
    fatGrams == null
  ) {
    return null;
  }
  return {
    calories: calories ?? 0,
    proteinGrams: proteinGrams ?? 0,
    carbsGrams: carbsGrams ?? 0,
    fatGrams: fatGrams ?? 0,
  };
}

export function RecipeCard({
  recipe,
  dietFilter,
  cuisineFilter,
  macros,
}: RecipeCardProps) {
  const { t, to } = useLanguage();
  const dietChip =
    dietFilter && dietFilter !== 'None' ? to(dietFilter) : null;
  const cuisineChip = cuisineFilter ? to(cuisineFilter) : null;
  const nutrition = macros ?? macrosFromNutrition(recipe.nutrition);

  return (
    <View style={styles.card}>
      {recipe.imageUrl ? (
        <Image
          source={{ uri: recipe.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Ionicons name="restaurant-outline" size={40} color={colors.textMuted} />
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.title}>{recipe.title}</Text>

        {dietChip || cuisineChip ? (
          <View style={styles.metaRow}>
            {dietChip ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaText}>{dietChip}</Text>
              </View>
            ) : null}
            {cuisineChip ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaText}>{cuisineChip}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>{t('recipe.ingredients')}</Text>
        {recipe.ingredients.map((ingredient, index) => (
          <Text key={`${index}-${ingredient}`} style={styles.listItem}>
            • {ingredient}
          </Text>
        ))}

        <Text style={styles.sectionLabel}>{t('recipe.instructions')}</Text>
        {recipe.steps.map((step, index) => (
          <View key={`${index}-${step.slice(0, 24)}`} style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}

        {nutrition ? (
          <>
            <Text style={styles.sectionLabel}>{t('recipe.nutrition')}</Text>
            <View style={styles.macroRow}>
              <View style={styles.macro}>
                <Ionicons name="flame" size={14} color={colors.text} />
                <Text style={styles.macroValue}>{nutrition.calories}</Text>
                <Text style={styles.macroLabel}>{t('suggestion.calories')}</Text>
              </View>
              <View style={styles.macro}>
                <MaterialCommunityIcons
                  name="food-drumstick"
                  size={14}
                  color="#E57373"
                />
                <Text style={styles.macroValue}>{nutrition.proteinGrams}g</Text>
                <Text style={styles.macroLabel}>{t('home.protein')}</Text>
              </View>
              <View style={styles.macro}>
                <MaterialCommunityIcons name="barley" size={14} color="#FFA726" />
                <Text style={styles.macroValue}>{nutrition.carbsGrams}g</Text>
                <Text style={styles.macroLabel}>{t('home.carbs')}</Text>
              </View>
              <View style={styles.macro}>
                <AvocadoIcon size={14} color="#66BB6A" />
                <Text style={styles.macroValue}>{nutrition.fatGrams}g</Text>
                <Text style={styles.macroLabel}>{t('home.fat')}</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>{t('recipe.nutrition')}</Text>
            <Text style={styles.nutritionFallback}>{recipe.nutrition}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surface,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 16,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  listItem: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.buttonPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: colors.buttonPrimaryText,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 13,
    includeFontPadding: false,
    textAlign: 'center',
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.page,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  macro: {
    flexGrow: 1,
    flexBasis: 0,
    maxWidth: 70,
    alignItems: 'center',
    gap: 1,
  },
  macroValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  macroLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },
  nutritionFallback: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
});
