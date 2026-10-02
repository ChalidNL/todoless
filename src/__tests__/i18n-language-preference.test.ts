import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_UI_LANGUAGE,
  formatDate,
  formatNumber,
  getStoredLanguage,
  isSupportedUiLanguage,
  setActiveLanguage,
  t,
} from '../i18n/translations';

describe('per-user UI language preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveLanguage(DEFAULT_UI_LANGUAGE);
  });

  it('uses English as startup default', () => {
    expect(DEFAULT_UI_LANGUAGE).toBe('en');
    expect(getStoredLanguage()).toBe('en');
    expect(t('settings.title')).toBe('Settings');
  });

  it('accepts only launch languages for persisted user preference', () => {
    expect(isSupportedUiLanguage('nl')).toBe(true);
    expect(isSupportedUiLanguage('fr')).toBe(true);
    expect(isSupportedUiLanguage('en')).toBe(true);
    expect(isSupportedUiLanguage('de')).toBe(true);
    expect(isSupportedUiLanguage('es')).toBe(true);
    expect(isSupportedUiLanguage('zh')).toBe(false);

    localStorage.setItem('app_language', 'fr');
    expect(getStoredLanguage()).toBe('fr');

    localStorage.setItem('app_language', 'de');
    expect(getStoredLanguage()).toBe('de');

    localStorage.setItem('app_language', 'es');
    expect(getStoredLanguage()).toBe('es');
  });

  it('keeps backend user language allow-lists in sync with frontend launch languages', () => {
    const migration = readFileSync(resolve(__dirname, '../../pb_migrations/055_user_language_preference.js'), 'utf8');
    const followUpMigration = readFileSync(resolve(__dirname, '../../pb_migrations/059_allow_de_es_user_languages.js'), 'utf8');
    const registerHook = readFileSync(resolve(__dirname, '../../pb_hooks/main.pb.js'), 'utf8');

    for (const lang of ['nl', 'fr', 'en', 'de', 'es']) {
      expect(migration).toContain(`'${lang}'`);
      expect(followUpMigration).toContain(`'${lang}'`);
      expect(registerHook).toContain(`'${lang}'`);
    }
    expect(registerHook).toContain("rec.set('tokenKey'");
  });

  it('falls back to English and then the key when a translation is missing', () => {
    expect(t('settings.title', 'fr')).toBe('Paramètres');
    expect(t('settings.title', 'de')).toBe('Einstellungen');
    expect(t('missing.translation.key', 'fr')).toBe('missing.translation.key');
  });

  it('translates member invite UI copy in all launch languages', () => {
    expect(t('invite.generateMember', 'en')).toBe('Generate member invite');
    expect(t('invite.generateMember', 'nl')).toBe('Genereer uitnodiging voor lid');
    expect(t('invite.memberInviteTitle', 'nl')).toBe('Deel uitnodiging voor lid');
    expect(t('invite.memberLabel', 'nl')).toBe('Lid');
    expect(t('invite.shareText', 'nl')).toContain('Uitnodiging voor lid');
    expect(t('invite.generateMember', 'fr')).toBe('Générer une invitation membre');
  });

  it('never leaks Dutch overlay strings into the English nav/dashboard translations', () => {
    // Regression for GH#70: the English entry of a translation layer had been
    // hand-edited with literal Dutch strings ("Taken", "Agenda", "Shop",
    // "Instellingen", "Geblokkeerd") - a static data bug, not a runtime
    // state-sync bug. All strings now live in src/locales/<lang>.json (#260);
    // this pins the English and Dutch values there.
    expect(t('nav.inbox', 'en')).toBe('Inbox');
    expect(t('nav.tasks', 'en')).toBe('Tasks');
    expect(t('nav.calendar', 'en')).toBe('Calendar');
    expect(t('nav.groceries', 'en')).toBe('Groceries');
    expect(t('nav.settings', 'en')).toBe('Settings');
    expect(t('dashboard.blocked', 'en')).toBe('Blocked');

    // Guard against the same class of bug recurring in nl (verifies the
    // structure is real per-language data, not just a fallback masking it).
    expect(t('nav.tasks', 'nl')).toBe('Taken');
    expect(t('nav.calendar', 'nl')).toBe('Agenda');
  });

  it('formats dates and numbers with the active locale', () => {
    const value = new Date('2026-06-15T12:00:00Z');
    expect(formatDate(value, { month: 'long' }, 'fr')).toBe('juin');
    expect(formatNumber(1234.5, undefined, 'fr')).toBe('1 234,5');
    expect(formatNumber(1234.5, undefined, 'en')).toBe('1,234.5');
  });
});
