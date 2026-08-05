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
import type { Recipe } from '@/types/recipe';

export type SavedRecipe = Recipe & { id: string };

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

