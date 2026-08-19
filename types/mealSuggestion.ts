import type { WeightGoal } from '@/lib/onboarding';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export type MacroBudget = {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
};

export type MealHistoryItem = {
  foodName: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  hour: number | null;
};

export type MealSuggestion = {
  mealSlot: MealSlot;
  title: string;
  reason: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  swaps: string[];
};

export type MealSuggestionContext = {
  mealSlot: MealSlot;
  dietFilter: string;
  cuisineFilter: string;
  goal: WeightGoal;
  daily: MacroBudget;
  remaining: MacroBudget;
  slotBudget: MacroBudget;
  remainingMeals: number;
  eatenToday: MealHistoryItem[];
  recentMeals: MealHistoryItem[];
};
