export type TimedExerciseKind = 'run' | 'weights';
export type ExerciseIntensity = 'high' | 'medium' | 'low';

const DEFAULT_WEIGHT_KG = 70;

const MET: Record<TimedExerciseKind, Record<ExerciseIntensity, number>> = {
  run: {
    high: 14.5,
    medium: 10,
    low: 3.5,
  },
  weights: {
    high: 6,
    medium: 5,
    low: 3,
  },
};

export function estimateTimedExerciseCalories(params: {
  kind: TimedExerciseKind;
  intensity: ExerciseIntensity;
  durationMinutes: number;
  weightKg?: number;
}): number {
  const hours = Math.max(0, params.durationMinutes) / 60;
  const weightKg = params.weightKg && params.weightKg > 0 ? params.weightKg : DEFAULT_WEIGHT_KG;
  return Math.max(1, Math.round(MET[params.kind][params.intensity] * weightKg * hours));
}
