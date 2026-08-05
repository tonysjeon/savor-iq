import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MealPlanCard } from '@/components/MealPlanCard';
import { colors } from '@/constants/theme';
import { generateMealPlan, isGeminiConfigured } from '@/lib/gemini';
import { exportMealPlanPdf } from '@/lib/mealPlanPdf';
import {
  PLANNER_QUESTIONS,
  weekdaysStartingFrom,
  type MealPlan,
} from '@/types/mealPlan';
import { DIET_OPTIONS, type DietOption } from '@/types/recipe';

type TextMessage = {
  id: string;
  role: 'assistant' | 'user';
  kind: 'text';
  text: string;
};

type PlanMessage = {
  id: string;
  role: 'assistant';
  kind: 'plan';
  plan: MealPlan;
};

type ChatMessage = TextMessage | PlanMessage;

type PendingPrompt =
  | { type: 'diet' }
  | { type: 'question'; index: number }
  | { type: 'none' };

let messageSeq = 0;
function nextId(prefix: string) {
  messageSeq += 1;
  return `${prefix}-${messageSeq}`;
}

function assistantText(text: string): TextMessage {
  return { id: nextId('a'), role: 'assistant', kind: 'text', text };
}

function userText(text: string): TextMessage {
  return { id: nextId('u'), role: 'user', kind: 'text', text };
}

export default function PlannerScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const startDays = weekdaysStartingFrom();
  const todayName = startDays[0];

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    assistantText(
      `Hi — I'll build a 7-day meal plan starting today (${todayName}). First, any diet filter?`,
    ),
  ]);
  const [pending, setPending] = useState<PendingPrompt>({ type: 'diet' });
  const [diet, setDiet] = useState<DietOption | null>(null);
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>(
    [],
  );
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, pending, generating]);

  const optionChoices: readonly string[] | null =
    pending.type === 'diet'
      ? DIET_OPTIONS
      : pending.type === 'question'
        ? PLANNER_QUESTIONS[pending.index]?.options ?? null
        : null;

  async function buildPlan(
    nextDiet: DietOption,
    nextAnswers: { question: string; answer: string }[],
  ) {
    setGenerating(true);
    setPending({ type: 'none' });
    setError(null);
    setMessages((current) => [
      ...current,
      assistantText(
        `Got it. Building your 7-day plan starting ${todayName}…`,
      ),
    ]);

    try {
      const preferences = nextAnswers
        .map((item) => `${item.question}: ${item.answer}`)
        .join('\n');
      const plan = await generateMealPlan(preferences, nextDiet, startDays);
      setMealPlan(plan);
      setMessages((current) => [
        ...current,
        assistantText("Here's your week:"),
        { id: nextId('plan'), role: 'assistant', kind: 'plan', plan },
        assistantText('Want a PDF? Use Export at the top, or Restart to plan again.'),
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to generate meal plan.';
      setError(message);
      setMessages((current) => [
        ...current,
        assistantText(`I couldn't finish that plan: ${message}`),
        assistantText('Tap Restart to try again.'),
      ]);
    } finally {
      setGenerating(false);
    }
  }

  function onSelectOption(option: string) {
    if (generating || pending.type === 'none') return;

    if (pending.type === 'diet') {
      const selected = option as DietOption;
      setDiet(selected);
      setMessages((current) => [
        ...current,
        userText(option),
        assistantText(PLANNER_QUESTIONS[0].question),
      ]);
      setPending({ type: 'question', index: 0 });
      return;
    }

    const question = PLANNER_QUESTIONS[pending.index];
    if (!question) return;

    const nextAnswers = [
      ...answers,
      { question: question.question, answer: option },
    ];
    setAnswers(nextAnswers);
    setMessages((current) => [...current, userText(option)]);

    const nextIndex = pending.index + 1;
    if (nextIndex < PLANNER_QUESTIONS.length) {
      setMessages((current) => [
        ...current,
        assistantText(PLANNER_QUESTIONS[nextIndex].question),
      ]);
      setPending({ type: 'question', index: nextIndex });
      return;
    }

    const selectedDiet = diet ?? 'None';
    void buildPlan(selectedDiet, nextAnswers);
  }

  function onRestart() {
    messageSeq = 0;
    setMessages([
      assistantText(
        `Hi — I'll build a 7-day meal plan starting today (${todayName}). First, any diet filter?`,
      ),
    ]);
    setPending({ type: 'diet' });
    setDiet(null);
    setAnswers([]);
    setMealPlan(null);
    setGenerating(false);
    setExporting(false);
    setError(null);
  }

  async function onExportPdf() {
    if (!mealPlan || !diet) return;
    setError(null);
    setExporting(true);
    try {
      await exportMealPlanPdf({
        plan: mealPlan,
        diet,
        answers: [
          { question: 'Dietary filter', answer: diet },
          ...answers,
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export PDF.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Meal plan chat</Text>
          <Text style={styles.subheading}>
            Starts {todayName} · tap an option to answer
          </Text>
        </View>
        <View style={styles.headerActions}>
          {mealPlan ? (
            <Pressable
              style={[styles.headerButton, exporting && styles.buttonDisabled]}
              disabled={exporting}
              onPress={onExportPdf}
            >
              {exporting ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.headerButtonText}>Export PDF</Text>
              )}
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.headerButton, generating && styles.buttonDisabled]}
            disabled={generating}
            onPress={onRestart}
          >
            <Text style={styles.headerButtonText}>Restart</Text>
          </Pressable>
        </View>
      </View>

      {!isGeminiConfigured ? (
        <Text style={styles.notice}>
          Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file, then restart Expo.
        </Text>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((message) => {
          if (message.kind === 'plan') {
            return (
              <View key={message.id} style={styles.assistantBlock}>
                <MealPlanCard plan={message.plan} />
              </View>
            );
          }

          const isUser = message.role === 'user';
          return (
            <View
              key={message.id}
              style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}
            >
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>
                  {message.text}
                </Text>
              </View>
            </View>
          );
        })}

        {generating ? (
          <View style={styles.bubbleRow}>
            <View style={[styles.bubble, styles.assistantBubble, styles.typing]}>
              <ActivityIndicator color={colors.text} />
              <Text style={styles.bubbleText}>Drafting your plan…</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {optionChoices && isGeminiConfigured ? (
        <View style={styles.optionsBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.optionsRow}
          >
            {optionChoices.map((option) => (
              <Pressable
                key={option}
                style={styles.optionChip}
                onPress={() => onSelectOption(option)}
              >
                <Text style={styles.optionChipText}>{option}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerText: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  headerButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  heading: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subheading: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  notice: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    lineHeight: 20,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 6,
  },
  userBubble: {
    backgroundColor: colors.buttonPrimaryBg,
    borderTopRightRadius: 6,
  },
  bubbleText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  userBubbleText: {
    color: colors.buttonPrimaryText,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  assistantBlock: {
    alignSelf: 'stretch',
  },
  optionsBar: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  optionsRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  optionChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  error: {
    color: '#FF6B6B',
    paddingHorizontal: 20,
    paddingBottom: 8,
    lineHeight: 20,
  },
});
