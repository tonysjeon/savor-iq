import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AvocadoIcon } from '@/components/AvocadoIcon';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  deleteNutritionAnalysis,
  type SavedNutrition,
} from '@/lib/firestore';
import { lookupSavedNutrition } from '@/lib/mealLookup';
import { dismissMealAnalysis } from '@/lib/mealAnalysisQueue';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = Math.round(Dimensions.get('window').height * 0.42);
const SHEET_OVERLAP = 28;
const CONTENT_GUTTER = 24;
const PAGER_WIDTH = SCREEN_WIDTH;

function formatMealTime(createdAt: number | null | undefined): string {
  if (createdAt == null) return '';
  return new Date(createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [meal, setMeal] = useState<SavedNutrition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [macroPage, setMacroPage] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);

  const load = useCallback(async () => {
    if (!user || !id) {
      setError('Meal not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await lookupSavedNutrition(user.uid, id);
      if (!next) {
        setMeal(null);
        setError('Meal not found.');
      } else {
        setMeal(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load meal.');
      setMeal(null);
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const timeLabel = useMemo(
    () => formatMealTime(meal?.createdAt),
    [meal?.createdAt],
  );

  const onMacroScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / PAGER_WIDTH);
    setMacroPage(page);
  };

  const openMoreMenu = () => {
    if (!meal || !user) return;
    Alert.alert(
      'Delete meal?',
      'This removes the meal from your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                dismissMealAnalysis(meal.id);
                await deleteNutritionAnalysis(user.uid, meal.id);
                // Cache subscribers update Home and Calendar before we switch
                // tabs, so the removed meal is absent from today's totals and
                // the recent-meals list on arrival.
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)');
                }
              } catch (err) {
                Alert.alert(
                  'Couldn’t delete meal',
                  err instanceof Error
                    ? err.message
                    : 'Something went wrong.',
                );
              }
            })();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorTitle}>{error ?? 'Meal not found.'}</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const protein = Math.round(meal.macros.protein);
  const carbs = Math.round(meal.macros.carbs);
  const fat = Math.round(meal.macros.fat);
  const fiber = Math.round(meal.macros.fiber);
  const calories = Math.round(meal.calories);
  const sugar = Math.round(meal.macros.sugar ?? 0);
  const sodium = Math.round(meal.macros.sodium ?? 0);
  const healthScore = meal.healthScore;

  return (
    <View style={styles.screen}>
      <View style={[styles.hero, { height: HERO_HEIGHT }]}>
        {meal.imageUrl ? (
          <Image source={{ uri: meal.imageUrl }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.heroFallback]}>
            <Ionicons name="restaurant" size={48} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.heroScrim} />
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBarRow}>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={colors.text}
              style={styles.backChevron}
            />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable
              style={styles.iconButton}
              onPress={openMoreMenu}
              accessibilityRole="button"
              accessibilityLabel="More options"
              hitSlop={8}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: HERO_HEIGHT - SHEET_OVERLAP,
            paddingBottom: insets.bottom + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Text style={styles.foodName}>{meal.foodName}</Text>
            {timeLabel ? (
              <View style={styles.timePill}>
                <Text style={styles.timePillText}>{timeLabel}</Text>
              </View>
            ) : null}
            <Pressable
              style={styles.bookmarkButton}
              onPress={() => setBookmarked((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark meal'}
              hitSlop={8}
            >
              <Svg width={22} height={26} viewBox="0 0 24 28" fill="none">
                <Path
                  d="M6.5 2.5h11c.83 0 1.5.67 1.5 1.5v21.2l-7-4.05-7 4.05V4c0-.83.67-1.5 1.5-1.5z"
                  stroke={colors.text}
                  strokeWidth={2.75}
                  strokeLinejoin="round"
                  fill={bookmarked ? colors.text : 'none'}
                />
              </Svg>
            </Pressable>
          </View>

          <View style={styles.pager}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onMacroScroll}
              scrollEventThrottle={16}
              decelerationRate="fast"
              bounces={false}
            >
              <View style={[styles.pagerPage, { width: PAGER_WIDTH }]}>
                <View style={styles.calorieCard}>
                  <Ionicons name="flame" size={28} color={colors.text} />
                  <View style={styles.metricCopy}>
                    <Text style={styles.metricLabel}>Calories</Text>
                    <Text style={styles.calorieValue}>{calories}</Text>
                  </View>
                </View>

                <View style={styles.metricRow}>
                  <View style={styles.metricCard}>
                    <MaterialCommunityIcons
                      name="food-drumstick"
                      size={22}
                      color="#E57373"
                    />
                    <View style={styles.metricCopy}>
                      <Text style={styles.metricLabel}>Protein</Text>
                      <Text style={styles.metricValue}>{protein}g</Text>
                    </View>
                  </View>
                  <View style={styles.metricCard}>
                    <MaterialCommunityIcons
                      name="barley"
                      size={22}
                      color="#FFA726"
                    />
                    <View style={styles.metricCopy}>
                      <Text style={styles.metricLabel}>Carbs</Text>
                      <Text style={styles.metricValue}>{carbs}g</Text>
                    </View>
                  </View>
                  <View style={styles.metricCard}>
                    <AvocadoIcon size={22} color="#66BB6A" />
                    <View style={styles.metricCopy}>
                      <Text style={styles.metricLabel}>Fats</Text>
                      <Text style={styles.metricValue}>{fat}g</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.pagerPage, { width: PAGER_WIDTH }]}>
                <View style={styles.metricRow}>
                  <View style={styles.metricCard}>
                    <MaterialCommunityIcons
                      name="food-apple"
                      size={22}
                      color="#64B5F6"
                    />
                    <View style={styles.metricCopy}>
                      <Text style={styles.metricLabel}>Fiber</Text>
                      <Text style={styles.metricValue}>{fiber}g</Text>
                    </View>
                  </View>
                  <View style={styles.metricCard}>
                    <MaterialCommunityIcons
                      name="candy"
                      size={22}
                      color="#F48FB1"
                    />
                    <View style={styles.metricCopy}>
                      <Text style={styles.metricLabel}>Sugar</Text>
                      <Text style={styles.metricValue}>{sugar}g</Text>
                    </View>
                  </View>
                  <View style={styles.metricCard}>
                    <MaterialCommunityIcons
                      name="shaker-outline"
                      size={22}
                      color="#90A4AE"
                    />
                    <View style={styles.metricCopy}>
                      <Text style={styles.metricLabel}>Sodium</Text>
                      <Text style={styles.metricValue}>{sodium}mg</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.healthCard}>
                  <View style={styles.healthTop}>
                    <MaterialCommunityIcons
                      name="heart-pulse"
                      size={26}
                      color="#66BB6A"
                    />
                    <Text style={styles.healthLabel}>Health Score</Text>
                    <Text style={styles.healthValue}>{healthScore}/10</Text>
                  </View>
                  <View style={styles.healthTrack}>
                    <View
                      style={[
                        styles.healthFill,
                        {
                          width: `${Math.min(100, Math.max(0, healthScore * 10))}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.pagerDots}>
              <View style={[styles.dot, macroPage === 0 && styles.dotActive]} />
              <View style={[styles.dot, macroPage === 1 && styles.dotActive]} />
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <Pressable
              style={styles.addMoreButton}
              accessibilityRole="button"
              accessibilityLabel="Add ingredients"
            >
              <Text style={styles.addMoreText}>+ Add More</Text>
            </Pressable>
          </View>

          {meal.description ? (
            <Text style={styles.description}>{meal.description}</Text>
          ) : (
            <Text style={styles.emptyIngredients}>
              Ingredient breakdown isn’t available for this meal yet.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.page,
    paddingHorizontal: 24,
    gap: 12,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  backLink: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backLinkText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceElevated,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: 16,
  },
  topBarRow: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 40,
    color: colors.card,
    fontSize: 17,
    fontWeight: '600',
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
    zIndex: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  backChevron: {
    marginLeft: -2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.page,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: CONTENT_GUTTER,
    paddingTop: 24,
    paddingBottom: 16,
    minHeight: Dimensions.get('window').height - HERO_HEIGHT + SHEET_OVERLAP,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  foodName: {
    flex: 1,
    color: colors.text,
    fontSize: 27,
    fontWeight: '500',
    letterSpacing: -0.4,
    lineHeight: 33,
    paddingRight: 4,
  },
  timePill: {
    backgroundColor: '#EBEBEB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexShrink: 0,
  },
  timePillText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '400',
  },
  bookmarkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    flexShrink: 0,
  },
  pager: {
    marginHorizontal: -CONTENT_GUTTER,
    marginBottom: 8,
  },
  pagerPage: {
    paddingHorizontal: CONTENT_GUTTER,
    gap: 12,
  },
  calorieCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 78,
  },
  metricCopy: {
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  metricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  calorieValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  healthCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  healthTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  healthLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  healthValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '500',
  },
  healthTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  healthFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#66BB6A',
  },
  pagerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  dotActive: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  addMoreButton: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  addMoreText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  emptyIngredients: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
