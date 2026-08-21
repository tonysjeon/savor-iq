import type { ExerciseIntensity, TimedExerciseKind } from '@/lib/exerciseCalories';

export type TimedBurnDraft = {
  kind: TimedExerciseKind;
  intensity: ExerciseIntensity;
  durationMinutes: number;
  calories: number;
};

type Listener = () => void;

let draft: TimedBurnDraft | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function getTimedBurnDraft(): TimedBurnDraft | null {
  return draft;
}

export function setTimedBurnDraft(next: TimedBurnDraft) {
  draft = next;
  notify();
}

export function updateTimedBurnCalories(calories: number) {
  if (!draft) return;
  draft = { ...draft, calories: Math.max(1, Math.round(calories)) };
  notify();
}

export function clearTimedBurnDraft() {
  draft = null;
  notify();
}

export function subscribeTimedBurnDraft(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
