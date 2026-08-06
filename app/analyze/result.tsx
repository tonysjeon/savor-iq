import { useEffect } from 'react';
import { View } from 'react-native';

import { useLeaveAnalyze } from '@/lib/leaveAnalyze';

/** Legacy route — results appear on Home after background analysis. */
export default function AnalyzeResultScreen() {
  const leaveAnalyze = useLeaveAnalyze();

  useEffect(() => {
    leaveAnalyze();
  }, [leaveAnalyze]);

  return <View style={{ flex: 1 }} />;
}
