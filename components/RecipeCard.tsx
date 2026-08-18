import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import type { Recipe } from '@/types/recipe';

type RecipeCardProps = {
  recipe: Recipe;
};

export function RecipeCard({ recipe }: RecipeCardProps) {
  const { t } = useLanguage();
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

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>{recipe.preparationMethod}</Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>{t('recipe.serves', { count: recipe.servings })}</Text>
          </View>
        </View>

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

        <Text style={styles.sectionLabel}>{t('recipe.nutrition')}</Text>
        <Text style={styles.nutrition}>{recipe.nutrition}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
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
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metaChip: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  listItem: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.buttonPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText: {
    color: colors.buttonPrimaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  nutrition: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
});
