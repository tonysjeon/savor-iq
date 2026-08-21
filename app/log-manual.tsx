import { router, type Href } from 'expo-router';

import { CalorieKeypadScreen } from '@/components/CalorieKeypadScreen';
import { ExerciseOptionIcon } from '@/components/ExerciseOptionIcon';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { enqueueManualExercise } from '@/lib/exerciseEstimateQueue';

export default function LogManualScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <CalorieKeypadScreen
      headerTitle={t('exercise.manual')}
      headerIcon={<ExerciseOptionIcon id="manual" size={22} />}
      heading={t('exercise.caloriesBurnedHeading')}
      submitLabel={t('exercise.addShort')}
      onSubmit={(calories) => {
        enqueueManualExercise({
          calories,
          userId: user?.uid ?? null,
        });
        if (router.canDismiss()) {
          router.dismissTo('/(tabs)' as Href);
        } else {
          router.replace('/(tabs)' as Href);
        }
      }}
    />
  );
}
