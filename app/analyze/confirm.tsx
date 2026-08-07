import { useEffect } from 'react';
import { View } from 'react-native';

import { useLeaveAnalyze } from '@/lib/leaveAnalyze';

/** Legacy route — capture now enqueues analysis and returns home immediately. */
export default function AnalyzeConfirmScreen() {
  const leaveAnalyze = useLeaveAnalyze();

  useEffect(() => {
    leaveAnalyze();
  }, [leaveAnalyze]);

  return <View style={{ flex: 1 }} />;
}
