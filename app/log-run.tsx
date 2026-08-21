import { ExerciseOptionIcon } from '@/components/ExerciseOptionIcon';
import { LogTimedExerciseScreen } from '@/components/LogTimedExerciseScreen';

export default function LogRunScreen() {
  return (
    <LogTimedExerciseScreen
      kind="run"
      title="exercise.run"
      headerIcon={<ExerciseOptionIcon id="run" size={22} />}
      intensityHints={{
        high: 'exercise.highHint',
        medium: 'exercise.mediumHint',
        low: 'exercise.lowHint',
      }}
    />
  );
}
