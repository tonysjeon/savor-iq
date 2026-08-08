import { useEffect } from 'react';
import { View } from 'react-native';

import { useLeaveAnalyze } from '@/lib/leaveAnalyze';

/** Legacy route — analysis now runs on Home as a processing card. */
export default function AnalyzeProcessingScreen() {
  const leaveAnalyze = useLeaveAnalyze();

  useEffect(() => {
    leaveAnalyze();
  }, [leaveAnalyze]);

  return <View style={{ flex: 1 }} />;
}
