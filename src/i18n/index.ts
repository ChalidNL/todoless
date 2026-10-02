import { DEFAULT_UI_LANGUAGE, getStoredLanguage, isSupportedUiLanguage, setActiveLanguage, type Language } from './translations';

// The stored language applies from the first render (this module is imported
// by the language context). There is no i18n runtime: t() in translations.ts
// reads src/locales/<lang>.json directly (#260).
setActiveLanguage(getStoredLanguage());

export async function changeAppLanguage(lang: Language) {
  const next = isSupportedUiLanguage(lang) ? lang : DEFAULT_UI_LANGUAGE;
  setActiveLanguage(next);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('app_language', next);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
  }
}
