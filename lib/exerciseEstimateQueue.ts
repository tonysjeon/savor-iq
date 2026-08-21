import type { ExerciseIntensity, TimedExerciseKind } from '@/lib/exerciseCalories';
import {
  deleteExercise,
  saveExercise,
  type ExerciseSource,
  type SavedExercise,
} from '@/lib/firestore';
import {
  estimateExerciseCalories,
  type ExerciseEstimate,
} from '@/lib/gemini';
import { getOnboardingDraft } from '@/lib/onboarding';
import { prependCachedExercise, removeCachedExercise } from '@/lib/userHistoryCache';

export type { ExerciseSource, SavedExercise };
export type ExerciseEstimateJobStatus = 'processing' | 'ready' | 'error';

export type ExerciseEstimateJob = {
  id: string;
  status: ExerciseEstimateJobStatus;
  description: string;
  userId: string | null;
  createdAt: number;
  error?: string;
  progress: number;
  result?: SavedExercise;
};

type JobListener = () => void;

const jobs = new Map<string, ExerciseEstimateJob>();
const listeners = new Set<JobListener>();
const running = new Set<string>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setJob(job: ExerciseEstimateJob) {
  jobs.set(job.id, job);
  notify();
}

export function subscribeExerciseEstimateJobs(listener: JobListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function listExerciseEstimateJobs(): ExerciseEstimateJob[] {
  return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function pruneReadyExerciseJobs(savedIds: Set<string>): void {
  let changed = false;
  for (const [id, job] of jobs) {
    const resultId = job.result?.id;
    if (
      job.status === 'ready' &&
      (savedIds.has(id) || (resultId != null && savedIds.has(resultId)))
    ) {
      jobs.delete(id);
      changed = true;
    }
  }
  if (changed) notify();
}

export function dismissExerciseEstimate(id: string) {
  jobs.delete(id);
  notify();
}

export function retryExerciseEstimate(id: string) {
  void runJob(id);
}

export function enqueueExerciseEstimate(params: {
  description: string;
  userId: string | null;
}): string {
  const id = `exercise-${Date.now()}`;
  const job: ExerciseEstimateJob = {
    id,
    status: 'processing',
    description: params.description.trim(),
    userId: params.userId,
    createdAt: Date.now(),
    progress: 5,
  };
  setJob(job);
  void runJob(id);
  return id;
}

export function enqueueManualExercise(params: {
  calories: number;
  userId: string | null;
}): string {
  const id = `exercise-${Date.now()}`;
  const createdAt = Date.now();
  const calories = Math.max(1, Math.round(params.calories));
  const result: SavedExercise = {
    id,
    activity: 'Manual',
    calories,
    durationMinutes: 0,
    intensity: 'medium',
    summary: '',
    description: `${calories} cal`,
    createdAt,
    source: 'manual',
  };
  setJob({
    id,
    status: 'ready',
    description: `${calories} cal`,
    userId: params.userId,
    createdAt,
    progress: 100,
    result,
  });
  void persistExercise(id, result, params.userId);
  return id;
}

export function enqueueTimedExercise(params: {
  kind: TimedExerciseKind;
  calories: number;
  durationMinutes: number;
  intensity: ExerciseIntensity;
  userId: string | null;
}): string {
  const id = `exercise-${Date.now()}`;
  const createdAt = Date.now();
  const calories = Math.max(1, Math.round(params.calories));
  const durationMinutes = Math.max(1, Math.round(params.durationMinutes));
  const activity = params.kind === 'run' ? 'Run' : 'Weight lifting';
  const result: SavedExercise = {
    id,
    activity,
    calories,
    durationMinutes,
    intensity: params.intensity,
    summary: '',
    description: activity,
    createdAt,
    source: params.kind,
  };
  setJob({
    id,
    status: 'ready',
    description: activity,
    userId: params.userId,
    createdAt,
    progress: 100,
    result,
  });
  void persistExercise(id, result, params.userId);
  return id;
}

async function persistExercise(
  jobId: string,
  result: SavedExercise,
  userId: string | null,
): Promise<void> {
  if (!userId) return;

  await prependCachedExercise(userId, result);
  if (!jobs.has(jobId)) return;

  try {
    const docId = await saveExercise(userId, result, { skipCache: true });
    if (!jobs.has(jobId)) {
      await deleteExercise(userId, docId);
      return;
    }

    const saved: SavedExercise = { ...result, id: docId };
    const current = jobs.get(jobId);
    if (current) {
      setJob({ ...current, result: saved });
    }
    await prependCachedExercise(userId, saved);
    if (docId !== jobId) {
      await removeCachedExercise(userId, jobId);
    }
  } catch {
    // Keep the local workout visible even if cloud write fails.
  }
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
    result: undefined,
    progress: 12,
  });

  try {
    const latest = jobs.get(id) ?? job;
    setJob({ ...latest, progress: 35 });

    const draft = await getOnboardingDraft();
    if (!jobs.has(id)) return;

    setJob({ ...(jobs.get(id) ?? latest), progress: 55 });

    const estimate = await estimateExerciseCalories(latest.description, {
      weightKg: draft?.weightKg,
      heightCm: draft?.heightCm,
      gender: draft?.gender,
    });
    if (!jobs.has(id)) return;

    const result: SavedExercise = {
      ...estimate,
      id,
      description: latest.description,
      createdAt: Date.now(),
      source: 'describe',
    };

    setJob({
      ...(jobs.get(id) ?? latest),
      status: 'ready',
      error: undefined,
      result,
      progress: 100,
    });
    await persistExercise(id, result, latest.userId);
  } catch (error) {
    if (!jobs.has(id)) return;
    const latest = jobs.get(id) ?? job;
    setJob({
      ...latest,
      status: 'error',
      error: error instanceof Error ? error.message : 'Estimate failed',
      progress: 0,
    });
  } finally {
    running.delete(id);
  }
}
