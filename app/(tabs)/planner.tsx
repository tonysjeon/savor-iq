import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MealPlanCard } from '@/components/MealPlanCard';
import { OptionChips } from '@/components/OptionChips';
import { colors } from '@/constants/theme';
import { generateMealPlan, isGeminiConfigured } from '@/lib/gemini';
import {
  PLANNER_QUESTIONS,
  type MealPlan,
  type PlannerQuestion,
} from '@/types/mealPlan';
import { DIET_OPTIONS, type DietOption } from '@/types/recipe';

export default function PlannerScreen() {
  const [diet, setDiet] = useState<DietOption>('None');
  const [questions, setQuestions] = useState<PlannerQuestion[]>(
    PLANNER_QUESTIONS.map((q) => ({ ...q, options: [...q.options] })),
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);

  function setAnswer(index: number, answer: string) {
    setQuestions((current) =>
      current.map((question, i) =>
        i === index ? { ...question, answer } : question,
      ),
    );
  }

  async function onGenerate() {
    setError(null);
    setGenerating(true);

    try {
      const preferences = questions
        .map((q) => `${q.question}: ${q.answer}`)
        .join('\n');
      const plan = await generateMealPlan(preferences, diet);
      setMealPlan(plan);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to generate meal plan.',
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Plan your week</Text>
      <Text style={styles.subheading}>
        Answer a short preference quiz and Gemini will draft a 7-day meal plan.
      </Text>

      {!isGeminiConfigured ? (
        <Text style={styles.notice}>
          Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file, then restart Expo.
        </Text>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Diet filter</Text>
        <OptionChips
          label="Diet"
          options={DIET_OPTIONS}
          value={diet}
          onChange={setDiet}
        />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        {questions.map((question, index) => (
          <OptionChips
            key={question.question}
            label={`${index + 1}. ${question.question}`}
            options={question.options}
            value={question.answer}
            onChange={(answer) => setAnswer(index, answer)}
          />
        ))}
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
            <Text style={styles.buttonText}>Generating plan…</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>Generate Meal Plan</Text>
        )}
      </Pressable>

      {mealPlan ? (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>7-Day Meal Plan</Text>
          <MealPlanCard plan={mealPlan} />
        </View>
      ) : null}
    </ScrollView>
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
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
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
  results: {
    marginTop: 28,
  },
  resultsTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
});
