import {
  getNutritionAnalysis,
  type SavedNutrition,
} from '@/lib/firestore';
import {
  getMealAnalysisJob,
  listMealAnalysisJobs,
} from '@/lib/mealAnalysisQueue';
import { getCachedAnalysis, loadHistoryCache } from '@/lib/userHistoryCache';

/** Resolve a meal from in-flight jobs, local cache, then Firestore. */
export async function lookupSavedNutrition(
  uid: string,
  analysisId: string,
): Promise<SavedNutrition | null> {
  const job = getMealAnalysisJob(analysisId);
  if (job?.result) return job.result;

  for (const item of listMealAnalysisJobs()) {
    if (item.result?.id === analysisId) return item.result;
  }

  const sync = getCachedAnalysis(uid, analysisId);
  if (sync) return sync;

  const disk = await loadHistoryCache(uid);
  const fromDisk = disk?.analyses.find((item) => item.id === analysisId);
  if (fromDisk) return fromDisk;

  if (analysisId.startsWith('processing-') || analysisId.startsWith('pending-')) {
    return null;
  }

  return getNutritionAnalysis(uid, analysisId);
}
