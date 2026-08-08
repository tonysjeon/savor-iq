import type { CapturedMealPhoto } from '@/components/MealCamera';
import type { AnalyzeSource } from '@/lib/analyzeSession';
import {
  deleteNutritionAnalysis,
  saveNutritionAnalysis,
  type SavedNutrition,
} from '@/lib/firestore';
import {
  analyzeNutritionFromImage,
  isFoodNotDetectedError,
} from '@/lib/gemini';
import { prepareMealPhotos } from '@/lib/mealPhoto';
import { prependCachedAnalysis } from '@/lib/userHistoryCache';

export type MealAnalysisJobStatus = 'processing' | 'ready' | 'error';
export type MealAnalysisErrorKind = 'food_not_detected' | 'generic';

export type MealAnalysisJob = {
  id: string;
  status: MealAnalysisJobStatus;
  photo: CapturedMealPhoto;
  source: AnalyzeSource;
  userId: string | null;
  createdAt: number;
  error?: string;
  errorKind?: MealAnalysisErrorKind;
  /** Persistence failed after a successful on-device analysis. */
  saveError?: string;
  /** Staged upload/analysis progress from 0 to 100. */
  progress: number;
  /** Filled when analysis completes — same card flips from skeleton to this. */
  result?: SavedNutrition;
};

type JobListener = () => void;

const jobs = new Map<string, MealAnalysisJob>();
const listeners = new Set<JobListener>();
const running = new Set<string>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setJob(job: MealAnalysisJob) {
  jobs.set(job.id, job);
  notify();
}

function removeJob(id: string) {
  jobs.delete(id);
  notify();
}

export function subscribeMealAnalysisJobs(listener: JobListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Active jobs, newest first. */
export function listMealAnalysisJobs(): MealAnalysisJob[] {
  return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function getMealAnalysisJob(id: string): MealAnalysisJob | null {
  return jobs.get(id) ?? null;
}

/** Drop ready jobs once Home history already contains their saved meal. */
export function pruneReadyJobs(savedIds: Set<string>): void {
  let changed = false;
  for (const [id, job] of jobs) {
    const resultId = job.result?.id;
    const isPersisted =
      resultId != null &&
      !resultId.startsWith('processing-') &&
      !resultId.startsWith('pending-');
    if (
      job.status === 'ready' &&
      resultId &&
      isPersisted &&
      savedIds.has(resultId)
    ) {
      jobs.delete(id);
      changed = true;
    }
  }
  if (changed) notify();
}

async function runJob(id: string): Promise<void> {
  if (running.has(id)) return;
  const job = jobs.get(id);
  if (!job) return;

  running.add(id);
  setJob({
    ...job,
    status: 'processing',
    error: undefined,
    errorKind: undefined,
    result: undefined,
    saveError: undefined,
    progress: 10,
  });

  try {
    const latest = jobs.get(id) ?? job;
    const prepared = await prepareMealPhotos(latest.photo);
    if (!jobs.has(id)) return;

    setJob({
      ...latest,
      status: 'processing',
      error: undefined,
      errorKind: undefined,
      result: undefined,
      saveError: undefined,
      progress: 30,
    });

    const info = await analyzeNutritionFromImage(
      prepared.analysis.base64,
      prepared.analysis.mimeType,
    );
    if (!jobs.has(id)) return;

    const userId = jobs.get(id)?.userId ?? latest.userId;
    // Keep the same local source through the processing-to-saved card swap so
    // React Native does not briefly clear and reload the thumbnail.
    const imageUrl = latest.photo.uri;
    const createdAtMs = Date.now();

    // Fill the same card immediately; persist in the background after.
    const provisional: SavedNutrition = {
      ...info,
      id,
      imageUrl,
      createdAt: createdAtMs,
    };
    setJob({
      ...(jobs.get(id) ?? latest),
      status: 'ready',
      error: undefined,
      errorKind: undefined,
      result: provisional,
      saveError: undefined,
      progress: 75,
    });

    if (!userId) return;
    // Publish the estimate immediately so Home and Calendar totals update while
    // the cloud image/document upload completes.
    await prependCachedAnalysis(userId, provisional);
    if (!jobs.has(id)) return;

    // Analysis is complete and the meal is now available throughout the app.
    // Cloud persistence continues in the background and must not hold the
    // user-facing processing indicator below 100%.
    setJob({ ...(jobs.get(id) ?? latest), progress: 100 });

    try {
      const docId = await saveNutritionAnalysis(userId, info, {
        imageBase64: prepared.display.base64,
        localImageUri: prepared.display.uri,
        skipCache: true,
      });
      if (!jobs.has(id)) {
        // The user deleted the temporary meal while its cloud save was in
        // flight. Remove the just-created document instead of resurrecting it.
        await deleteNutritionAnalysis(userId, docId);
        return;
      }

      const saved: SavedNutrition = {
        ...provisional,
        id: docId,
        imageUrl: imageUrl || provisional.imageUrl,
      };
      setJob({
        ...(jobs.get(id) ?? latest),
        status: 'ready',
        error: undefined,
        errorKind: undefined,
        result: saved,
        saveError: undefined,
        progress: 100,
      });
      await prependCachedAnalysis(userId, saved);
    } catch (saveErr) {
      const current = jobs.get(id);
      if (!current) return;
      const message =
        saveErr instanceof Error ? saveErr.message : 'Could not save meal.';
      // Keep the analysis result visible, but do not silently hide a cloud
      // persistence failure behind an otherwise successful card.
      if (current.status === 'ready' && current.result) {
        setJob({ ...current, saveError: message });
      } else {
        setJob({
          ...current,
          status: 'error',
          error: message,
          errorKind: 'generic',
          result: undefined,
        });
      }
      // Keep the completed local meal in Home and Calendar. A cloud transport
      // failure should not make an already processed meal disappear.
    }
  } catch (err) {
    const current = jobs.get(id);
    if (!current) return;
    const foodNotDetected = isFoodNotDetectedError(err);
    setJob({
      ...current,
      status: 'error',
      error: foodNotDetected
        ? 'No Food Detected'
        : err instanceof Error
          ? err.message
          : 'Analysis failed.',
      errorKind: foodNotDetected ? 'food_not_detected' : 'generic',
      result: undefined,
    });
  } finally {
    running.delete(id);
  }
}

/** Queue a meal photo and start Gemini in the background. Returns home-facing job id. */
export function enqueueMealAnalysis(params: {
  photo: CapturedMealPhoto;
  source: AnalyzeSource;
  userId: string | null;
}): string {
  const id = `processing-${Date.now()}`;
  const job: MealAnalysisJob = {
    id,
    status: 'processing',
    photo: params.photo,
    source: params.source,
    userId: params.userId,
    createdAt: Date.now(),
    progress: 5,
  };
  setJob(job);
  void runJob(id);
  return id;
}

export function retryMealAnalysis(id: string): void {
  const job = jobs.get(id);
  if (!job) return;
  void runJob(id);
}

export function dismissMealAnalysis(id: string): void {
  removeJob(id);
}
