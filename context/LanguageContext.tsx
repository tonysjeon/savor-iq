import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  getLanguage,
  getLocale,
  loadSavedLanguage,
  persistLanguage,
  subscribeLanguage,
  t as translate,
  translateOption,
  type LanguageId,
  type MessageKey,
} from '@/lib/i18n';

type TranslateFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

type LanguageContextValue = {
  language: LanguageId;
  locale: string;
  ready: boolean;
  t: TranslateFn;
  to: (value: string) => string;
  setLanguage: (id: LanguageId) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageId>(getLanguage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void loadSavedLanguage().then((id) => {
      if (!active) return;
      setLanguageState(id);
      setReady(true);
    });
    return subscribeLanguage(() => {
      setLanguageState(getLanguage());
    });
  }, []);

  const setLanguage = useCallback(async (id: LanguageId) => {
    await persistLanguage(id);
  }, []);

  const t = useCallback<TranslateFn>(
    (key, vars) => translate(key, vars),
    [language],
  );

  const to = useCallback((value: string) => translateOption(value), [language]);

  const value = useMemo(
    () => ({
      language,
      locale: getLocale(),
      ready,
      t,
      to,
      setLanguage,
    }),
    [language, ready, t, to, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
