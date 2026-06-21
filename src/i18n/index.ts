import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import nl from '../locales/nl.json';
import de from '../locales/de.json';
import es from '../locales/es.json';
import { DEFAULT_UI_LANGUAGE, getStoredLanguage, setActiveLanguage, type Language } from './translations';

export const resources = {
  nl: { translation: nl },
  fr: { translation: fr },
  en: { translation: en },
  de: { translation: de },
  es: { translation: es },
};

if (!i18n.isInitialized) {
  const initialLanguage = getStoredLanguage();
  setActiveLanguage(initialLanguage);
  void i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: initialLanguage,
      fallbackLng: 'en',
      returnEmptyString: false,
      interpolation: { escapeValue: false },
    });
}

export async function changeAppLanguage(lang: Language) {
  const next = (lang === 'fr' || lang === 'en' || lang === 'nl' || lang === 'de' || lang === 'es') ? lang : DEFAULT_UI_LANGUAGE;
  setActiveLanguage(next);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('app_language', next);
  }
  await i18n.changeLanguage(next);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
  }
}

export default i18n;
