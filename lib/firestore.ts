import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';

import { db, storage } from '@/lib/firebase';
import type { ExerciseIntensity, TimedExerciseKind } from '@/lib/exerciseCalories';
import {
  prependCachedAnalysis,
  prependCachedExercise,
  prependCachedRecipe,
  removeCachedAnalysis,
  removeCachedExercise,
  setCachedAnalyses,
  setCachedExercises,
  setCachedRecipes,
  getHistoryCacheSync,
  mergeAnalysesWithPending,
  dedupeAnalyses,
} from '@/lib/userHistoryCache';
import type { NutritionRecommendation, OnboardingProfile } from '@/lib/onboarding';
import type { NutritionInfo } from '@/types/nutrition';
import type { Recipe } from '@/types/recipe';

export type SavedRecipe = Recipe & { id: string };
export type SavedNutrition = NutritionInfo & {
  id: string;
  createdAt: number | null;
};

export type ExerciseSource = 'describe' | 'manual' | TimedExerciseKind;

export type SavedExercise = {
  id: string;
  activity: string;
  calories: number;
  durationMinutes: number;
  intensity: ExerciseIntensity;
  summary: string;
  description: string;
  createdAt: number;
  source: ExerciseSource;
};

export type SaveExerciseOptions = {
  /** When true, write Firestore only — caller updates local cache after UI handoff. */
  skipCache?: boolean;
};

export type SavedUserProfile = {
  name: string;
  email: string;
  onboarding?: OnboardingProfile;
  recommendation?: NutritionRecommendation;
  onboardingCompletedAt?: number | null;
};

export type SaveNutritionOptions = {
  imageBase64?: string;
  localImageUri?: string;
  /** When true, write Firestore only — caller updates local cache after UI handoff. */
  skipCache?: boolean;
};

function requireDb() {
  if (!db) {
    throw new Error(
      'Firestore is not available. Check EXPO_PUBLIC_FIREBASE_* and enable Firestore in the Firebase console.',
    );
  }
  return db;
}

async function uploadMealImage(uid: string, base64: string): Promise<string | null> {
  if (!storage) return null;
  try {
    const path = `users/${uid}/meals/${Date.now()}.jpg`;
    const objectRef = ref(storage, path);
    await uploadString(objectRef, base64, 'base64', {
      contentType: 'image/jpeg',
    });
    return await getDownloadURL(objectRef);
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function toMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (
    value &&
    typeof value === 'object' &&
    'seconds' in value &&
    typeof (value as { seconds: number }).seconds === 'number'
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return null;
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
      sugar: typeof macros.sugar === 'number' ? macros.sugar : 0,
      sodium: typeof macros.sodium === 'number' ? macros.sodium : 0,
    },
    healthScore: typeof data.healthScore === 'number' ? data.healthScore : 0,
    description: typeof data.description === 'string' ? data.description : '',
    nutritionTips: asStringArray(data.nutritionTips),
    foodPresenceConfidence:
      typeof data.foodPresenceConfidence === 'number'
        ? data.foodPresenceConfidence
        : undefined,
    identificationConfidence:
      typeof data.identificationConfidence === 'number'
        ? data.identificationConfidence
        : undefined,
    remainingFraction:
      typeof data.remainingFraction === 'number'
        ? data.remainingFraction
        : undefined,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
    createdAt:
      toMillis(data.createdAtMs) ?? toMillis(data.createdAt),
  };
}

function parseExerciseSource(value: unknown): ExerciseSource | null {
  if (value === 'describe' || value === 'manual' || value === 'run' || value === 'weights') {
    return value;
  }
  return null;
}

function parseExerciseIntensity(value: unknown): ExerciseIntensity {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
}

function parseExercise(
  id: string,
  data: Record<string, unknown>,
): SavedExercise | null {
  const source = parseExerciseSource(data.source);
  const createdAt = toMillis(data.createdAtMs) ?? toMillis(data.createdAt);
  if (!source || createdAt == null) return null;

  const calories = typeof data.calories === 'number' ? data.calories : 0;
  const activity =
    typeof data.activity === 'string'
      ? data.activity
      : source === 'run'
        ? 'Run'
        : source === 'weights'
          ? 'Weight lifting'
          : source === 'manual'
            ? 'Manual'
            : 'Exercise';

  return {
    id,
    activity,
    calories,
    durationMinutes:
      typeof data.durationMinutes === 'number' ? data.durationMinutes : 0,
    intensity: parseExerciseIntensity(data.intensity),
    summary: typeof data.summary === 'string' ? data.summary : '',
    description:
      typeof data.description === 'string' ? data.description : activity,
    createdAt,
    source,
  };
}

export async function saveUserProfile(params: {
  uid: string;
  name: string;
  email: string;
  onboarding?: OnboardingProfile;
  recommendation?: NutritionRecommendation;
}): Promise<void> {
  const firestore = requireDb();
  await setDoc(
    doc(firestore, 'users', params.uid),
    {
      name: params.name,
      email: params.email,
      ...(params.onboarding
        ? {
            onboarding: params.onboarding,
            nutritionRecommendation: params.recommendation,
            onboardingCompletedAt: serverTimestamp(),
          }
        : {}),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getUserProfile(uid: string): Promise<SavedUserProfile | null> {
  const firestore = requireDb();
  const snapshot = await getDoc(doc(firestore, 'users', uid));
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as Record<string, unknown>;
  return {
    name: typeof data.name === 'string' ? data.name : '',
    email: typeof data.email === 'string' ? data.email : '',
    onboarding:
      data.onboarding && typeof data.onboarding === 'object'
        ? (data.onboarding as OnboardingProfile)
        : undefined,
    recommendation:
      data.nutritionRecommendation && typeof data.nutritionRecommendation === 'object'
        ? (data.nutritionRecommendation as NutritionRecommendation)
        : undefined,
    onboardingCompletedAt: toMillis(data.onboardingCompletedAt),
  };
}

export async function deleteUserProfile(uid: string): Promise<void> {
  const firestore = requireDb();
  await deleteDoc(doc(firestore, 'users', uid));
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
  await prependCachedRecipe(uid, { ...recipe, id: ref.id });
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

  const recipes = snapshot.docs
    .map((item) => parseRecipe(item.id, item.data() as Record<string, unknown>))
    .filter((item): item is SavedRecipe => item !== null);

  await setCachedRecipes(uid, recipes);
  return recipes;
}

export async function saveNutritionAnalysis(
  uid: string,
  info: NutritionInfo,
  options: SaveNutritionOptions = {},
): Promise<string> {
  const firestore = requireDb();

  let imageUrl = options.localImageUri || info.imageUrl || '';
  if (options.imageBase64) {
    const uploaded = await uploadMealImage(uid, options.imageBase64);
    if (uploaded) imageUrl = uploaded;
  }

  const createdAtMs = Date.now();
  const payload = {
    foodName: info.foodName,
    calories: info.calories,
    macros: info.macros,
    healthScore: info.healthScore,
    description: info.description,
    nutritionTips: info.nutritionTips,
    ...(info.foodPresenceConfidence != null
      ? { foodPresenceConfidence: info.foodPresenceConfidence }
      : {}),
    ...(info.identificationConfidence != null
      ? { identificationConfidence: info.identificationConfidence }
      : {}),
    ...(info.remainingFraction != null
      ? { remainingFraction: info.remainingFraction }
      : {}),
    ...(imageUrl ? { imageUrl } : {}),
    createdAt: serverTimestamp(),
    createdAtMs,
  };

  const docRef = await addDoc(
    collection(firestore, 'users', uid, 'analyses'),
    payload,
  );
  if (!options.skipCache) {
    await prependCachedAnalysis(uid, {
      ...info,
      id: docRef.id,
      imageUrl: imageUrl || undefined,
      createdAt: createdAtMs,
    });
  }
  return docRef.id;
}

export async function getNutritionAnalysis(
  uid: string,
  analysisId: string,
): Promise<SavedNutrition | null> {
  const firestore = requireDb();
  const snapshot = await getDoc(
    doc(firestore, 'users', uid, 'analyses', analysisId),
  );
  if (!snapshot.exists()) return null;
  return parseNutrition(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export async function deleteNutritionAnalysis(
  uid: string,
  analysisId: string,
): Promise<void> {
  const firestore = requireDb();
  if (
    !analysisId.startsWith('processing-') &&
    !analysisId.startsWith('pending-')
  ) {
    await deleteDoc(doc(firestore, 'users', uid, 'analyses', analysisId));
  }
  await removeCachedAnalysis(uid, analysisId);
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

  const analyses = snapshot.docs
    .map((item) =>
      parseNutrition(item.id, item.data() as Record<string, unknown>),
    )
    .filter((item): item is SavedNutrition => item !== null);

  const existing = getHistoryCacheSync(uid)?.analyses;
  const merged = dedupeAnalyses(mergeAnalysesWithPending(analyses, existing));
  await setCachedAnalyses(uid, merged);
  return merged;
}

export async function saveExercise(
  uid: string,
  exercise: SavedExercise,
  options: SaveExerciseOptions = {},
): Promise<string> {
  const firestore = requireDb();
  const createdAtMs = exercise.createdAt || Date.now();
  const payload = {
    activity: exercise.activity,
    calories: exercise.calories,
    durationMinutes: exercise.durationMinutes,
    intensity: exercise.intensity,
    summary: exercise.summary,
    description: exercise.description,
    source: exercise.source,
    createdAt: serverTimestamp(),
    createdAtMs,
  };

  const docRef = await addDoc(
    collection(firestore, 'users', uid, 'exercises'),
    payload,
  );
  if (!options.skipCache) {
    await prependCachedExercise(uid, { ...exercise, id: docRef.id, createdAt: createdAtMs });
  }
  return docRef.id;
}

export async function deleteExercise(
  uid: string,
  exerciseId: string,
): Promise<void> {
  const firestore = requireDb();
  if (!exerciseId.startsWith('exercise-') && !exerciseId.startsWith('processing-')) {
    await deleteDoc(doc(firestore, 'users', uid, 'exercises', exerciseId));
  }
  await removeCachedExercise(uid, exerciseId);
}

export async function listExercises(
  uid: string,
  max = 20,
): Promise<SavedExercise[]> {
  const firestore = requireDb();
  const snapshot = await getDocs(
    query(
      collection(firestore, 'users', uid, 'exercises'),
      orderBy('createdAt', 'desc'),
      limit(max),
    ),
  );

  const exercises = snapshot.docs
    .map((item) => parseExercise(item.id, item.data() as Record<string, unknown>))
    .filter((item): item is SavedExercise => item !== null);

  const existing = getHistoryCacheSync(uid)?.exercises ?? [];
  const existingIds = new Set(exercises.map((item) => item.id));
  const keepLocal = existing.filter(
    (item) =>
      item.id.startsWith('exercise-') &&
      !existingIds.has(item.id) &&
      !exercises.some(
        (saved) =>
          saved.source === item.source &&
          saved.calories === item.calories &&
          Math.abs(saved.createdAt - item.createdAt) < 120_000,
      ),
  );
  const merged = [...keepLocal, ...exercises].sort((a, b) => b.createdAt - a.createdAt);
  await setCachedExercises(uid, merged);
  return merged;
}
