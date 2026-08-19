import type { SavedNutrition, SavedUserProfile } from '@/lib/firestore';
import type { WeightGoal } from '@/lib/onboarding';
import type {
  MacroBudget,
  MealHistoryItem,
  MealSlot,
  MealSuggestionContext,
} from '@/types/mealSuggestion';

export const FALLBACK_DAILY_TARGETS: MacroBudget = {
  calories: 2000,
  proteinGrams: 150,
  carbsGrams: 250,
  fatGrams: 65,
};

export function mealSlotFromDate(date: Date = new Date()): MealSlot {
  const hour = date.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  return 'dinner';
}

export function remainingMealCount(slot: MealSlot): number {
  if (slot === 'breakfast') return 3;
  if (slot === 'lunch') return 2;
  return 1;
}

export function mealSlotMessageKey(
  slot: MealSlot,
): 'plan.breakfast' | 'plan.lunch' | 'plan.dinner' {
  if (slot === 'breakfast') return 'plan.breakfast';
  if (slot === 'lunch') return 'plan.lunch';
  return 'plan.dinner';
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toHistoryItem(item: SavedNutrition): MealHistoryItem {
  return {
    foodName: item.foodName,
    calories: Math.round(item.calories),
    proteinGrams: Math.round(item.macros.protein),
    carbsGrams: Math.round(item.macros.carbs),
    fatGrams: Math.round(item.macros.fat),
    hour: item.createdAt != null ? new Date(item.createdAt).getHours() : null,
  };
}

function emptyBudget(): MacroBudget {
  return { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 };
}

function sumHistory(items: MealHistoryItem[]): MacroBudget {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      proteinGrams: acc.proteinGrams + item.proteinGrams,
      carbsGrams: acc.carbsGrams + item.carbsGrams,
      fatGrams: acc.fatGrams + item.fatGrams,
    }),
    emptyBudget(),
  );
}

function remainingBudget(daily: MacroBudget, eaten: MacroBudget): MacroBudget {
  return {
    calories: Math.max(0, Math.round(daily.calories - eaten.calories)),
    proteinGrams: Math.max(0, Math.round(daily.proteinGrams - eaten.proteinGrams)),
    carbsGrams: Math.max(0, Math.round(daily.carbsGrams - eaten.carbsGrams)),
    fatGrams: Math.max(0, Math.round(daily.fatGrams - eaten.fatGrams)),
  };
}

function typicalShare(slot: MealSlot): number {
  if (slot === 'breakfast') return 0.28;
  if (slot === 'lunch') return 0.36;
  return 0.36;
}

function scaleBudget(budget: MacroBudget, factor: number): MacroBudget {
  return {
    calories: Math.round(budget.calories * factor),
    proteinGrams: Math.round(budget.proteinGrams * factor),
    carbsGrams: Math.round(budget.carbsGrams * factor),
    fatGrams: Math.round(budget.fatGrams * factor),
  };
}

function slotBudgetFor(params: {
  daily: MacroBudget;
  remaining: MacroBudget;
  slot: MealSlot;
}): MacroBudget {
  const typical = scaleBudget(params.daily, typicalShare(params.slot));
  const mealCalories = Math.min(700, Math.max(320, typical.calories));
  const remainingCalories = params.remaining.calories;
  const looksUnlogged = remainingCalories >= params.daily.calories * 0.8;
  const calories = looksUnlogged
    ? mealCalories
    : remainingCalories < 350
      ? Math.max(160, remainingCalories)
      : Math.min(mealCalories, Math.round(remainingCalories * 0.6));
  const factor = typical.calories > 0 ? calories / typical.calories : 1;
  return {
    calories: Math.round(calories),
    proteinGrams: Math.max(10, Math.round(typical.proteinGrams * factor)),
    carbsGrams: Math.max(16, Math.round(typical.carbsGrams * factor)),
    fatGrams: Math.max(7, Math.round(typical.fatGrams * factor)),
  };
}

function dailyTargetsFromProfile(profile: SavedUserProfile | null): MacroBudget {
  const rec = profile?.recommendation;
  if (!rec) return FALLBACK_DAILY_TARGETS;
  return {
    calories: rec.calories,
    proteinGrams: rec.proteinGrams,
    carbsGrams: rec.carbsGrams,
    fatGrams: rec.fatGrams,
  };
}

function goalFromProfile(profile: SavedUserProfile | null): WeightGoal {
  return profile?.onboarding?.goal ?? 'maintain';
}

export function buildMealSuggestionContext(params: {
  profile: SavedUserProfile | null;
  analyses: SavedNutrition[];
  dietFilter: string;
  cuisineFilter?: string;
  mealSlot?: MealSlot;
  now?: Date;
}): MealSuggestionContext {
  const now = params.now ?? new Date();
  const mealSlot = params.mealSlot ?? mealSlotFromDate(now);
  const remainingMeals = remainingMealCount(mealSlot);
  const daily = dailyTargetsFromProfile(params.profile);

  const sorted = [...params.analyses].sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );
  const eatenToday = sorted
    .filter(
      (item) =>
        item.createdAt != null && sameDay(new Date(item.createdAt), now),
    )
    .map(toHistoryItem);
  const recentMeals = sorted.slice(0, 14).map(toHistoryItem);
  const remaining = remainingBudget(daily, sumHistory(eatenToday));

  return {
    mealSlot,
    dietFilter: params.dietFilter,
    cuisineFilter: params.cuisineFilter?.trim() || 'Any',
    goal: goalFromProfile(params.profile),
    daily,
    remaining,
    slotBudget: slotBudgetFor({ daily, remaining, slot: mealSlot }),
    remainingMeals,
    eatenToday,
    recentMeals,
  };
}
