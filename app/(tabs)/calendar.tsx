import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MealHistoryCard } from '@/components/MealHistoryCard';
import { AvocadoIcon } from '@/components/AvocadoIcon';
import { ProgressRing } from '@/components/ProgressRing';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';
import {
  listNutritionAnalyses,
  type SavedNutrition,
} from '@/lib/firestore';
import {
  getHistoryCacheSync,
  loadHistoryCache,
  subscribeHistoryCache,
} from '@/lib/userHistoryCache';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MACRO_COLORS = {
  protein: '#E57373',
  carbs: '#FFA726',
  fat: '#66BB6A',
  fiber: '#64B5F6',
  sugar: '#F48FB1',
  sodium: '#90A4AE',
} as const;

const DAILY_GOALS = {
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 65,
  fiber: 30,
  sugar: 50,
  sodium: 2300,
} as const;

const PAGE_ONE_MACROS = [
  { key: 'protein' as const, label: 'Protein', icon: 'food-drumstick' as const },
  { key: 'carbs' as const, label: 'Carbs', icon: 'barley' as const },
  { key: 'fat' as const, label: 'Fat' },
] as const;

const PAGE_TWO_MACROS = [
  { key: 'fiber' as const, label: 'Fiber', icon: 'food-apple' as const },
  { key: 'sugar' as const, label: 'Sugar', icon: 'candy' as const },
  { key: 'sodium' as const, label: 'Sodium', icon: 'shaker-outline' as const },
] as const;

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

function monthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = first.getDay();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

function mealsForDay(analyses: SavedNutrition[], day: Date): SavedNutrition[] {
  return analyses.filter(
    (item) => item.createdAt != null && sameDay(new Date(item.createdAt), day),
  );
}

function sumMeals(meals: SavedNutrition[]) {
  return meals.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.macros.protein,
      carbs: acc.carbs + item.macros.carbs,
      fat: acc.fat + item.macros.fat,
      fiber: acc.fiber + item.macros.fiber,
      sugar: acc.sugar + item.macros.sugar,
      sodium: acc.sodium + item.macros.sodium,
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

export default function CalendarScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = useState<Date | null>(() => today);
  const [analyses, setAnalyses] = useState<SavedNutrition[]>(() =>
    user ? (getHistoryCacheSync(user.uid)?.analyses ?? []) : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [mealPage, setMealPage] = useState(0);
  const [nutritionPage, setNutritionPage] = useState(0);

  const refreshFromNetwork = useCallback(async (uid: string) => {
    setError(null);
    try {
      const next = await listNutritionAnalyses(uid, 100);
      setAnalyses(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load meal history.',
      );
    }
  }, []);

  const applyCache = useCallback((uid: string) => {
    const cache = getHistoryCacheSync(uid);
    if (cache) setAnalyses(cache.analyses);
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    return subscribeHistoryCache((changedUid) => {
      if (changedUid === uid) applyCache(uid);
    });
  }, [user, applyCache]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setAnalyses([]);
        return;
      }
      const uid = user.uid;
      let active = true;

      async function load() {
        const syncCache = getHistoryCacheSync(uid);
        if (syncCache) {
          setAnalyses(syncCache.analyses);
        } else {
          const disk = await loadHistoryCache(uid);
          if (!active) return;
          setAnalyses(disk?.analyses ?? []);
        }

        void refreshFromNetwork(uid);
      }

      void load();
      return () => {
        active = false;
      };
    }, [user, refreshFromNetwork]),
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const monthLabel = cursor.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const daysWithMeals = useMemo(() => {
    const days = new Set<number>();
    for (const item of analyses) {
      if (item.createdAt == null) continue;
      const d = new Date(item.createdAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        days.add(startOfDay(d));
      }
    }
    return days;
  }, [analyses, year, month]);

  const selectedMeals = useMemo(
    () => (selected ? mealsForDay(analyses, selected) : []),
    [analyses, selected],
  );
  const totals = useMemo(() => sumMeals(selectedMeals), [selectedMeals]);
  const averageHealthScore = totals.count
    ? totals.healthScore / totals.count
    : 0;

  function shiftMonth(delta: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    const isCurrentMonth =
      next.getFullYear() === today.getFullYear() &&
      next.getMonth() === today.getMonth();
    setCursor(next);
    setSelected(isCurrentMonth ? today : next);
    setMealPage(0);
    setNutritionPage(0);
  }

  function selectDay(day: Date) {
    setSelected(day);
    setMealPage(0);
    setNutritionPage(0);
  }

  function onMealCarouselScroll(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    const next = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
    setMealPage(Math.min(selectedMeals.length - 1, Math.max(0, next)));
  }

  function onNutritionPagerScroll(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    const next = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
    setNutritionPage(Math.min(1, Math.max(0, next)));
  }

  const selectedLabel = selected
    ? selected.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.calendarCard}>
      <View style={styles.monthHeader}>
        <Pressable
          style={styles.monthNav}
          onPress={() => shiftMonth(-1)}
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable
          style={styles.monthNav}
          onPress={() => shiftMonth(1)}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
          {weeks.map((week, weekIndex) => (
            <View key={`w-${weekIndex}`} style={styles.weekRow}>
              {week.map((day, dayIndex) => {
                if (!day) {
                  return <View key={`e-${weekIndex}-${dayIndex}`} style={styles.dayCell} />;
                }
                const key = startOfDay(day);
                const isSelected = selected != null && sameDay(day, selected);
                const isToday = sameDay(day, today);
                const hasMeals = daysWithMeals.has(key);

                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.dayCell,
                      isSelected && styles.daySelected,
                      isToday && !isSelected && styles.dayToday,
                    ]}
                    onPress={() => selectDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        isSelected && styles.dayNumberSelected,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                    {hasMeals ? (
                      <View
                        style={[styles.dot, isSelected && styles.dotSelected]}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
      </View>
      </View>

      {selected ? (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>{selectedLabel}</Text>

          {selectedMeals.length === 0 ? (
            <Text style={styles.empty}>No meals logged this day.</Text>
          ) : (
            <>
              <View style={styles.nutritionSection}>
                <ScrollView
                  key={`nutrition-${startOfDay(selected)}`}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  removeClippedSubviews={false}
                  decelerationRate="fast"
                  bounces={false}
                  onScroll={onNutritionPagerScroll}
                  scrollEventThrottle={16}
                >
                  <View style={[styles.nutritionPage, { width: windowWidth }]}>
                    <View style={styles.calorieCard}>
                      <View style={styles.calorieCopy}>
                        <View style={styles.calorieValueRow}>
                          <Text style={styles.calorieValue}>
                            {Math.round(totals.calories)}
                          </Text>
                          <Text style={styles.calorieGoal}>
                            /{DAILY_GOALS.calories}
                          </Text>
                        </View>
                        <Text style={[styles.metricLabel, styles.calorieLabel]}>
                          Calories eaten
                        </Text>
                      </View>
                      <ProgressRing
                        size={60}
                        strokeWidth={7}
                        progress={totals.calories / DAILY_GOALS.calories}
                        color={colors.text}
                        trackColor={colors.surfaceElevated}
                      >
                        <Ionicons name="flame" size={17} color={colors.text} />
                      </ProgressRing>
                    </View>
                    <View style={styles.metricGrid}>
                      {PAGE_ONE_MACROS.map((macro) => (
                        <View key={macro.key} style={styles.metricCard}>
                          <View>
                            <View style={styles.metricValueRow}>
                              <Text style={styles.metricValue}>
                                {Math.round(totals[macro.key])}
                              </Text>
                              <Text style={styles.metricGoal}>
                                /{DAILY_GOALS[macro.key]}g
                              </Text>
                            </View>
                            <Text style={[styles.metricLabel, styles.macroLabel]}>
                              {macro.label} eaten
                            </Text>
                          </View>
                          <ProgressRing
                            size={44}
                            strokeWidth={5}
                            progress={totals[macro.key] / DAILY_GOALS[macro.key]}
                            color={MACRO_COLORS[macro.key]}
                            trackColor={colors.surfaceElevated}
                          >
                            {macro.key === 'fat' ? (
                              <AvocadoIcon size={14} color={MACRO_COLORS.fat} />
                            ) : (
                              <MaterialCommunityIcons
                                name={macro.icon}
                                size={14}
                                color={MACRO_COLORS[macro.key]}
                              />
                            )}
                          </ProgressRing>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={[styles.nutritionPage, { width: windowWidth }]}>
                    <View style={styles.healthCard}>
                      <View style={styles.healthCopy}>
                        <View style={styles.metricValueRow}>
                          <Text style={styles.healthValue}>
                            {averageHealthScore.toFixed(1)}
                          </Text>
                          <Text style={styles.healthGoal}>/10</Text>
                        </View>
                        <Text style={[styles.metricLabel, styles.healthLabel]}>
                          Health score
                        </Text>
                      </View>
                      <ProgressRing
                        size={60}
                        strokeWidth={7}
                        progress={averageHealthScore / 10}
                        color="#66BB6A"
                        trackColor={colors.surfaceElevated}
                      >
                        <MaterialCommunityIcons
                          name="heart-pulse"
                          size={17}
                          color="#66BB6A"
                        />
                      </ProgressRing>
                    </View>
                    <View style={styles.metricGrid}>
                      {PAGE_TWO_MACROS.map((macro) => {
                        const unit = macro.key === 'sodium' ? 'mg' : 'g';
                        return (
                          <View key={macro.key} style={styles.metricCard}>
                        <View>
                          <View style={styles.metricValueRow}>
                            <Text style={styles.metricValue}>
                              {Math.round(totals[macro.key])}
                            </Text>
                            <Text style={styles.metricGoal}>
                              /{DAILY_GOALS[macro.key]}{unit}
                            </Text>
                          </View>
                          <Text style={[styles.metricLabel, styles.macroLabel]}>
                            {macro.label} eaten
                          </Text>
                        </View>
                        <ProgressRing
                          size={44}
                          strokeWidth={5}
                          progress={totals[macro.key] / DAILY_GOALS[macro.key]}
                          color={MACRO_COLORS[macro.key]}
                          trackColor={colors.surfaceElevated}
                        >
                          <MaterialCommunityIcons
                            name={macro.icon}
                            size={14}
                            color={MACRO_COLORS[macro.key]}
                          />
                        </ProgressRing>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>
                <View style={styles.pagerDots}>
                  {[0, 1].map((page) => (
                    <View
                      key={page}
                      style={[
                        styles.pagerDot,
                        nutritionPage === page && styles.pagerDotActive,
                      ]}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.mealsHeadingRow}>
                <Text style={styles.mealsHeading}>Meals</Text>
              </View>
              <View style={styles.mealPager}>
                <ScrollView
                  key={`meals-${startOfDay(selected)}`}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  removeClippedSubviews={false}
                  decelerationRate="fast"
                  bounces={false}
                  onScroll={onMealCarouselScroll}
                  scrollEventThrottle={16}
                  accessibilityLabel="Meals for selected day"
                >
                  {selectedMeals.map((item) => (
                    <View
                      key={item.id}
                      style={[styles.mealPage, { width: windowWidth }]}
                    >
                      <MealHistoryCard
                        item={item}
                        onPress={() => router.push(`/meal/${item.id}` as Href)}
                      />
                    </View>
                  ))}
                </ScrollView>
                {selectedMeals.length > 1 ? (
                  <View style={styles.pagerDots}>
                    {selectedMeals.map((item, index) => (
                      <View
                        key={item.id}
                        style={[
                          styles.pagerDot,
                          mealPage === index && styles.pagerDotActive,
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          )}
        </View>
      ) : null}

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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    backgroundColor: colors.page,
  },
  calendarCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    marginBottom: 24,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 7,
    marginBottom: 12,
  },
  monthNav: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    gap: 4,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    position: 'relative',
  },
  daySelected: {
    backgroundColor: colors.buttonPrimaryBg,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayNumber: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  dayNumberSelected: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  dot: {
    position: 'absolute',
    bottom: 6,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.textSecondary,
  },
  dotSelected: {
    backgroundColor: colors.buttonPrimaryText,
  },
  detail: {
    gap: 12,
  },
  detailTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  nutritionSection: {
    backgroundColor: colors.page,
    borderRadius: 22,
    marginHorizontal: -20,
  },
  nutritionPage: {
    gap: 10,
    paddingHorizontal: 20,
  },
  calorieCard: {
    height: 120,
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: 32,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calorieValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 36,
  },
  calorieValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  calorieCopy: {
    alignItems: 'flex-start',
  },
  calorieLabel: {
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  calorieGoal: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 2,
    marginBottom: 4,
  },
  healthCard: {
    height: 120,
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: 32,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  healthCopy: {
    alignItems: 'flex-start',
  },
  healthValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
  },
  healthGoal: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 2,
    marginBottom: 3,
  },
  healthLabel: {
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.page,
  },
  metricCard: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    height: 120,
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  metricValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  metricGoal: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '500',
    marginLeft: 1,
    marginBottom: 1,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 0,
    textAlign: 'center',
  },
  macroLabel: {
    fontSize: 10,
    marginTop: 0,
  },
  mealsHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  mealsHeading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  mealPager: {
    marginHorizontal: -20,
    overflow: 'visible',
  },
  mealPage: {
    paddingHorizontal: 20,
    paddingVertical: 1,
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  pagerDotActive: {
    borderWidth: 1.5,
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  error: {
    color: '#FF6B6B',
    marginTop: 12,
    lineHeight: 20,
  },
});
