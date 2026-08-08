import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvocadoIcon } from '@/components/AvocadoIcon';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { ProgressRing } from '@/components/ProgressRing';
import { MealProcessingCard } from '@/components/MealProcessingCard';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';
import {
  listNutritionAnalyses,
  type SavedNutrition,
} from '@/lib/firestore';
import {
  listMealAnalysisJobs,
  pruneReadyJobs,
  subscribeMealAnalysisJobs,
  type MealAnalysisJob,
} from '@/lib/mealAnalysisQueue';
import {
  getHistoryCacheSync,
  loadHistoryCache,
  subscribeHistoryCache,
  dedupeAnalyses,
  analysisFingerprint,
} from '@/lib/userHistoryCache';

const WEEKDAY_LABELS = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'] as const;
const CONTENT_GUTTER = 20;
const SCREEN_WIDTH = Dimensions.get('window').width;

const DAILY_GOALS = {
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 65,
  fiber: 30,
  sugar: 50,
  sodium: 2300,
  water: 2000,
} as const;

const MACRO_META = [
  {
    key: 'protein' as const,
    label: 'Protein',
    color: '#E57373',
    icon: 'food-drumstick' as const,
  },
  {
    key: 'carbs' as const,
    label: 'Carbs',
    color: '#FFA726',
    icon: 'barley' as const,
  },
  {
    key: 'fat' as const,
    label: 'Fat',
    color: '#66BB6A',
  },
] as const;

function goalBalance(intake: number, goal: number) {
  const roundedIntake = Math.round(intake);
  const over = roundedIntake > goal;
  return {
    amount: Math.abs(goal - roundedIntake),
    label: over ? 'over' : 'left',
  } as const;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function weekDaysAround(anchor: Date): Date[] {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - 3);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

function sumForDay(analyses: SavedNutrition[], day: Date) {
  return analyses
    .filter((item) => item.createdAt != null && sameDay(new Date(item.createdAt), day))
    .reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.macros.protein,
        carbs: acc.carbs + item.macros.carbs,
        fat: acc.fat + item.macros.fat,
        fiber: acc.fiber + item.macros.fiber,
        sugar: acc.sugar + (item.macros.sugar ?? 0),
        sodium: acc.sodium + (item.macros.sodium ?? 0),
        healthScore: acc.healthScore + item.healthScore,
        count: acc.count + 1,
      }),
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        healthScore: 0,
        count: 0,
      },
    );
}

function formatMealTime(createdAt: number | null): string {
  if (createdAt == null) return '';
  return new Date(createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date(), []);
  const [selectedDay, setSelectedDay] = useState(() => today);
  const [analyses, setAnalyses] = useState<SavedNutrition[]>([]);
  const [processingJobs, setProcessingJobs] = useState<MealAnalysisJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pagerPage, setPagerPage] = useState(0);
  const [showEaten, setShowEaten] = useState(false);

  const refreshFromNetwork = useCallback(async (uid: string) => {
    setError(null);
    try {
      const next = await listNutritionAnalyses(uid, 100);
      setAnalyses(dedupeAnalyses(next));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load meal history.',
      );
    }
  }, []);

  const applyCache = useCallback((uid: string) => {
    const syncCache = getHistoryCacheSync(uid);
    if (syncCache) {
      setAnalyses(dedupeAnalyses(syncCache.analyses));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    return subscribeHistoryCache((changedUid) => {
      if (changedUid !== uid) return;
      applyCache(uid);
    });
  }, [user, applyCache]);

  useEffect(() => {
    setProcessingJobs(listMealAnalysisJobs());
    return subscribeMealAnalysisJobs(() => {
      setProcessingJobs(listMealAnalysisJobs());
    });
  }, []);

  useEffect(() => {
    const savedIds = new Set(analyses.map((item) => item.id));
    pruneReadyJobs(savedIds);
  }, [analyses]);

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
        if (!active) return;
        if (disk) {
          setAnalyses(dedupeAnalyses(disk.analyses));
        }

        await refreshFromNetwork(uid);
        if (!active) return;
        // Pick up any meal saved while the network request was in flight.
        applyCache(uid);
      }

      void load();

      const retry = setTimeout(() => {
        if (!active) return;
        applyCache(uid);
        void refreshFromNetwork(uid);
      }, 2000);

      return () => {
        active = false;
        clearTimeout(retry);
      };
    }, [user, refreshFromNetwork, applyCache]),
  );

  const days = useMemo(() => weekDaysAround(today), [today]);
  const dayTotals = useMemo(
    () => sumForDay(analyses, selectedDay),
    [analyses, selectedDay],
  );
  const recentJobCards = useMemo(
    () => processingJobs.slice(0, 10),
    [processingJobs],
  );
  const recentMeals = useMemo(() => {
    const jobResultIds = new Set(
      processingJobs
        .map((job) => job.result?.id)
        .filter((id): id is string => Boolean(id)),
    );
    const jobFingerprints = new Set(
      processingJobs
        .map((job) => (job.result ? analysisFingerprint(job.result) : null))
        .filter((fp): fp is string => Boolean(fp)),
    );

    return [...analyses]
      .filter((item) => {
        if (jobResultIds.has(item.id)) return false;
        if (jobFingerprints.has(analysisFingerprint(item))) return false;

        // Hide cloud rows that land while this job is still analyzing/saving.
        for (const job of processingJobs) {
          if (job.status !== 'processing') continue;
          if (item.createdAt == null) continue;
          if (item.createdAt >= job.createdAt - 2000) return false;
        }
        return true;
      })
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, Math.max(0, 10 - recentJobCards.length));
  }, [analyses, processingJobs, recentJobCards.length]);
  const hasRecentSection = recentJobCards.length > 0 || recentMeals.length > 0;

  const caloriesEaten = Math.round(dayTotals.calories);
  const calorieBalance = goalBalance(caloriesEaten, DAILY_GOALS.calories);
  const calorieProgress = dayTotals.calories / DAILY_GOALS.calories;
  const avgHealthScore =
    dayTotals.count > 0 ? dayTotals.healthScore / dayTotals.count : 0;
  const sugarIntake = Math.round(dayTotals.sugar);
  const sodiumIntake = Math.round(dayTotals.sodium);
  const waterIntake = 0;

  function toggleIntakeMode() {
    setShowEaten((current) => !current);
  }

  function onPagerScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    const page = Math.min(1, Math.max(0, next));
    setPagerPage((current) => (current === page ? current : page));
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Ionicons name="restaurant" size={28} color={colors.text} />
          <Text style={styles.brand}>SavorIQ</Text>
        </View>
      </View>

      <View style={styles.weekRow}>
        {days.map((day) => {
          const selected = sameDay(day, selectedDay);
          const isToday = sameDay(day, today);
          const weekday = WEEKDAY_LABELS[day.getDay()];
          return (
            <Pressable
              key={startOfDay(day)}
              style={styles.dayChip}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={[styles.dayWeekday, selected && styles.dayWeekdaySelected]}>
                {weekday}
              </Text>
              <View
                style={[
                  styles.dayCircle,
                  selected && styles.dayCircleSelected,
                  isToday && !selected && styles.dayCircleToday,
                ]}
              >
                <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>
                  {day.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

          <View style={styles.pager}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onPagerScroll}
              scrollEventThrottle={16}
              decelerationRate="fast"
              bounces={false}
              style={styles.pagerScroll}
            >
              <View
                style={[
                  styles.pagerPage,
                  {
                    width: SCREEN_WIDTH,
                    paddingHorizontal: CONTENT_GUTTER,
                  },
                ]}
              >
                  <Pressable
                    style={styles.calorieCard}
                    onPress={toggleIntakeMode}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showEaten
                        ? `Show calories ${calorieBalance.label}`
                        : 'Show calories eaten'
                    }
                  >
                    <View style={styles.calorieCopy}>
                      {showEaten ? (
                        <View style={styles.calorieValueRow}>
                          <AnimatedNumber
                            value={caloriesEaten}
                            style={styles.calorieValue}
                          />
                          <Text style={styles.calorieGoal}>
                            /{DAILY_GOALS.calories}
                          </Text>
                        </View>
                      ) : (
                        <AnimatedNumber
                          value={calorieBalance.amount}
                          style={styles.calorieValue}
                        />
                      )}
                      <View style={styles.calorieLabelRow}>
                        <Text style={styles.calorieLabel}>
                          {showEaten
                            ? 'Calories eaten'
                            : `Calories ${calorieBalance.label}`}
                        </Text>
                        <Ionicons
                          name="swap-vertical"
                          size={14}
                          color={colors.textMuted}
                        />
                      </View>
                    </View>
                    <ProgressRing
                      size={100}
                      strokeWidth={11}
                      progress={calorieProgress}
                      color={colors.text}
                      trackColor={colors.surfaceElevated}
                    >
                      <Ionicons name="flame" size={22} color={colors.text} />
                    </ProgressRing>
                  </Pressable>

                  <View style={styles.macroRow}>
                    {MACRO_META.map((macro) => {
                      const eaten = Math.round(dayTotals[macro.key]);
                      const goal = DAILY_GOALS[macro.key];
                      const balance = goalBalance(eaten, goal);
                      return (
                        <Pressable
                          key={macro.key}
                          style={styles.macroCard}
                          onPress={toggleIntakeMode}
                          accessibilityRole="button"
                          accessibilityLabel={
                            showEaten
                              ? `Show ${macro.label} ${balance.label}`
                              : `Show ${macro.label} eaten`
                          }
                        >
                          {showEaten ? (
                            <View style={styles.macroValueRow}>
                              <AnimatedNumber
                                value={eaten}
                                style={styles.macroValue}
                              />
                              <Text style={styles.macroGoal}>/{goal}g</Text>
                            </View>
                          ) : (
                            <AnimatedNumber
                              value={balance.amount}
                              suffix="g"
                              style={styles.macroValue}
                            />
                          )}
                          <Text style={styles.macroLabel}>
                            {macro.label}{' '}
                            {showEaten ? 'eaten' : balance.label}
                          </Text>
                          <ProgressRing
                            size={64}
                            strokeWidth={7}
                            progress={eaten / goal}
                            color={macro.color}
                            trackColor={colors.surfaceElevated}
                            style={styles.macroRing}
                          >
                            {macro.key === 'fat' ? (
                              <AvocadoIcon size={18} color={macro.color} />
                            ) : (
                              <MaterialCommunityIcons
                                name={macro.icon}
                                size={18}
                                color={macro.color}
                              />
                            )}
                          </ProgressRing>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View
                  style={[
                    styles.pagerPage,
                    {
                      width: SCREEN_WIDTH,
                      paddingHorizontal: CONTENT_GUTTER,
                    },
                  ]}
                >
                  <View style={styles.macroRow}>
                    <View style={styles.wideMetricCard}>
                      <View style={styles.healthScoreValueOffset}>
                        <AnimatedNumber
                          value={avgHealthScore}
                          decimals={1}
                          style={styles.wideMetricValue}
                        />
                      </View>
                      <Text style={styles.wideMetricLabel}>Health score</Text>
                      <ProgressRing
                        size={64}
                        strokeWidth={7}
                        progress={avgHealthScore / 10}
                        color="#66BB6A"
                        trackColor={colors.surfaceElevated}
                        style={styles.macroRing}
                      >
                        <MaterialCommunityIcons
                          name="heart-pulse"
                          size={18}
                          color="#66BB6A"
                        />
                      </ProgressRing>
                    </View>
                    <View style={styles.wideMetricCard}>
                      <AnimatedNumber
                        value={waterIntake}
                        suffix="ml"
                        style={styles.wideMetricValue}
                      />
                      <Text style={styles.wideMetricLabel}>Water</Text>
                      <ProgressRing
                        size={64}
                        strokeWidth={7}
                        progress={waterIntake / DAILY_GOALS.water}
                        color="#42A5F5"
                        trackColor={colors.surfaceElevated}
                        style={styles.macroRing}
                      >
                        <MaterialCommunityIcons
                          name="cup-water"
                          size={18}
                          color="#42A5F5"
                        />
                      </ProgressRing>
                    </View>
                  </View>

                  <View style={styles.macroRow}>
                    <Pressable
                      style={styles.macroCard}
                      onPress={toggleIntakeMode}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showEaten
                          ? `Show fiber ${goalBalance(dayTotals.fiber, DAILY_GOALS.fiber).label}`
                          : 'Show fiber eaten'
                      }
                    >
                      {showEaten ? (
                        <View style={styles.macroValueRow}>
                          <AnimatedNumber
                            value={Math.round(dayTotals.fiber)}
                            style={styles.macroValue}
                          />
                          <Text style={styles.macroGoal}>
                            /{DAILY_GOALS.fiber}g
                          </Text>
                        </View>
                      ) : (
                        <AnimatedNumber
                          value={goalBalance(dayTotals.fiber, DAILY_GOALS.fiber).amount}
                          suffix="g"
                          style={styles.macroValue}
                        />
                      )}
                      <Text style={styles.macroLabel}>
                        Fiber{' '}
                        {showEaten
                          ? 'eaten'
                          : goalBalance(dayTotals.fiber, DAILY_GOALS.fiber).label}
                      </Text>
                      <ProgressRing
                        size={64}
                        strokeWidth={7}
                        progress={dayTotals.fiber / DAILY_GOALS.fiber}
                        color="#64B5F6"
                        trackColor={colors.surfaceElevated}
                        style={styles.macroRing}
                      >
                        <MaterialCommunityIcons
                          name="food-apple"
                          size={18}
                          color="#64B5F6"
                        />
                      </ProgressRing>
                    </Pressable>
                    <Pressable
                      style={styles.macroCard}
                      onPress={toggleIntakeMode}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showEaten
                          ? `Show sugar ${goalBalance(sugarIntake, DAILY_GOALS.sugar).label}`
                          : 'Show sugar eaten'
                      }
                    >
                      {showEaten ? (
                        <View style={styles.macroValueRow}>
                          <AnimatedNumber
                            value={sugarIntake}
                            style={styles.macroValue}
                          />
                          <Text style={styles.macroGoal}>/{DAILY_GOALS.sugar}g</Text>
                        </View>
                      ) : (
                        <AnimatedNumber
                          value={goalBalance(sugarIntake, DAILY_GOALS.sugar).amount}
                          suffix="g"
                          style={styles.macroValue}
                        />
                      )}
                      <Text style={styles.macroLabel}>
                        Sugar{' '}
                        {showEaten
                          ? 'eaten'
                          : goalBalance(sugarIntake, DAILY_GOALS.sugar).label}
                      </Text>
                      <ProgressRing
                        size={64}
                        strokeWidth={7}
                        progress={sugarIntake / DAILY_GOALS.sugar}
                        color="#F48FB1"
                        trackColor={colors.surfaceElevated}
                        style={styles.macroRing}
                      >
                        <MaterialCommunityIcons
                          name="candy"
                          size={18}
                          color="#F48FB1"
                        />
                      </ProgressRing>
                    </Pressable>
                    <Pressable
                      style={styles.macroCard}
                      onPress={toggleIntakeMode}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showEaten
                          ? `Show sodium ${goalBalance(sodiumIntake, DAILY_GOALS.sodium).label}`
                          : 'Show sodium eaten'
                      }
                    >
                      {showEaten ? (
                        <View style={styles.macroValueRow}>
                          <AnimatedNumber
                            value={sodiumIntake}
                            style={styles.macroValue}
                          />
                          <Text style={styles.macroGoal}>
                            /{DAILY_GOALS.sodium}mg
                          </Text>
                        </View>
                      ) : (
                        <AnimatedNumber
                          value={goalBalance(sodiumIntake, DAILY_GOALS.sodium).amount}
                          suffix="mg"
                          style={styles.macroValue}
                        />
                      )}
                      <Text style={styles.macroLabel}>
                        Sodium{' '}
                        {showEaten
                          ? 'eaten'
                          : goalBalance(sodiumIntake, DAILY_GOALS.sodium).label}
                      </Text>
                      <ProgressRing
                        size={64}
                        strokeWidth={7}
                        progress={sodiumIntake / DAILY_GOALS.sodium}
                        color="#90A4AE"
                        trackColor={colors.surfaceElevated}
                        style={styles.macroRing}
                      >
                        <MaterialCommunityIcons
                          name="shaker-outline"
                          size={18}
                          color="#90A4AE"
                        />
                      </ProgressRing>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>

            <View style={styles.pagerDots}>
              <View style={[styles.pagerDot, pagerPage === 0 && styles.pagerDotActive]} />
              <View style={[styles.pagerDot, pagerPage === 1 && styles.pagerDotActive]} />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Recently uploaded</Text>

          {!hasRecentSection ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIllustration}>
                <Ionicons name="restaurant-outline" size={36} color={colors.textMuted} />
                <View style={styles.emptyLines}>
                  <View style={[styles.emptyLine, styles.emptyLineWide]} />
                  <View style={[styles.emptyLine, styles.emptyLineNarrow]} />
                </View>
              </View>
              <Text style={styles.emptyBody}>
                Tap + to add your first meal.
              </Text>
            </View>
          ) : (
            <>
              {recentJobCards.map((job) => (
                <MealProcessingCard key={job.id} job={job} />
              ))}
              {recentMeals.map((item) => {
              const timeLabel = formatMealTime(item.createdAt);
              return (
                <Pressable
                  key={item.id}
                  style={styles.mealCard}
                  onPress={() => router.push(`/meal/${item.id}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open nutrition for ${item.foodName}`}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.mealThumb}
                    />
                  ) : (
                    <View style={[styles.mealThumb, styles.mealThumbFallback]}>
                      <Ionicons
                        name="restaurant-outline"
                        size={28}
                        color={colors.textMuted}
                      />
                    </View>
                  )}
                  <View style={styles.mealBody}>
                    <View style={styles.mealTitleRow}>
                      <Text style={styles.mealTitle} numberOfLines={1}>
                        {item.foodName}
                      </Text>
                      {timeLabel ? (
                        <Text style={styles.mealTime}>{timeLabel}</Text>
                      ) : null}
                    </View>
                    <View style={styles.mealCalorieRow}>
                      <Ionicons name="flame" size={18} color={colors.text} />
                      <Text style={styles.mealCalories}>
                        {Math.round(item.calories)} calories
                      </Text>
                    </View>
                    <View style={styles.mealMacroRow}>
                      <View style={styles.mealMacro}>
                        <MaterialCommunityIcons
                          name="food-drumstick"
                          size={16}
                          color="#E57373"
                        />
                        <Text style={styles.mealMacroText}>
                          {Math.round(item.macros.protein)}g
                        </Text>
                      </View>
                      <View style={styles.mealMacro}>
                        <MaterialCommunityIcons
                          name="barley"
                          size={16}
                          color="#FFA726"
                        />
                        <Text style={styles.mealMacroText}>
                          {Math.round(item.macros.carbs)}g
                        </Text>
                      </View>
                      <View style={styles.mealMacro}>
                        <AvocadoIcon size={16} color="#66BB6A" />
                        <Text style={styles.mealMacroText}>
                          {Math.round(item.macros.fat)}g
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            </>
          )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: CONTENT_GUTTER,
    paddingBottom: 40,
    backgroundColor: colors.page,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  brand: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.5,
    marginLeft: 0,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dayCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: colors.text,
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  dayNumber: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  dayNumberSelected: {
    color: colors.card,
  },
  dayWeekday: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  dayWeekdaySelected: {
    color: colors.text,
    fontWeight: '600',
  },
  calorieCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    paddingVertical: 22,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 168,
  },
  calorieCopy: {
    flex: 1,
    paddingRight: 12,
    paddingLeft: 16,
  },
  calorieValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  calorieValue: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '600',
    letterSpacing: -1.2,
    lineHeight: 46,
  },
  calorieGoal: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 2,
    marginBottom: 6,
  },
  calorieLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  calorieLabel: {
    color: colors.textMuted,
    fontSize: 15,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.page,
  },
  macroCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 168,
  },
  wideMetricCard: {
    flex: 1.5,
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 168,
  },
  wideMetricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
  },
  healthScoreValueOffset: {
    transform: [{ translateX: -2 }],
  },
  wideMetricLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  macroValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  macroValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
  },
  macroGoal: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 1,
    marginBottom: 2,
  },
  macroLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  macroRing: {
    marginTop: 2,
  },
  pager: {
    marginHorizontal: -CONTENT_GUTTER,
    marginBottom: 20,
    backgroundColor: colors.page,
  },
  pagerScroll: {
    backgroundColor: colors.page,
  },
  pagerPage: {
    gap: 10,
    backgroundColor: colors.page,
  },
  pagerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  pagerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  pagerDotActive: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 16,
  },
  emptyIllustration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  emptyLines: {
    gap: 8,
  },
  emptyLine: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
  },
  emptyLineWide: {
    width: 88,
  },
  emptyLineNarrow: {
    width: 56,
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  mealCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    height: 120,
  },
  mealThumb: {
    width: 108,
    height: 120,
    backgroundColor: colors.surfaceElevated,
  },
  mealThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 8,
  },
  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  mealTime: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  mealCalorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealCalories: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    marginLeft: -2,
  },
  mealMacroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mealMacro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealMacroText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '400',
  },
  error: {
    color: '#FF6B6B',
    marginTop: 12,
    lineHeight: 20,
  },
});
