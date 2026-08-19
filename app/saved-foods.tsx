import { QuickActionScreen } from '@/components/QuickActionScreen';
import { useLanguage } from '@/context/LanguageContext';

export default function SavedFoodsScreen() {
  const { t } = useLanguage();
  return <QuickActionScreen title={t('tabs.savedFoods')} />;
}
