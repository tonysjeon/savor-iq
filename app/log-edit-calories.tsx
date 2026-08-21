import { useEffect } from 'react';
import { router } from 'expo-router';

import { CalorieKeypadScreen } from '@/components/CalorieKeypadScreen';
import { useLanguage } from '@/context/LanguageContext';
import { getTimedBurnDraft, updateTimedBurnCalories } from '@/lib/timedExerciseDraft';

export default function LogEditCaloriesScreen() {
  const { t } = useLanguage();
  const draft = getTimedBurnDraft();

  useEffect(() => {
    if (!draft) router.back();
  }, [draft]);

  if (!draft) return null;

  return (
    <CalorieKeypadScreen
      headerTitle={t('exercise.editBurnedTitle')}
      heading={t('exercise.yourWorkoutBurned')}
      submitLabel={t('exercise.done')}
      initialValue={String(draft.calories)}
      onSubmit={(calories) => {
        updateTimedBurnCalories(calories);
        router.back();
      }}
    />
  );
}
