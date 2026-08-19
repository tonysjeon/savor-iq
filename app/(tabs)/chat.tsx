import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MealPlanCard } from '@/components/MealPlanCard';
import { RecipeCard } from '@/components/RecipeCard';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { colors } from '@/constants/theme';
import { saveRecipe } from '@/lib/firestore';
import { generateMealPlan, generateRecipe, isGeminiConfigured } from '@/lib/gemini';
import { exportMealPlanPdf } from '@/lib/mealPlanPdf';
import {
  PLANNER_QUESTIONS,
  type MealPlan,
} from '@/types/mealPlan';
import type { MessageKey } from '@/lib/i18n';
import {
  DIET_OPTIONS,
  INGREDIENT_PRESETS,
  PREPARATION_METHODS,
  SERVING_OPTIONS,
  type DietOption,
  type PreparationMethod,
  type Recipe,
  type ServingOption,
} from '@/types/recipe';

const MODE_OPTIONS = ['Meal plan', 'Recipe'] as const;
const PLANNER_KEYS = [
  'planner.skill',
  'planner.time',
  'planner.allergies',
  'planner.goal',
  'planner.people',
  'planner.seasonal',
  'planner.prep',
  'planner.budget',
  'planner.cuisine',
  'planner.snacks',
] as const satisfies readonly MessageKey[];
const SERVING_LABELS = SERVING_OPTIONS.map(String);
const CHAT_GUTTER = 16;

type TextMessage = {
  id: string;
  role: 'assistant' | 'user';
  kind: 'text';
  text: string;
  options?: readonly string[];
  answered?: boolean;
};

type PlanMessage = {
  id: string;
  role: 'assistant';
  kind: 'plan';
  plan: MealPlan;
};

type RecipeMessage = {
  id: string;
  role: 'assistant';
  kind: 'recipe';
  recipe: Recipe;
};

type ChatMessage = TextMessage | PlanMessage | RecipeMessage;

type PendingPrompt =
  | { type: 'mode' }
  | { type: 'plan-diet' }
  | { type: 'plan-question'; index: number }
  | { type: 'recipe-diet' }
  | { type: 'recipe-method' }
  | { type: 'recipe-servings' }
  | { type: 'recipe-ingredient' }
  | { type: 'none' };

let messageSeq = 0;
function nextId(prefix: string) {
  messageSeq += 1;
  return `${prefix}-${messageSeq}`;
}

function assistantText(text: string, options?: readonly string[]): TextMessage {
  return {
    id: nextId('a'),
    role: 'assistant',
    kind: 'text',
    text,
    ...(options ? { options, answered: false } : {}),
  };
}

function userText(text: string): TextMessage {
  return { id: nextId('u'), role: 'user', kind: 'text', text };
}

function markPromptAnswered(messages: ChatMessage[]): ChatMessage[] {
  const next = [...messages];
  for (let i = next.length - 1; i >= 0; i -= 1) {
    const message = next[i];
    if (
      message.kind === 'text' &&
      message.role === 'assistant' &&
      message.options &&
      !message.answered
    ) {
      next[i] = { ...message, answered: true };
      break;
    }
  }
  return next;
}

function openingMessages(greeting: string): ChatMessage[] {
  return [
    assistantText(greeting, MODE_OPTIONS),
  ];
}

function StreamingText({
  text,
  onDone,
}: {
  text: string;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState('');
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    doneRef.current = false;
    setShown('');
    if (!text) {
      onDoneRef.current?.();
      return;
    }

    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setShown(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(timer);
        if (!doneRef.current) {
          doneRef.current = true;
          onDoneRef.current?.();
        }
      }
    }, 18);

    return () => clearInterval(timer);
  }, [text]);

  return <Text style={styles.bubbleText}>{shown}</Text>;
}

function OptionsCarousel({
  options,
  onSelect,
  labelFor,
}: {
  options: readonly string[];
  onSelect: (option: string) => void;
  labelFor: (option: string) => string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, options]);

  return (
    <Animated.View
      style={[
        styles.optionsCarouselWrap,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.optionsCarousel}
        contentContainerStyle={styles.optionsRow}
      >
        {options.map((option) => (
          <Pressable
            key={option}
            style={styles.optionChip}
            onPress={() => onSelect(option)}
          >
            <Text style={styles.optionChipText}>{labelFor(option)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

export default function ChatScreen() {
  const { user } = useAuth();
  const { t, to, language, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const startDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, offset) => {
      const day = new Date();
      day.setDate(day.getDate() + offset);
      return day.toLocaleDateString(locale, { weekday: 'long' });
    });
  }, [locale]);
  const todayName = startDays[0];

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    openingMessages(t('chat.hi')),
  );
  const [pending, setPending] = useState<PendingPrompt>({ type: 'mode' });
  const [mode, setMode] = useState<'plan' | 'recipe' | null>(null);
  const [diet, setDiet] = useState<DietOption | null>(null);
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>(
    [],
  );
  const [recipeDiet, setRecipeDiet] = useState<DietOption>('None');
  const [recipeMethod, setRecipeMethod] =
    useState<PreparationMethod>('Any Method');
  const [recipeServings, setRecipeServings] = useState<ServingOption>(2);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamReadyIds, setStreamReadyIds] = useState<Record<string, true>>(
    {},
  );

  const markStreamReady = useRef((id: string) => {
    setStreamReadyIds((current) =>
      current[id] ? current : { ...current, [id]: true },
    );
  }).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, pending, generating]);

  async function buildPlan(
    nextDiet: DietOption,
    nextAnswers: { question: string; answer: string }[],
  ) {
    setGenerating(true);
    setPending({ type: 'none' });
    setError(null);
    setMessages((current) => [
      ...markPromptAnswered(current),
      assistantText(t('chat.gotItPlan', { day: todayName })),
    ]);

    try {
      const preferences = nextAnswers
        .map((item) => `${item.question}: ${item.answer}`)
        .join('\n');
      const plan = await generateMealPlan(preferences, nextDiet, startDays);
      setMealPlan(plan);
      setMessages((current) => [
        ...current,
        assistantText(t('chat.heresWeek')),
        { id: nextId('plan'), role: 'assistant', kind: 'plan', plan },
        assistantText(t('chat.wantPdf')),
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('chat.unablePlan');
      setError(message);
      setMessages((current) => [
        ...current,
        assistantText(t('chat.couldntPlan', { error: message })),
        assistantText(t('chat.tapRestart')),
      ]);
    } finally {
      setGenerating(false);
    }
  }

  async function buildRecipe(ingredient: string) {
    setGenerating(true);
    setPending({ type: 'none' });
    setError(null);
    setMessages((current) => [
      ...markPromptAnswered(current),
      userText(ingredient),
      assistantText(t('chat.cooking')),
    ]);

    try {
      const recipe = await generateRecipe(
        ingredient,
        recipeDiet,
        recipeMethod,
        recipeServings,
      );
      setMessages((current) => [
        ...current,
        assistantText(t('chat.heresRecipe')),
        { id: nextId('recipe'), role: 'assistant', kind: 'recipe', recipe },
        assistantText(t('chat.tapRestartElse')),
      ]);

      if (user) {
        try {
          await saveRecipe(user.uid, recipe);
        } catch (cloudErr) {
          setError(
            cloudErr instanceof Error
              ? t('chat.cloudSaveFailedNamed', { error: cloudErr.message })
              : t('chat.cloudSaveFailed'),
          );
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('chat.unableRecipe');
      setError(message);
      setMessages((current) => [
        ...current,
        assistantText(t('chat.couldntRecipe', { error: message })),
        assistantText(t('chat.tapRestart')),
      ]);
    } finally {
      setGenerating(false);
    }
  }

  function onSelectOption(option: string) {
    if (generating || pending.type === 'none') return;

    if (pending.type === 'mode') {
      if (option === 'Meal plan') {
        setMode('plan');
        setMessages((current) => [
          ...markPromptAnswered(current),
          userText(to(option)),
          assistantText(
            t('chat.dietFilterPlan', { day: todayName }),
            DIET_OPTIONS,
          ),
        ]);
        setPending({ type: 'plan-diet' });
        return;
      }

      setMode('recipe');
      setMessages((current) => [
        ...markPromptAnswered(current),
        userText(to(option)),
        assistantText(t('chat.dietFilterRecipe'), DIET_OPTIONS),
      ]);
      setPending({ type: 'recipe-diet' });
      return;
    }

    if (pending.type === 'plan-diet') {
      const selected = option as DietOption;
      setDiet(selected);
      setMessages((current) => [
        ...markPromptAnswered(current),
        userText(to(option)),
        assistantText(
          t(PLANNER_KEYS[0]),
          PLANNER_QUESTIONS[0].options,
        ),
      ]);
      setPending({ type: 'plan-question', index: 0 });
      return;
    }

    if (pending.type === 'plan-question') {
      const question = PLANNER_QUESTIONS[pending.index];
      if (!question) return;

      const nextAnswers = [
        ...answers,
        { question: t(PLANNER_KEYS[pending.index]), answer: to(option) },
      ];
      setAnswers(nextAnswers);

      const nextIndex = pending.index + 1;
      if (nextIndex < PLANNER_QUESTIONS.length) {
        const nextQuestion = PLANNER_QUESTIONS[nextIndex];
        setMessages((current) => [
          ...markPromptAnswered(current),
          userText(to(option)),
          assistantText(t(PLANNER_KEYS[nextIndex]), nextQuestion.options),
        ]);
        setPending({ type: 'plan-question', index: nextIndex });
        return;
      }

      setMessages((current) => [
        ...markPromptAnswered(current),
        userText(to(option)),
      ]);
      void buildPlan(diet ?? 'None', nextAnswers);
      return;
    }

    if (pending.type === 'recipe-diet') {
      setRecipeDiet(option as DietOption);
      setMessages((current) => [
        ...markPromptAnswered(current),
        userText(to(option)),
        assistantText(t('chat.howPrepared'), PREPARATION_METHODS),
      ]);
      setPending({ type: 'recipe-method' });
      return;
    }

    if (pending.type === 'recipe-method') {
      setRecipeMethod(option as PreparationMethod);
      setMessages((current) => [
        ...markPromptAnswered(current),
        userText(to(option)),
        assistantText(t('chat.howServings'), SERVING_LABELS),
      ]);
      setPending({ type: 'recipe-servings' });
      return;
    }

    if (pending.type === 'recipe-servings') {
      const servings = Number(option) as ServingOption;
      setRecipeServings(servings);
      setMessages((current) => [
        ...markPromptAnswered(current),
        userText(to(option)),
        assistantText(t('chat.pickIngredient'), INGREDIENT_PRESETS),
      ]);
      setPending({ type: 'recipe-ingredient' });
      return;
    }

    if (pending.type === 'recipe-ingredient') {
      void buildRecipe(option);
    }
  }

  function onRestart() {
    messageSeq = 0;
    setMessages(openingMessages(t('chat.hi')));
    setPending({ type: 'mode' });
    setMode(null);
    setDiet(null);
    setAnswers([]);
    setRecipeDiet('None');
    setRecipeMethod('Any Method');
    setRecipeServings(2);
    setMealPlan(null);
    setGenerating(false);
    setExporting(false);
    setError(null);
    setStreamReadyIds({});
  }

  const didApplyLanguage = useRef(false);
  useEffect(() => {
    if (!didApplyLanguage.current) {
      didApplyLanguage.current = true;
      return;
    }
    onRestart();
    // Restart the scripted chat when the UI language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  async function onExportPdf() {
    if (!mealPlan || !diet) return;
    setError(null);
    setExporting(true);
    try {
      await exportMealPlanPdf({
        plan: mealPlan,
        diet,
        answers: [
          { question: t('chat.dietaryFilter'), answer: to(diet) },
          ...answers,
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('chat.unableExport'));
    } finally {
      setExporting(false);
    }
  }

  const typingLabel =
    mode === 'recipe' ? t('chat.draftingRecipe') : t('chat.draftingPlan');

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.toolbar}>
        {mealPlan ? (
          <Pressable
            style={[styles.headerButton, exporting && styles.buttonDisabled]}
            disabled={exporting}
            onPress={onExportPdf}
            accessibilityLabel={t('chat.exportPdf')}
          >
            {exporting ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.headerButtonText}>{t('chat.exportPdf')}</Text>
            )}
          </Pressable>
        ) : (
          <View style={styles.toolbarSpacer} />
        )}
        <Pressable
          style={[styles.plusButton, generating && styles.buttonDisabled]}
          disabled={generating}
          onPress={onRestart}
          accessibilityLabel={t('chat.newChat')}
        >
          <Ionicons name="add" size={22} color={colors.text} />
        </Pressable>
      </View>

      {!isGeminiConfigured ? (
        <Text style={styles.notice}>
          {t('chat.geminiMissing')}
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

          if (message.kind === 'recipe') {
            return (
              <View key={message.id} style={styles.assistantBlock}>
                <RecipeCard recipe={message.recipe} />
              </View>
            );
          }

          const isUser = message.role === 'user';
          const streamDone = isUser || !!streamReadyIds[message.id];
          const showOptions =
            !isUser &&
            streamDone &&
            !!message.options &&
            !message.answered &&
            isGeminiConfigured &&
            !generating;

          return (
            <View key={message.id} style={styles.messageBlock}>
              <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
                <View
                  style={[
                    styles.bubble,
                    isUser ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  {isUser ? (
                    <Text style={[styles.bubbleText, styles.userBubbleText]}>
                      {message.text}
                    </Text>
                  ) : streamDone ? (
                    <Text style={styles.bubbleText}>{message.text}</Text>
                  ) : (
                    <StreamingText
                      text={message.text}
                      onDone={() => markStreamReady(message.id)}
                    />
                  )}
                </View>
              </View>

              {showOptions ? (
                <OptionsCarousel
                  options={message.options!}
                  onSelect={onSelectOption}
                  labelFor={to}
                />
              ) : null}
            </View>
          );
        })}

        {generating ? (
          <View style={styles.bubbleRow}>
            <View style={[styles.bubble, styles.assistantBubble, styles.typing]}>
              <ActivityIndicator color={colors.text} />
              <Text style={styles.bubbleText}>{typingLabel}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toolbarSpacer: {
    flex: 1,
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
  plusButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: CHAT_GUTTER,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 14,
  },
  messageBlock: {
    gap: 8,
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
    backgroundColor: 'transparent',
    paddingHorizontal: 2,
    paddingVertical: 2,
    maxWidth: '92%',
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
  optionsCarouselWrap: {
    marginHorizontal: -CHAT_GUTTER,
  },
  optionsCarousel: {
    flexGrow: 0,
  },
  optionsRow: {
    gap: 8,
    paddingHorizontal: CHAT_GUTTER,
  },
  optionChip: {
    backgroundColor: colors.card,
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
