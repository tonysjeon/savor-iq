import { useCallback } from 'react';
import { router, useNavigation } from 'expo-router';

import { clearAnalyzeSession } from '@/lib/analyzeSession';

type NavWithParent = {
  getParent?: () => { setOptions: (options: object) => void } | undefined;
};

/**
 * Close the Analyze modal without the slide-down animation.
 */
export function leaveAnalyze(navigation?: NavWithParent | null): void {
  clearAnalyzeSession();

  // Root stack owns the Analyze modal presentation / animation.
  const modalRoute = navigation?.getParent?.() ?? null;
  modalRoute?.setOptions({ animation: 'none' });

  requestAnimationFrame(() => {
    if (router.canDismiss()) {
      router.dismissTo('/(tabs)');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }

    requestAnimationFrame(() => {
      modalRoute?.setOptions({ animation: 'slide_from_bottom' });
    });
  });
}

export function useLeaveAnalyze(): () => void {
  const navigation = useNavigation();
  return useCallback(() => leaveAnalyze(navigation as NavWithParent), [navigation]);
}
