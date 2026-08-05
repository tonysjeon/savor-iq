import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { OptionChips } from '@/components/OptionChips';
import { RecipeCard } from '@/components/RecipeCard';
import { colors } from '@/constants/theme';
import { generateRecipe, isGeminiConfigured } from '@/lib/gemini';
import {
  loadRecentRecipes,
  prependRecentRecipe,
  saveRecentRecipes,
} from '@/lib/recentRecipes';
import {
  DIET_OPTIONS,
  PREPARATION_METHODS,
  SERVING_OPTIONS,
  type DietOption,
  type PreparationMethod,
  type Recipe,
} from '@/types/recipe';

export default function RecipesScreen() {
  const [ingredients, setIngredients] = useState('');
  const [diet, setDiet] = useState<DietOption>('None');
  const [method, setMethod] = useState<PreparationMethod>('Any Method');
  const [servings, setServings] = useState<(typeof SERVING_OPTIONS)[number]>(2);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [recentRecipes, setRecentRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    let active = true;
    loadRecentRecipes().then((recipes) => {
      if (active) setRecentRecipes(recipes);
    });
    return () => {
      active = false;
    };
  }, []);

  async function onGenerate() {
    const trimmed = ingredients.trim();
    if (!trimmed) {
      setError('Enter some ingredients first (comma-separated works well).');
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      const recipe = await generateRecipe(trimmed, diet, method, servings);
      setCurrentRecipe(recipe);
      const next = prependRecentRecipe(recentRecipes, recipe);
      setRecentRecipes(next);
      await saveRecentRecipes(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate recipe.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>What&apos;s in your kitchen?</Text>
        <Text style={styles.subheading}>
          List ingredients and Gemini will draft a recipe with steps and nutrition.
        </Text>

        {!isGeminiConfigured ? (
          <Text style={styles.notice}>
            Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file, then restart Expo.
          </Text>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="e.g. chicken, garlic, lemon, rice"
          placeholderTextColor={colors.textMuted}
          value={ingredients}
          onChangeText={setIngredients}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.prefs}>
          <Text style={styles.prefsTitle}>Preferences</Text>
          <OptionChips
            label="Diet"
            options={DIET_OPTIONS}
            value={diet}
            onChange={setDiet}
          />
          <OptionChips
            label="Method"
            options={PREPARATION_METHODS}
            value={method}
            onChange={setMethod}
          />
          <OptionChips
            label="Servings"
            options={SERVING_OPTIONS}
            value={servings}
            onChange={setServings}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[
            styles.button,
            (!isGeminiConfigured || generating) && styles.buttonDisabled,
          ]}
          disabled={!isGeminiConfigured || generating}
          onPress={onGenerate}
        >
          {generating ? (
            <View style={styles.buttonRow}>
              <ActivityIndicator color={colors.buttonPrimaryText} />
              <Text style={styles.buttonText}>Generating recipe…</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Generate Recipe</Text>
          )}
        </Pressable>

        {currentRecipe ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Generated Recipe</Text>
            <RecipeCard recipe={currentRecipe} />
          </View>
        ) : null}

        {recentRecipes.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent</Text>
            {recentRecipes.map((recipe, index) => (
              <Pressable
                key={`${recipe.title}-${index}`}
                style={styles.recentItem}
                onPress={() => setCurrentRecipe(recipe)}
              >
                <Text style={styles.recentTitle} numberOfLines={1}>
                  {recipe.title}
                </Text>
                <Text style={styles.recentMeta} numberOfLines={1}>
                  {recipe.preparationMethod} · Serves {recipe.servings}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subheading: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 20,
  },
  notice: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    fontSize: 16,
    minHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  prefs: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  prefsTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  error: {
    color: '#FF6B6B',
    marginBottom: 12,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.buttonPrimaryBg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonText: {
    color: colors.buttonPrimaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  recentItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  recentTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  recentMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
