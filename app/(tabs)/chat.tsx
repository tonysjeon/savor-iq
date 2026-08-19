import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MealSuggestionCard } from '@/components/MealSuggestionCard';
import { PageHeader } from '@/components/PageHeader';
import { RecipeCard } from '@/components/RecipeCard';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { colors } from '@/constants/theme';
import {
  listNutritionAnalyses,
  saveRecipe,
  type SavedNutrition,
} from '@/lib/firestore';
import {
  generateMealSuggestions,
  generateRecipe,
  isGeminiConfigured,
} from '@/lib/gemini';
import {
  buildMealSuggestionContext,
  mealSlotFromDate,
  mealSlotMessageKey,
} from '@/lib/mealSuggestion';
import {
  dedupeAnalyses,
  getHistoryCacheSync,
  loadHistoryCache,
  subscribeHistoryCache,
} from '@/lib/userHistoryCache';
import type { MessageKey } from '@/lib/i18n';
import type { MealSlot, MealSuggestion } from '@/types/mealSuggestion';
import {
  CUISINE_OPTIONS,
  DIET_OPTIONS,
  type Recipe,
} from '@/types/recipe';

const YES_RECIPE_OPTION = 'Yes, a full recipe';
const NO_RECIPE_OPTION = 'No thanks';
const RECIPE_FOLLOW_UP = [YES_RECIPE_OPTION, NO_RECIPE_OPTION] as const;
const GOAL_KEYS = {
  lose: 'goal.lose',
  maintain: 'goal.maintain',
  gain: 'goal.gain',
} as const satisfies Record<string, MessageKey>;
const CHAT_GUTTER = 20;
const TAB_BAR_HEIGHT = 78;
const USER_BUBBLE_BG = '#E6E6E6';
const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner'];

type TextMessage = {
  id: string;
  role: 'assistant' | 'user';
  kind: 'text';
  text: string;
  options?: readonly string[];
  answered?: boolean;
};

type SuggestionMessage = {
  id: string;
  role: 'assistant';
  kind: 'suggestion';
  suggestion: MealSuggestion;
  caloriesLeftAfter: number;
  selectable?: boolean;
  selected?: boolean;
};

type RecipeMessage = {
  id: string;
  role: 'assistant';
  kind: 'recipe';
  recipe: Recipe;
};

type ChatMessage = TextMessage | SuggestionMessage | RecipeMessage;

type PendingPrompt =
  | { type: 'suggestion-diet' }
  | { type: 'suggestion-cuisine' }
  | { type: 'pick-suggestion' }
  | { type: 'want-recipe' }
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
  return [assistantText(greeting, DIET_OPTIONS)];
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
      index = Math.min(text.length, index + 2);
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

function FadeInBlock({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
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
  }, [opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function MealSlotPicker({
  value,
  onChange,
  labelFor,
}: {
  value: MealSlot;
  onChange: (slot: MealSlot) => void;
  labelFor: (slot: MealSlot) => string;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 20, y: 80, width: 120, height: 32 });
  const pillRef = useRef<View>(null);

  function openMenu() {
    pillRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }

  return (
    <>
      <Pressable
        ref={pillRef}
        style={[styles.contextPill, styles.contextPillPrimary]}
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel={labelFor(value)}
      >
        <Ionicons
          name="time-outline"
          size={14}
          color={colors.buttonPrimaryText}
        />
        <Text
          style={[styles.contextText, styles.contextTextPrimary]}
          numberOfLines={1}
        >
          {labelFor(value)}
        </Text>
        <Ionicons
          name="chevron-down"
          size={12}
          color={colors.buttonPrimaryText}
        />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.slotMenuRoot}>
          <Pressable style={styles.slotMenuBackdrop} onPress={() => setOpen(false)} />
          <View
            style={[
              styles.slotMenu,
              { top: anchor.y + anchor.height + 6, left: anchor.x },
            ]}
          >
            {MEAL_SLOTS.map((slot) => {
              const selected = slot === value;
              return (
                <Pressable
                  key={slot}
                  style={[
                    styles.slotMenuItem,
                    selected && styles.slotMenuItemSelected,
                  ]}
                  onPress={() => {
                    setOpen(false);
                    if (!selected) onChange(slot);
                  }}
                >
                  <Text
                    style={[
                      styles.slotMenuItemText,
                      selected && styles.slotMenuItemTextSelected,
                    ]}
                  >
                    {labelFor(slot)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

function FadeChip({
  delay,
  children,
}: {
  delay: number;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 340,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 340,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function ThinkingPulse() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 820,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 820,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.thinkingPulseWrap}>
      <Animated.View
        style={[
          styles.thinkingPulseDot,
          {
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.62, 1],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

function thinkingBase(text: string) {
  return text.replace(/[.…]+$/u, '').trimEnd();
}

function ThinkingStatus({ label }: { label: string }) {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    setDotCount(0);
    const timer = setInterval(() => {
      setDotCount((count) => (count + 1) % 4);
    }, 280);
    return () => clearInterval(timer);
  }, [label]);

  return (
    <View style={styles.bubbleRow}>
      <View style={[styles.bubble, styles.assistantBubble, styles.typing]}>
        <ThinkingPulse />
        <Text style={styles.typingText}>
          {thinkingBase(label)}
          {'.'.repeat(dotCount)}
          <Text style={styles.typingDotsSpacer}>{'.'.repeat(3 - dotCount)}</Text>
        </Text>
      </View>
    </View>
  );
}

function DietFilterList({
  options,
  onSelect,
  labelFor,
}: {
  options: readonly string[];
  onSelect: (option: string) => void;
  labelFor: (option: string) => string;
}) {
  return (
    <View style={styles.dietList}>
      {options.map((option, index) => (
        <FadeChip key={option} delay={index * 28}>
          <Pressable
            style={styles.dietChip}
            onPress={() => onSelect(option)}
          >
            <Text style={styles.optionChipText}>{labelFor(option)}</Text>
          </Pressable>
        </FadeChip>
      ))}
    </View>
  );
}

function OptionsCarousel({
  options,
  onSelect,
  labelFor,
  primaryOption,
}: {
  options: readonly string[];
  onSelect: (option: string) => void;
  labelFor: (option: string) => string;
  primaryOption?: string;
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
        {options.map((option) => {
          const isPrimary = option === primaryOption;
          return (
            <Pressable
              key={option}
              style={[styles.optionChip, isPrimary && styles.optionChipPrimary]}
              onPress={() => onSelect(option)}
            >
              {isPrimary ? (
                <Ionicons
                  name={
                    option === YES_RECIPE_OPTION ? 'book-outline' : 'restaurant'
                  }
                  size={15}
                  color={colors.buttonPrimaryText}
                />
              ) : null}
              <Text
                style={[
                  styles.optionChipText,
                  isPrimary && styles.optionChipTextPrimary,
                ]}
              >
                {labelFor(option)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

export default function ChatScreen() {
  const { user, profile } = useAuth();
  const { t, to, language, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const stickToBottomRef = useRef(false);
  const scrollYRef = useRef(0);

  function scrollChatToBottom(animated = true) {
    scrollRef.current?.scrollToEnd({ animated });
  }

  function nudgeScrollDown(distance = 88) {
    scrollRef.current?.scrollTo({
      y: scrollYRef.current + distance,
      animated: true,
    });
  }

  const [analyses, setAnalyses] = useState<SavedNutrition[]>([]);
  const [pending, setPending] = useState<PendingPrompt>({
    type: 'suggestion-diet',
  });
  const [suggestionDiet, setSuggestionDiet] = useState('None');
  const [suggestionCuisine, setSuggestionCuisine] = useState('Any');
  const [suggestedTitles, setSuggestedTitles] = useState<string[]>([]);
  const [pickedSuggestion, setPickedSuggestion] =
    useState<MealSuggestion | null>(null);
  const [confirmingTitle, setConfirmingTitle] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamReadyIds, setStreamReadyIds] = useState<Record<string, true>>(
    {},
  );
  const [mealSlot, setMealSlot] = useState<MealSlot>(() => mealSlotFromDate());

  function greetingForSlot(slot: MealSlot) {
    const meal = t(mealSlotMessageKey(slot)).toLocaleLowerCase(locale);
    return t('chat.greeting', { meal });
  }

  const dayContext = useMemo(
    () =>
      buildMealSuggestionContext({
        profile,
        analyses,
        dietFilter: suggestionDiet,
        cuisineFilter: suggestionCuisine,
        mealSlot,
      }),
    [profile, analyses, suggestionDiet, suggestionCuisine, mealSlot],
  );

  const queuedSuggestionsRef = useRef<{
    afterId: string;
    messages: SuggestionMessage[];
  } | null>(null);
  const queuedRecipeFollowUpRef = useRef<{
    afterId: string;
    messages: ChatMessage[];
  } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    openingMessages(greetingForSlot(mealSlotFromDate())),
  );

  function markStreamReady(id: string) {
    setStreamReadyIds((current) =>
      current[id] ? current : { ...current, [id]: true },
    );
    const queued = queuedSuggestionsRef.current;
    if (queued && queued.afterId === id) {
      queuedSuggestionsRef.current = null;
      setMessages((current) => [...current, ...queued.messages]);
      setPending({ type: 'pick-suggestion' });
      return;
    }
    const recipeFollowUp = queuedRecipeFollowUpRef.current;
    if (recipeFollowUp && recipeFollowUp.afterId === id) {
      queuedRecipeFollowUpRef.current = null;
      setMessages((current) => [...current, ...recipeFollowUp.messages]);
      requestAnimationFrame(() => nudgeScrollDown(360));
      setTimeout(() => nudgeScrollDown(360), 80);
      setTimeout(() => nudgeScrollDown(360), 220);
    }
  }

  const applyCache = useCallback((uid: string) => {
    const cached = getHistoryCacheSync(uid);
    if (cached) setAnalyses(dedupeAnalyses(cached.analyses));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setAnalyses([]);
        return;
      }
      const uid = user.uid;
      let active = true;

      async function load() {
        applyCache(uid);
        const disk = await loadHistoryCache(uid);
        if (active && disk) setAnalyses(dedupeAnalyses(disk.analyses));
        try {
          const next = await listNutritionAnalyses(uid, 100);
          if (active) setAnalyses(dedupeAnalyses(next));
        } catch {
          // Keep whatever the cache provided.
        }
      }

      void load();
      return () => {
        active = false;
      };
    }, [user, applyCache]),
  );

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    return subscribeHistoryCache((changedUid) => {
      if (changedUid === uid) applyCache(uid);
    });
  }, [user, applyCache]);

async function buildSuggestions(nextDiet: string, nextCuisine: string) {
    setGenerating(true);
    setPending({ type: 'none' });
    setError(null);
    setPickedSuggestion(null);
    setConfirmingTitle(null);

    const context = buildMealSuggestionContext({
      profile,
      analyses,
      dietFilter: nextDiet,
      cuisineFilter: nextCuisine,
      mealSlot,
    });
    const mealLabel = t(mealSlotMessageKey(context.mealSlot)).toLocaleLowerCase(
      locale,
    );
    const isFirstSuggestion = suggestedTitles.length === 0;

    setMessages((current) => markPromptAnswered(current));

    try {
      const meals = await generateMealSuggestions(context, suggestedTitles);
      setSuggestedTitles((current) => [
        ...current,
        ...meals.map((meal) => meal.title),
      ]);
      const intro = assistantText(t('chat.heresPicks', { meal: mealLabel }));
      queuedSuggestionsRef.current = {
        afterId: intro.id,
        messages: meals.map((suggestion) => ({
          id: nextId('suggestion'),
          role: 'assistant' as const,
          kind: 'suggestion' as const,
          suggestion,
          caloriesLeftAfter: context.remaining.calories - suggestion.calories,
          selectable: true,
          selected: false,
        })),
      };
      setMessages((current) => [
        ...current,
        ...(isFirstSuggestion && !profile?.recommendation
          ? [assistantText(t('chat.usingDefaultTargets'))]
          : []),
        intro,
      ]);
      setGenerating(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('chat.unableSuggestion');
      setError(message);
      setMessages((current) => [
        ...current,
        assistantText(t('chat.couldntSuggest', { error: message })),
        assistantText(t('chat.tapRestart')),
      ]);
    } finally {
      setGenerating(false);
    }
  }

  function onPickSuggestion(suggestion: MealSuggestion) {
    if (generating || pending.type !== 'pick-suggestion') return;

    setConfirmingTitle(null);
    setPickedSuggestion(suggestion);
    setMessages((current) => [
      ...current.map((message) =>
        message.kind === 'suggestion' && message.selectable
          ? {
              ...message,
              selectable: false,
              selected: message.suggestion.title === suggestion.title,
            }
          : message,
      ),
      userText(suggestion.title),
      assistantText(t('chat.wantRecipe'), RECIPE_FOLLOW_UP),
    ]);
    setPending({ type: 'want-recipe' });
    stickToBottomRef.current = true;
    requestAnimationFrame(() => scrollChatToBottom(true));
    setTimeout(() => scrollChatToBottom(true), 50);
    setTimeout(() => scrollChatToBottom(true), 200);
  }

  async function buildRecipeForPick(suggestion: MealSuggestion) {
    setGenerating(true);
    setPending({ type: 'none' });
    setError(null);
    setMessages((current) => markPromptAnswered(current));

    const context = buildMealSuggestionContext({
      profile,
      analyses,
      dietFilter: suggestionDiet,
      cuisineFilter: suggestionCuisine,
      mealSlot,
    });

    try {
      const recipe = await generateRecipe(
        suggestion.title,
        suggestionDiet,
        'Any Method',
        1,
        context,
      );
      const intro = assistantText(t('chat.heresRecipe'));
      queuedRecipeFollowUpRef.current = {
        afterId: intro.id,
        messages: [
          {
            id: nextId('recipe'),
            role: 'assistant' as const,
            kind: 'recipe' as const,
            recipe,
          },
          assistantText(t('chat.tapRestartElse')),
        ],
      };
      setMessages((current) => [...current, intro]);
      setGenerating(false);

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

  function sendDiet(value: string) {
    if (generating || pending.type !== 'suggestion-diet') return;
    const selected = value.trim() || 'None';
    setSuggestionDiet(selected);
    const known = (DIET_OPTIONS as readonly string[]).includes(selected);
    setMessages((current) => [
      ...markPromptAnswered(current),
      userText(known ? to(selected) : selected),
      assistantText(t('chat.askCuisine'), CUISINE_OPTIONS),
    ]);
    setPending({ type: 'suggestion-cuisine' });
  }

  function sendCuisine(value: string) {
    if (generating || pending.type !== 'suggestion-cuisine') return;
    const selected = value.trim() || 'Any';
    setSuggestionCuisine(selected);
    const known = (CUISINE_OPTIONS as readonly string[]).includes(selected);
    setMessages((current) => [
      ...markPromptAnswered(current),
      userText(known ? to(selected) : selected),
    ]);
    void buildSuggestions(suggestionDiet, selected);
  }

  function onSelectOption(option: string) {
    if (generating || pending.type === 'none') return;

    if (pending.type === 'suggestion-diet') {
      sendDiet(option);
      return;
    }

    if (pending.type === 'suggestion-cuisine') {
      sendCuisine(option);
      return;
    }

    if (pending.type === 'want-recipe') {
      stickToBottomRef.current = false;
      if (option === YES_RECIPE_OPTION && pickedSuggestion) {
        setMessages((current) => [
          ...markPromptAnswered(current),
          userText(to(option)),
        ]);
        void buildRecipeForPick(pickedSuggestion);
        requestAnimationFrame(() => nudgeScrollDown());
        setTimeout(() => nudgeScrollDown(), 80);
        return;
      }

      setMessages((current) => [
        ...markPromptAnswered(current),
        userText(to(option)),
        assistantText(t('chat.noRecipeReply')),
      ]);
      setPending({ type: 'none' });
      requestAnimationFrame(() => nudgeScrollDown());
      setTimeout(() => nudgeScrollDown(), 80);
    }
  }

  function resetChat(slot: MealSlot = mealSlot) {
    messageSeq = 0;
    setMealSlot(slot);
    setMessages(openingMessages(greetingForSlot(slot)));
    setPending({ type: 'suggestion-diet' });
    setSuggestionDiet('None');
    setSuggestionCuisine('Any');
    setSuggestedTitles([]);
    setPickedSuggestion(null);
    setConfirmingTitle(null);
    setGenerating(false);
    setError(null);
    setStreamReadyIds({});
    queuedSuggestionsRef.current = null;
    queuedRecipeFollowUpRef.current = null;
    stickToBottomRef.current = false;
  }

  function onRestart() {
    resetChat();
  }

  function onChangeMealSlot(slot: MealSlot) {
    resetChat(slot);
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

  const thinkingLabel =
    pending.type === 'none' && pickedSuggestion
      ? t('chat.cooking')
      : t('chat.thinking');

  const tabClearance = TAB_BAR_HEIGHT + Math.max(insets.bottom, 12);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={[
        styles.pageContent,
        {
          paddingTop: insets.top + 8,
          paddingBottom: tabClearance + 16,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={(event) => {
        scrollYRef.current = event.nativeEvent.contentOffset.y;
      }}
      onContentSizeChange={() => {
        if (stickToBottomRef.current) {
          scrollChatToBottom(true);
        }
      }}
    >
      <PageHeader
        title={t('chat.title')}
        trailing={
          <Pressable
            style={[styles.newChatButton, generating && styles.buttonDisabled]}
            disabled={generating}
            onPress={onRestart}
            accessibilityRole="button"
            accessibilityLabel={t('chat.newChat')}
          >
            <Ionicons name="add" size={18} color={colors.text} />
            <Text style={styles.newChatButtonText}>{t('chat.newChat')}</Text>
          </Pressable>
        }
      />

      <View style={styles.contextRow}>
        <MealSlotPicker
          value={mealSlot}
          onChange={onChangeMealSlot}
          labelFor={(slot) => t(mealSlotMessageKey(slot))}
        />
        <View style={[styles.contextPill, styles.contextPillEnd]}>
          <Ionicons name="flame" size={14} color={colors.text} />
          <Text style={styles.contextText} numberOfLines={1}>
            {t('suggestion.caloriesLeft', {
              calories: dayContext.remaining.calories,
            })}
          </Text>
        </View>
        <View style={[styles.contextPill, styles.contextPillEnd]}>
          <Ionicons name="trending-up-outline" size={14} color={colors.text} />
          <Text style={styles.contextText} numberOfLines={1}>
            {t(GOAL_KEYS[dayContext.goal])}
          </Text>
        </View>
      </View>

      {!isGeminiConfigured ? (
        <Text style={styles.notice}>{t('chat.geminiMissing')}</Text>
      ) : null}

      <View style={styles.chatContent}>
        {messages.map((message) => {
          if (message.kind === 'suggestion') {
            const canPick = pending.type === 'pick-suggestion';
            return (
              <FadeInBlock key={message.id} style={styles.assistantBlock}>
                <MealSuggestionCard
                  suggestion={message.suggestion}
                  caloriesLeftAfter={message.caloriesLeftAfter}
                  selectable={canPick && !!message.selectable}
                  selected={!!message.selected}
                  confirming={
                    canPick && confirmingTitle === message.suggestion.title
                  }
                  dimmed={
                    (!canPick &&
                      !message.selected &&
                      message.selectable === false) ||
                    (canPick &&
                      confirmingTitle != null &&
                      confirmingTitle !== message.suggestion.title)
                  }
                  onSelect={() => setConfirmingTitle(message.suggestion.title)}
                  onConfirm={() => onPickSuggestion(message.suggestion)}
                  onCancel={() => setConfirmingTitle(null)}
                />
              </FadeInBlock>
            );
          }

          if (message.kind === 'recipe') {
            return (
              <FadeInBlock key={message.id} style={styles.assistantBlock}>
                <RecipeCard
                  recipe={message.recipe}
                  dietFilter={suggestionDiet}
                  cuisineFilter={suggestionCuisine}
                  macros={pickedSuggestion}
                />
              </FadeInBlock>
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
                pending.type === 'suggestion-diet' ||
                pending.type === 'suggestion-cuisine' ? (
                  <DietFilterList
                    key={message.id}
                    options={message.options!}
                    onSelect={onSelectOption}
                    labelFor={to}
                  />
                ) : (
                  <OptionsCarousel
                    options={message.options!}
                    onSelect={onSelectOption}
                    labelFor={to}
                    primaryOption={
                      pending.type === 'want-recipe'
                        ? YES_RECIPE_OPTION
                        : undefined
                    }
                  />
                )
              ) : null}
            </View>
          );
        })}

        {generating ? <ThinkingStatus label={thinkingLabel} /> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.page,
  },
  pageContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
    backgroundColor: colors.page,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    gap: 2,
    backgroundColor: USER_BUBBLE_BG,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 8,
  },
  newChatButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '400',
  },
  contextRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    marginBottom: 10,
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 5,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  contextPillEnd: {
    paddingRight: 23,
  },
  contextPillPrimary: {
    backgroundColor: colors.buttonPrimaryBg,
    flexShrink: 0,
  },
  contextText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '400',
  },
  contextTextPrimary: {
    color: colors.buttonPrimaryText,
  },
  slotMenuRoot: {
    flex: 1,
  },
  slotMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  slotMenu: {
    position: 'absolute',
    minWidth: 148,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  slotMenuItem: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  slotMenuItemSelected: {
    backgroundColor: colors.buttonPrimaryBg,
  },
  slotMenuItemText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '400',
  },
  slotMenuItemTextSelected: {
    color: colors.buttonPrimaryText,
  },
  notice: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    lineHeight: 20,
  },
  chatContent: {
    paddingTop: 6,
    gap: 16,
  },
  messageBlock: {
    gap: 10,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 8,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '84%',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  assistantBubble: {
    backgroundColor: 'transparent',
    paddingHorizontal: 2,
    paddingVertical: 2,
    maxWidth: '100%',
    borderRadius: 0,
  },
  userBubble: {
    backgroundColor: USER_BUBBLE_BG,
    borderBottomRightRadius: 8,
  },
  bubbleText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  userBubbleText: {
    color: colors.text,
    fontWeight: '400',
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thinkingPulseWrap: {
    width: 10,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  thinkingPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.text,
  },
  typingText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  typingDotsSpacer: {
    opacity: 0,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  optionChipPrimary: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  optionChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '400',
  },
  optionChipTextPrimary: {
    color: colors.buttonPrimaryText,
    fontWeight: '400',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  error: {
    color: '#FF6B6B',
    paddingBottom: 8,
    lineHeight: 20,
  },
  dietList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dietChip: {
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
});
