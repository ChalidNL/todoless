import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import i18n, { changeAppLanguage } from '../i18n';
import {
  DEFAULT_UI_LANGUAGE,
  getStoredLanguage,
  isSupportedUiLanguage,
  t as translate,
  type Language,
  type SupportedUiLanguage,
} from '../i18n/translations';
import { pb } from '../lib/pocketbase';

interface LanguageContextType {
  language: SupportedUiLanguage;
  setLanguage: (lang: SupportedUiLanguage) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const getUserLanguage = (record: unknown): SupportedUiLanguage | undefined => {
  const lang = (record as { language?: unknown } | null | undefined)?.language;
  return isSupportedUiLanguage(lang) ? lang : undefined;
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedUiLanguage>(() => {
    return getUserLanguage(pb.authStore.record) ?? getStoredLanguage() ?? DEFAULT_UI_LANGUAGE;
  });

  useEffect(() => {
    void changeAppLanguage(language);
  }, [language]);

  useEffect(() => {
    const userLanguage = getUserLanguage(pb.authStore.record);
    if (userLanguage && userLanguage !== language) {
      setLanguageState(userLanguage);
    }

    const unsubscribe = pb.authStore.onChange((_token, record) => {
      const nextLanguage = getUserLanguage(record) ?? getStoredLanguage();
      setLanguageState(nextLanguage);
    });

    return () => unsubscribe();
  }, [language]);

  const value = useMemo<LanguageContextType>(() => ({
    language,
    setLanguage: (lang: SupportedUiLanguage) => {
      setLanguageState(isSupportedUiLanguage(lang) ? lang : DEFAULT_UI_LANGUAGE);
    },
    t: (key: string) => translate(key, language as Language),
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export { i18n };
