import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';

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

const ANALYZE_HREF = '/analyze' as Href;

const MACRO_COLORS = {
  protein: '#E57373',
  carbs: '#64B5F6',
  fat: '#FFD54F',
  fiber: '#81C784',
} as const;

function isSameLocalDay(ms: number, now = new Date()): boolean {
  const date = new Date(ms);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function sumToday(analyses: SavedNutrition[]) {
  return analyses
    .filter((item) => item.createdAt != null && isSameLocalDay(item.createdAt))
    .reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.macros.protein,
        carbs: acc.carbs + item.macros.carbs,
        fat: acc.fat + item.macros.fat,
        fiber: acc.fiber + item.macros.fiber,
        count: acc.count + 1,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, count: 0 },
    );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<SavedNutrition[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFromNetwork = useCallback(async (uid: string) => {
    setRefreshing(true);
    setError(null);
    try {
      const next = await listNutritionAnalyses(uid, 20);
      setAnalyses(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load meal history.',
      );
    } finally {
      setRefreshing(false);
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

  const today = useMemo(() => sumToday(analyses), [analyses]);
  const recent = analyses.slice(0, 8);
  const macroTotal =
    today.protein + today.carbs + today.fat + today.fiber || 1;

  const macros = [
    { key: 'protein', label: 'Protein', value: today.protein, color: MACRO_COLORS.protein },
    { key: 'carbs', label: 'Carbs', value: today.carbs, color: MACRO_COLORS.carbs },
    { key: 'fat', label: 'Fat', value: today.fat, color: MACRO_COLORS.fat },
    { key: 'fiber', label: 'Fiber', value: today.fiber, color: MACRO_COLORS.fiber },
  ] as const;

  async function onRefresh() {
    if (!user || refreshing) return;
    await refreshFromNetwork(user.uid);
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.subtitle}>
            Macros from meals you analyzed today
          </Text>
        </View>
        <Pressable
          style={[styles.refreshButton, refreshing && styles.buttonDisabled]}
          onPress={onRefresh}
          disabled={!user || refreshing || loading}
          accessibilityRole="button"
          accessibilityLabel="Refresh home"
        >
          {refreshing ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Ionicons name="refresh" size={20} color={colors.text} />
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.text} style={styles.loader} />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.calories}>{Math.round(today.calories)} kcal</Text>
            <Text style={styles.mealCount}>
              {today.count === 0
                ? 'No meals logged today'
                : `${today.count} meal${today.count === 1 ? '' : 's'} today`}
            </Text>

            <View style={styles.macroStack}>
              {macros.map((macro) => (
                <View key={macro.key} style={styles.macroRow}>
                  <View style={styles.macroLabelRow}>
                    <View style={[styles.dot, { backgroundColor: macro.color }]} />
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
          </View>

          <Text style={styles.sectionTitle}>Recent meals</Text>

          {recent.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No meals yet</Text>
              <Text style={styles.emptyBody}>
                Tap the + button to analyze a meal photo.
              </Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => router.push(ANALYZE_HREF)}
              >
                <Ionicons name="add" size={18} color={colors.buttonPrimaryText} />
                <Text style={styles.primaryButtonText}>Analyze a meal</Text>
              </Pressable>
            </View>
          ) : (
            recent.map((item) => (
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
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  loader: {
    marginTop: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
  },
  calories: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  mealCount: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 16,
  },
  macroStack: {
    gap: 12,
  },
  macroRow: {
    gap: 6,
  },
  macroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
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
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 10,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  primaryButton: {
    backgroundColor: colors.buttonPrimaryBg,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  mealItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
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
  buttonDisabled: {
    opacity: 0.5,
  },
});
