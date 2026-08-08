import { useCallback } from 'react';
import { router, useNavigation } from 'expo-router';

import { clearAnalyzeSession } from '@/lib/analyzeSession';

/**
 * Close the Analyze sheet with the normal slide-down dismiss.
 */
export function leaveAnalyze(): void {
  clearAnalyzeSession();

  requestAnimationFrame(() => {
    if (router.canDismiss()) {
      router.dismiss();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  });
}

export function useLeaveAnalyze(): () => void {
  useNavigation();
  return useCallback(() => leaveAnalyze(), []);
}
