import { ExerciseOptionIcon } from '@/components/ExerciseOptionIcon';
import { LogTimedExerciseScreen } from '@/components/LogTimedExerciseScreen';

export default function LogWeightsScreen() {
  return (
    <LogTimedExerciseScreen
      kind="weights"
      title="exercise.weights"
      headerIcon={<ExerciseOptionIcon id="weights" size={22} />}
      intensityHints={{
        high: 'exercise.weightsHighHint',
        medium: 'exercise.weightsMediumHint',
        low: 'exercise.weightsLowHint',
      }}
    />
  );
}
