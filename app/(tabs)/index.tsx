import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Svg, { Ellipse, Path } from 'react-native-svg';

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
    color: '#64B5F6',
  },
] as const;

function AvocadoIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        d="M12 1.5c-2.4 0-4.3 1.9-4.7 4.4C6.7 9.5 6.2 13.2 6.8 16.2 7.4 19.4 9.5 21.5 12 21.5s4.6-2.1 5.2-5.3c.6-3 .1-6.7-.5-10.3C16.3 3.4 14.4 1.5 12 1.5z"
        fill="#689F38"
      />
      <Path
        d="M12 3.4c-1.6 0-2.9 1.3-3.2 3.1-.5 3-.9 6-.4 8.4.4 2.3 1.9 3.9 3.6 3.9s3.2-1.6 3.6-3.9c.5-2.4.1-5.4-.4-8.4C14.9 4.7 13.6 3.4 12 3.4z"
        fill="#C5E1A5"
      />
      <Ellipse cx="12" cy="14.2" rx="2.8" ry="3.3" fill="#5D4037" />
      <Ellipse cx="12.8" cy="13.2" rx="0.85" ry="1.05" fill="#A1887F" opacity={0.8} />
    </Svg>
  );
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
        healthScore: acc.healthScore + item.healthScore,
        count: acc.count + 1,
      }),
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        healthScore: 0,
        count: 0,
      },
    );
}

function mealsForDay(analyses: SavedNutrition[], day: Date): SavedNutrition[] {
  return analyses.filter(
    (item) => item.createdAt != null && sameDay(new Date(item.createdAt), day),
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date(), []);
  const [selectedDay, setSelectedDay] = useState(() => today);
  const [analyses, setAnalyses] = useState<SavedNutrition[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagerPage, setPagerPage] = useState(0);
  const [showEaten, setShowEaten] = useState(false);

  const refreshFromNetwork = useCallback(async (uid: string) => {
    setError(null);
    try {
      const next = await listNutritionAnalyses(uid, 100);
      setAnalyses(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load meal history.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const uid = user.uid;
      let active = true;

      const syncCache = getHistoryCacheSync(uid);
      if (syncCache) {
        setAnalyses(syncCache.analyses);
        setLoading(false);
        setHydrated(true);
        return () => {
          active = false;
        };
      }

      if (hydrated) {
        return () => {
          active = false;
        };
      }

      async function hydrate() {
        setLoading(true);
        const disk = await loadHistoryCache(uid);
        if (!active) return;

        if (disk) {
          setAnalyses(disk.analyses);
          setLoading(false);
          setHydrated(true);
          return;
        }

        await refreshFromNetwork(uid);
        if (active) setHydrated(true);
      }

      void hydrate();

      return () => {
        active = false;
      };
    }, [user, hydrated, refreshFromNetwork]),
  );

  const days = useMemo(() => weekDaysAround(today), [today]);
  const dayTotals = useMemo(
    () => sumForDay(analyses, selectedDay),
    [analyses, selectedDay],
  );
  const dayMeals = useMemo(
    () => mealsForDay(analyses, selectedDay),
    [analyses, selectedDay],
  );

  const caloriesLeft = Math.max(0, Math.round(DAILY_GOALS.calories - dayTotals.calories));
  const caloriesEaten = Math.round(dayTotals.calories);
  const calorieProgress = dayTotals.calories / DAILY_GOALS.calories;
  const avgHealthScore =
    dayTotals.count > 0 ? dayTotals.healthScore / dayTotals.count : 0;
  // Sugar, sodium, and water are not tracked from meal analyses yet.
  const sugarIntake = 0;
  const sodiumIntake = 0;
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
              <View style={[styles.dayCircle, selected && styles.dayCircleSelected]}>
                <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>
                  {day.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.text} style={styles.loader} />
      ) : (
        <>
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
                      showEaten ? 'Show calories left' : 'Show calories eaten'
                    }
                  >
                    <View style={styles.calorieCopy}>
                      {showEaten ? (
                        <View style={styles.calorieValueRow}>
                          <Text style={styles.calorieValue}>{caloriesEaten}</Text>
                          <Text style={styles.calorieGoal}>
                            /{DAILY_GOALS.calories}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.calorieValue}>{caloriesLeft}</Text>
                      )}
                      <View style={styles.calorieLabelRow}>
                        <Text style={styles.calorieLabel}>
                          {showEaten ? 'Calories eaten' : 'Calories left'}
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
                      const left = Math.max(0, goal - eaten);
                      return (
                        <Pressable
                          key={macro.key}
                          style={styles.macroCard}
                          onPress={toggleIntakeMode}
                          accessibilityRole="button"
                          accessibilityLabel={
                            showEaten
                              ? `Show ${macro.label} left`
                              : `Show ${macro.label} eaten`
                          }
                        >
                          {showEaten ? (
                            <View style={styles.macroValueRow}>
                              <Text style={styles.macroValue}>{eaten}</Text>
                              <Text style={styles.macroGoal}>/{goal}g</Text>
                            </View>
                          ) : (
                            <Text style={styles.macroValue}>{left}g</Text>
                          )}
                          <Text style={styles.macroLabel}>
                            {macro.label} {showEaten ? 'eaten' : 'left'}
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
                              <AvocadoIcon size={22} />
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
                      <Text style={styles.wideMetricValue}>
                        {avgHealthScore > 0 ? avgHealthScore.toFixed(1) : '0'}
                      </Text>
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
                      <Text style={styles.wideMetricValue}>{waterIntake}ml</Text>
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
                        showEaten ? 'Show fiber left' : 'Show fiber eaten'
                      }
                    >
                      {showEaten ? (
                        <View style={styles.macroValueRow}>
                          <Text style={styles.macroValue}>
                            {Math.round(dayTotals.fiber)}
                          </Text>
                          <Text style={styles.macroGoal}>
                            /{DAILY_GOALS.fiber}g
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.macroValue}>
                          {Math.max(
                            0,
                            Math.round(DAILY_GOALS.fiber - dayTotals.fiber),
                          )}
                          g
                        </Text>
                      )}
                      <Text style={styles.macroLabel}>
                        Fiber {showEaten ? 'eaten' : 'left'}
                      </Text>
                      <ProgressRing
                        size={64}
                        strokeWidth={7}
                        progress={dayTotals.fiber / DAILY_GOALS.fiber}
                        color="#81C784"
                        trackColor={colors.surfaceElevated}
                        style={styles.macroRing}
                      >
                        <MaterialCommunityIcons
                          name="leaf"
                          size={18}
                          color="#81C784"
                        />
                      </ProgressRing>
                    </Pressable>
                    <Pressable
                      style={styles.macroCard}
                      onPress={toggleIntakeMode}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showEaten ? 'Show sugar left' : 'Show sugar eaten'
                      }
                    >
                      {showEaten ? (
                        <View style={styles.macroValueRow}>
                          <Text style={styles.macroValue}>{sugarIntake}</Text>
                          <Text style={styles.macroGoal}>/{DAILY_GOALS.sugar}g</Text>
                        </View>
                      ) : (
                        <Text style={styles.macroValue}>
                          {Math.max(0, DAILY_GOALS.sugar - sugarIntake)}g
                        </Text>
                      )}
                      <Text style={styles.macroLabel}>
                        Sugar {showEaten ? 'eaten' : 'left'}
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
                        showEaten ? 'Show sodium left' : 'Show sodium eaten'
                      }
                    >
                      {showEaten ? (
                        <View style={styles.macroValueRow}>
                          <Text style={styles.macroValue}>{sodiumIntake}</Text>
                          <Text style={styles.macroGoal}>
                            /{DAILY_GOALS.sodium}mg
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.macroValue}>
                          {Math.max(0, DAILY_GOALS.sodium - sodiumIntake)}mg
                        </Text>
                      )}
                      <Text style={styles.macroLabel}>
                        Sodium {showEaten ? 'eaten' : 'left'}
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

          <Text style={styles.sectionTitle}>Recent meals</Text>

          {dayMeals.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIllustration}>
                <Ionicons name="restaurant-outline" size={36} color={colors.textMuted} />
                <View style={styles.emptyLines}>
                  <View style={[styles.emptyLine, styles.emptyLineWide]} />
                  <View style={[styles.emptyLine, styles.emptyLineNarrow]} />
                </View>
              </View>
              <Text style={styles.emptyBody}>
                Tap + to add your first meal of the day.
              </Text>
            </View>
          ) : (
            dayMeals.map((item) => (
              <View key={item.id} style={styles.mealItem}>
                <View style={styles.mealText}>
                  <Text style={styles.mealTitle} numberOfLines={1}>
                    {item.foodName}
                  </Text>
                  <Text style={styles.mealMeta} numberOfLines={1}>
                    {item.calories} kcal · Score {item.healthScore}/10
                  </Text>
                </View>
              </View>
            ))
          )}
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
    marginLeft: -2,
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
  loader: {
    marginTop: 24,
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
    borderColor: colors.text,
    backgroundColor: 'transparent',
  },
  pagerDotActive: {
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
  mealItem: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  mealText: {
    gap: 4,
  },
  mealTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  mealMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  error: {
    color: '#FF6B6B',
    marginTop: 12,
    lineHeight: 20,
  },
});
