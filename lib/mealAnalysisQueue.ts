import type { CapturedMealPhoto } from '@/components/MealCamera';
import type { AnalyzeSource } from '@/lib/analyzeSession';
import {
  saveNutritionAnalysis,
  type SavedNutrition,
} from '@/lib/firestore';
import { analyzeNutritionFromImage } from '@/lib/gemini';
import { prepareMealPhotoForAnalysis } from '@/lib/mealPhoto';
import { prependCachedAnalysis } from '@/lib/userHistoryCache';

export type MealAnalysisJobStatus = 'processing' | 'ready' | 'error';

export type MealAnalysisJob = {
  id: string;
  status: MealAnalysisJobStatus;
  photo: CapturedMealPhoto;
  source: AnalyzeSource;
  userId: string | null;
  createdAt: number;
  error?: string;
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
    if (job.status === 'ready' && job.result && savedIds.has(job.result.id)) {
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
  setJob({ ...job, status: 'processing', error: undefined, result: undefined });

  try {
    const latest = jobs.get(id) ?? job;
    const prepared = await prepareMealPhotoForAnalysis(latest.photo);
    if (!jobs.has(id)) return;

    setJob({
      ...latest,
      photo: prepared,
      status: 'processing',
      error: undefined,
      result: undefined,
    });

    const info = await analyzeNutritionFromImage(
      prepared.base64,
      prepared.mimeType,
    );
    if (!jobs.has(id)) return;

    const userId = jobs.get(id)?.userId ?? latest.userId;
    const imageUrl = prepared.uri;
    const createdAtMs = Date.now();

    let result: SavedNutrition;
    if (userId) {
      const docId = await saveNutritionAnalysis(userId, info, {
        imageBase64: prepared.base64,
        localImageUri: prepared.uri,
        skipCache: true,
      });
      result = {
        ...info,
        id: docId,
        imageUrl,
        createdAt: createdAtMs,
      };
    } else {
      result = {
        ...info,
        id,
        imageUrl,
        createdAt: createdAtMs,
      };
    }

    if (!jobs.has(id)) return;

    // Flip this same card to the completed meal before history updates.
    setJob({
      ...(jobs.get(id) ?? latest),
      photo: prepared,
      status: 'ready',
      error: undefined,
      result: {
        ...result,
        imageUrl: result.imageUrl || prepared.uri,
      },
    });

    if (userId) {
      await prependCachedAnalysis(userId, {
        ...result,
        imageUrl: result.imageUrl || prepared.uri,
      });
    }  } catch (err) {
    const current = jobs.get(id);
    if (!current) return;
    setJob({
      ...current,
      status: 'error',
      error: err instanceof Error ? err.message : 'Analysis failed.',
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
