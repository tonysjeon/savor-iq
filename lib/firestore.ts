import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { NutritionInfo } from '@/types/nutrition';
import type { Recipe } from '@/types/recipe';

export type SavedRecipe = Recipe & { id: string };
export type SavedNutrition = NutritionInfo & { id: string };

function requireDb() {
  if (!db) {
    throw new Error(
      'Firestore is not available. Check EXPO_PUBLIC_FIREBASE_* and enable Firestore in the Firebase console.',
    );
  }
  return db;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function parseRecipe(id: string, data: Record<string, unknown>): SavedRecipe | null {
  if (typeof data.title !== 'string') return null;
  return {
    id,
    title: data.title,
    ingredients: asStringArray(data.ingredients),
    steps: asStringArray(data.steps),
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
    nutrition: typeof data.nutrition === 'string' ? data.nutrition : '',
    preparationMethod:
      typeof data.preparationMethod === 'string' ? data.preparationMethod : 'Any Method',
    servings: typeof data.servings === 'number' ? data.servings : 2,
  };
}

function parseNutrition(
  id: string,
  data: Record<string, unknown>,
): SavedNutrition | null {
  if (typeof data.foodName !== 'string') return null;
  const macros =
    data.macros && typeof data.macros === 'object'
      ? (data.macros as Record<string, unknown>)
      : {};

  return {
    id,
    foodName: data.foodName,
    calories: typeof data.calories === 'number' ? data.calories : 0,
    macros: {
      protein: typeof macros.protein === 'number' ? macros.protein : 0,
      carbs: typeof macros.carbs === 'number' ? macros.carbs : 0,
      fat: typeof macros.fat === 'number' ? macros.fat : 0,
      fiber: typeof macros.fiber === 'number' ? macros.fiber : 0,
    },
    healthScore: typeof data.healthScore === 'number' ? data.healthScore : 0,
    description: typeof data.description === 'string' ? data.description : '',
    nutritionTips: asStringArray(data.nutritionTips),
  };
}

export async function saveUserProfile(params: {
  uid: string;
  name: string;
  email: string;
}): Promise<void> {
  const firestore = requireDb();
  await setDoc(
    doc(firestore, 'users', params.uid),
    {
      name: params.name,
      email: params.email,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveRecipe(uid: string, recipe: Recipe): Promise<string> {
  const firestore = requireDb();
  const ref = await addDoc(collection(firestore, 'users', uid, 'recipes'), {
    title: recipe.title,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    imageUrl: recipe.imageUrl,
    nutrition: recipe.nutrition,
    preparationMethod: recipe.preparationMethod,
    servings: recipe.servings,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listRecipes(
  uid: string,
  max = 20,
): Promise<SavedRecipe[]> {
  const firestore = requireDb();
  const snapshot = await getDocs(
    query(
      collection(firestore, 'users', uid, 'recipes'),
      orderBy('createdAt', 'desc'),
      limit(max),
    ),
  );

  return snapshot.docs
    .map((item) => parseRecipe(item.id, item.data() as Record<string, unknown>))
    .filter((item): item is SavedRecipe => item !== null);
}

export async function saveNutritionAnalysis(
  uid: string,
  info: NutritionInfo,
): Promise<string> {
  const firestore = requireDb();
  const ref = await addDoc(collection(firestore, 'users', uid, 'analyses'), {
    foodName: info.foodName,
    calories: info.calories,
    macros: info.macros,
    healthScore: info.healthScore,
    description: info.description,
    nutritionTips: info.nutritionTips,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listNutritionAnalyses(
  uid: string,
  max = 20,
): Promise<SavedNutrition[]> {
  const firestore = requireDb();
  const snapshot = await getDocs(
    query(
      collection(firestore, 'users', uid, 'analyses'),
      orderBy('createdAt', 'desc'),
      limit(max),
    ),
  );

  return snapshot.docs
    .map((item) =>
      parseNutrition(item.id, item.data() as Record<string, unknown>),
    )
    .filter((item): item is SavedNutrition => item !== null);
}
