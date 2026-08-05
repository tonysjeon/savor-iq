import type { CapturedMealPhoto } from '@/components/MealCamera';
import type { NutritionInfo } from '@/types/nutrition';

export type AnalyzeSource = 'camera' | 'gallery';

export type AnalyzeSession = {
  photo: CapturedMealPhoto;
  source: AnalyzeSource;
  nutrition: NutritionInfo | null;
  saveWarning: string | null;
};

let session: AnalyzeSession | null = null;

export function startAnalyzeSession(
  photo: CapturedMealPhoto,
  source: AnalyzeSource,
): AnalyzeSession {
  session = {
    photo,
    source,
    nutrition: null,
    saveWarning: null,
  };
  return session;
}

export function getAnalyzeSession(): AnalyzeSession | null {
  return session;
}

export function setAnalyzeResult(
  nutrition: NutritionInfo,
  saveWarning: string | null = null,
): void {
  if (!session) return;
  session = {
    ...session,
    nutrition,
    saveWarning,
  };
}

export function clearAnalyzeSession(): void {
  session = null;
}
