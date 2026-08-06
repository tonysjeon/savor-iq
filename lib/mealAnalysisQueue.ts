import type { CapturedMealPhoto } from '@/components/MealCamera';
import type { AnalyzeSource } from '@/lib/analyzeSession';
import { saveNutritionAnalysis } from '@/lib/firestore';
import { analyzeNutritionFromImage } from '@/lib/gemini';
import { prepareMealPhotoForAnalysis } from '@/lib/mealPhoto';

export type MealAnalysisJobStatus = 'processing' | 'error';

export type MealAnalysisJob = {
  id: string;
  status: MealAnalysisJobStatus;
  photo: CapturedMealPhoto;
  source: AnalyzeSource;
  userId: string | null;
  createdAt: number;
  error?: string;
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

async function runJob(id: string): Promise<void> {
  if (running.has(id)) return;
  const job = jobs.get(id);
  if (!job) return;

  running.add(id);
  setJob({ ...job, status: 'processing', error: undefined });

  try {
    const latest = jobs.get(id) ?? job;
    const prepared = await prepareMealPhotoForAnalysis(latest.photo);
    if (!jobs.has(id)) return;

    setJob({
      ...latest,
      photo: prepared,
      status: 'processing',
      error: undefined,
    });

    const info = await analyzeNutritionFromImage(
      prepared.base64,
      prepared.mimeType,
    );
    if (!jobs.has(id)) return;

    const userId = jobs.get(id)?.userId ?? latest.userId;
    if (userId) {
      await saveNutritionAnalysis(userId, info, {
        imageBase64: prepared.base64,
        localImageUri: prepared.uri,
      });
    }

    removeJob(id);
  } catch (err) {
    const current = jobs.get(id);
    if (!current) return;
    setJob({
      ...current,
      status: 'error',
      error: err instanceof Error ? err.message : 'Analysis failed.',
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
