import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Recipe } from '@/types/recipe';

const STORAGE_KEY = 'recentRecipes';
const MAX_RECENT = 5;

function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.title === 'string' &&
    Array.isArray(r.ingredients) &&
    Array.isArray(r.steps) &&
    typeof r.imageUrl === 'string' &&
    typeof r.nutrition === 'string' &&
    typeof r.preparationMethod === 'string' &&
    typeof r.servings === 'number'
  );
}

export async function loadRecentRecipes(): Promise<Recipe[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecipe).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export async function saveRecentRecipes(recipes: Recipe[]): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(recipes.slice(0, MAX_RECENT)),
  );
}

export function prependRecentRecipe(
  recipes: Recipe[],
  recipe: Recipe,
): Recipe[] {
  return [recipe, ...recipes].slice(0, MAX_RECENT);
}
