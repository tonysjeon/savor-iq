import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  carbs: '#64B5F6',
  fat: '#FFD54F',
  fiber: '#81C784',
} as const;

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
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

export default function CalendarScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = useState<Date | null>(() => today);
  const [analyses, setAnalyses] = useState<SavedNutrition[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    const set = new Set<number>();
    for (const item of analyses) {
      if (item.createdAt == null) continue;
      const d = new Date(item.createdAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        set.add(startOfDay(d));
      }
    }
    return set;
  }, [analyses, year, month]);

  const selectedMeals = useMemo(
    () => (selected ? mealsForDay(analyses, selected) : []),
    [analyses, selected],
  );
  const totals = useMemo(() => sumMeals(selectedMeals), [selectedMeals]);
  const macroTotal =
    totals.protein + totals.carbs + totals.fat + totals.fiber || 1;
  const macros = [
    { key: 'protein', label: 'Protein', value: totals.protein, color: MACRO_COLORS.protein },
    { key: 'carbs', label: 'Carbs', value: totals.carbs, color: MACRO_COLORS.carbs },
    { key: 'fat', label: 'Fat', value: totals.fat, color: MACRO_COLORS.fat },
    { key: 'fiber', label: 'Fiber', value: totals.fiber, color: MACRO_COLORS.fiber },
  ] as const;

  function shiftMonth(delta: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    const isCurrentMonth =
      next.getFullYear() === today.getFullYear() &&
      next.getMonth() === today.getMonth();
    setCursor(next);
    setSelected(isCurrentMonth ? today : null);
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
      <View style={styles.monthHeader}>
        <Pressable
          style={styles.monthNav}
          onPress={() => shiftMonth(-1)}
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable
          style={styles.monthNav}
          onPress={() => shiftMonth(1)}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
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
                    onPress={() => setSelected(day)}
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
                        style={[
                          styles.dot,
                          isSelected && styles.dotSelected,
                        ]}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
      </View>

      {selected ? (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>{selectedLabel}</Text>

          {selectedMeals.length === 0 ? (
            <Text style={styles.empty}>No meals logged this day.</Text>
          ) : (
            <>
              <Text style={styles.calories}>{Math.round(totals.calories)} kcal</Text>
              <View style={styles.macroStack}>
                {macros.map((macro) => (
                  <View key={macro.key} style={styles.macroRow}>
                    <View style={styles.macroLabelRow}>
                      <View style={[styles.macroDot, { backgroundColor: macro.color }]} />
                      <Text style={styles.macroLabel}>{macro.label}</Text>
                      <Text style={styles.macroValue}>
                        {Math.round(macro.value)}g
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            backgroundColor: macro.color,
                            width: `${Math.min(100, (macro.value / macroTotal) * 100)}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.mealsHeading}>Meals</Text>
              {selectedMeals.map((item) => (
                <View key={item.id} style={styles.mealItem}>
                  <Text style={styles.mealTitle} numberOfLines={1}>
                    {item.foodName}
                  </Text>
                  <Text style={styles.mealMeta}>
                    {item.calories} kcal · Score {item.healthScore}/10
                  </Text>
                </View>
              ))}
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
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthNav: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    marginBottom: 24,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
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
  calories: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  macroStack: {
    gap: 10,
    marginTop: 4,
  },
  macroRow: {
    gap: 6,
  },
  macroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  macroValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  mealsHeading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  mealItem: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 12,
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
