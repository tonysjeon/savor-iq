import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SavedNutrition, SavedRecipe } from '@/lib/firestore';

type HistoryCache = {
  recipes: SavedRecipe[];
  analyses: SavedNutrition[];
  updatedAt: number;
};

type HistoryListener = (uid: string) => void;

const memory = new Map<string, HistoryCache>();
const listeners = new Set<HistoryListener>();

function storageKey(uid: string) {
  return `userHistory:${uid}`;
}

function emptyCache(): HistoryCache {
  return { recipes: [], analyses: [], updatedAt: 0 };
}

function notifyHistory(uid: string) {
  listeners.forEach((listener) => listener(uid));
}

/** Subscribe to cache writes so Home macros update when a meal is saved. */
export function subscribeHistoryCache(listener: HistoryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getHistoryCacheSync(uid: string): HistoryCache | null {
  return memory.get(uid) ?? null;
}

export async function loadHistoryCache(uid: string): Promise<HistoryCache | null> {
  const fromMemory = memory.get(uid);
  if (fromMemory) return fromMemory;

  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HistoryCache;
    if (!parsed || !Array.isArray(parsed.recipes) || !Array.isArray(parsed.analyses)) {
      return null;
    }
    memory.set(uid, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function saveHistoryCache(
  uid: string,
  next: Partial<HistoryCache>,
): Promise<HistoryCache> {
  const current = memory.get(uid) ?? emptyCache();
  const merged: HistoryCache = {
    recipes: next.recipes ?? current.recipes,
    analyses: next.analyses ?? current.analyses,
    updatedAt: Date.now(),
  };
  memory.set(uid, merged);
  try {
    await AsyncStorage.setItem(storageKey(uid), JSON.stringify(merged));
  } catch {
    // Memory cache still helps within the session.
  }
  notifyHistory(uid);
  return merged;
}

export function getCachedAnalysis(
  uid: string,
  analysisId: string,
): SavedNutrition | null {
  const cache = memory.get(uid);
  if (!cache) return null;
  return cache.analyses.find((item) => item.id === analysisId) ?? null;
}

export async function setCachedRecipes(
  uid: string,
  recipes: SavedRecipe[],
): Promise<void> {
  await saveHistoryCache(uid, { recipes });
}

export async function setCachedAnalyses(
  uid: string,
  analyses: SavedNutrition[],
): Promise<void> {
  await saveHistoryCache(uid, { analyses });
}

/** Stable-ish key so a local pending meal can match its cloud copy. */
export function analysisFingerprint(item: SavedNutrition): string {
  const minute =
    item.createdAt != null ? Math.floor(item.createdAt / 60_000) : 'none';
  return [
    item.foodName.trim().toLowerCase(),
    Math.round(item.calories),
    Math.round(item.macros.protein),
    Math.round(item.macros.carbs),
    Math.round(item.macros.fat),
    minute,
  ].join('|');
}

/** Keep in-flight local meals only when the network list does not already include them. */
export function mergeAnalysesWithPending(
  network: SavedNutrition[],
  existing: SavedNutrition[] | undefined,
): SavedNutrition[] {
  const transient = (existing ?? []).filter(
    (item) =>
      item.id.startsWith('pending-') || item.id.startsWith('processing-'),
  );
  if (transient.length === 0) return network;

  const networkFingerprints = new Set(network.map(analysisFingerprint));
  const keepTransient = transient.filter(
    (item) => !networkFingerprints.has(analysisFingerprint(item)),
  );
  return [...keepTransient, ...network];
}

/** Drop accidental duplicate meals (pending+saved, or double cloud writes). */
export function dedupeAnalyses(items: SavedNutrition[]): SavedNutrition[] {
  const seenIds = new Set<string>();
  const kept: SavedNutrition[] = [];

  for (const item of items) {
    if (seenIds.has(item.id)) continue;

    const fp = analysisFingerprint(item);
    const duplicateIndex = kept.findIndex((other) => {
      if (analysisFingerprint(other) !== fp) return false;
      if (item.createdAt == null || other.createdAt == null) return true;
      return Math.abs(item.createdAt - other.createdAt) < 120_000;
    });

    if (duplicateIndex >= 0) {
      const duplicate = kept[duplicateIndex];
      // Prefer a real Firestore document over any local in-flight placeholder.
      const duplicateIsTransient =
        duplicate.id.startsWith('pending-') || duplicate.id.startsWith('processing-');
      const itemIsTransient =
        item.id.startsWith('pending-') || item.id.startsWith('processing-');
      if (duplicateIsTransient && !itemIsTransient) {
        kept[duplicateIndex] = item;
        seenIds.add(item.id);
      }
      continue;
    }

    seenIds.add(item.id);
    kept.push(item);
  }

  return kept;
}

export async function prependCachedRecipe(
  uid: string,
  recipe: SavedRecipe,
  max = 10,
): Promise<void> {
  const current = (await loadHistoryCache(uid)) ?? emptyCache();
  const recipes = [recipe, ...current.recipes.filter((r) => r.id !== recipe.id)].slice(
    0,
    max,
  );
  await setCachedRecipes(uid, recipes);
}

export async function prependCachedAnalysis(
  uid: string,
  analysis: SavedNutrition,
  max = 20,
): Promise<void> {
  const current = (await loadHistoryCache(uid)) ?? emptyCache();
  const isTransient =
    analysis.id.startsWith('pending-') || analysis.id.startsWith('processing-');
  const existing = isTransient
    ? current.analyses
    : current.analyses.filter(
        (item) =>
          !(
            (item.id.startsWith('pending-') || item.id.startsWith('processing-')) &&
            analysisFingerprint(item) === analysisFingerprint(analysis)
          ),
      );
  const analyses = [
    analysis,
    ...existing.filter((item) => item.id !== analysis.id),
  ].slice(0, max);
  await setCachedAnalyses(uid, analyses);
}

export async function removeCachedAnalysis(
  uid: string,
  analysisId: string,
): Promise<void> {
  const current = (await loadHistoryCache(uid)) ?? emptyCache();
  await setCachedAnalyses(
    uid,
    current.analyses.filter((item) => item.id !== analysisId),
  );
}
