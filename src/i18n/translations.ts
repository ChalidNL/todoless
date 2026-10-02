import enLocale from '../locales/en.json';
import nlLocale from '../locales/nl.json';
import frLocale from '../locales/fr.json';
import deLocale from '../locales/de.json';
import esLocale from '../locales/es.json';

export type Language = 'nl' | 'fr' | 'en' | 'de' | 'es';

export const SUPPORTED_UI_LANGUAGES = ['nl', 'fr', 'en', 'de', 'es'] as const;
export type SupportedUiLanguage = typeof SUPPORTED_UI_LANGUAGES[number];
export const DEFAULT_UI_LANGUAGE: SupportedUiLanguage = 'en';
const localeResources: Record<SupportedUiLanguage, Record<string, unknown>> = {
  en: enLocale,
  nl: nlLocale,
  fr: frLocale,
  de: deLocale,
  es: esLocale,
};
const STORAGE_LANGUAGE_KEY = 'app_language';
let activeLanguage: Language = DEFAULT_UI_LANGUAGE;

export function isSupportedUiLanguage(value: unknown): value is SupportedUiLanguage {
  return typeof value === 'string' && (SUPPORTED_UI_LANGUAGES as readonly string[]).includes(value);
}

export function getStoredLanguage(): SupportedUiLanguage {
  if (typeof localStorage === 'undefined') return DEFAULT_UI_LANGUAGE;
  const stored = localStorage.getItem(STORAGE_LANGUAGE_KEY);
  return isSupportedUiLanguage(stored) ? stored : DEFAULT_UI_LANGUAGE;
}

export function setActiveLanguage(lang: Language) {
  activeLanguage = isSupportedUiLanguage(lang) ? lang : DEFAULT_UI_LANGUAGE;
}

export function getActiveLanguage(): Language {
  return activeLanguage;
}

function lookupNested(dict: unknown, key: string): string | undefined {
  const parts = key.split('.');
  let value: any = dict;
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return undefined;
    }
  }
  return typeof value === 'string' ? value : undefined;
}

/**
 * Every UI string lives in src/locales/<lang>.json (#260). This used to
 * resolve through four in-code layers before the JSON; they were folded
 * into the files, so a key is found in exactly one place.
 */
function lookupTranslation(key: string, lang: Language): string | undefined {
  const supportedLanguage = isSupportedUiLanguage(lang) ? lang : DEFAULT_UI_LANGUAGE;
  return lookupNested(localeResources[supportedLanguage], key);
}

/** Simple translation helper: active language → English fallback → key. */
export function t(key: string, lang: Language = activeLanguage): string {
  return lookupTranslation(key, lang) ?? lookupTranslation(key, 'en') ?? key;
}

/** Backend (PocketBase) error messages that must never surface raw in the UI. */
const PB_ERROR_MESSAGE_KEYS: Record<string, string> = {
  'failed to authenticate': 'auth.failedToAuthenticate',
  'invite code is invalid_or_expired': 'auth.expiredInviteCode',
};

/** Translate known backend error messages; unknown messages pass through raw. */
export function translatePbError(raw: string | null | undefined, fallbackKey: string): string {
  const normalized = raw?.trim().toLowerCase().replace(/\.$/, '');
  if (!normalized) return t(fallbackKey);
  const key = PB_ERROR_MESSAGE_KEYS[normalized];
  return key ? t(key) : raw ?? '';
}

export function formatDate(value: Date | number | string, options?: Intl.DateTimeFormatOptions, lang: Language = activeLanguage): string {
  return new Intl.DateTimeFormat(lang, options).format(new Date(value));
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions, lang: Language = activeLanguage): string {
  return new Intl.NumberFormat(lang, options).format(value);
}
