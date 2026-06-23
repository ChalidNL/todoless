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
    expect(t('common.settings')).toBe('Settings');
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
    expect(t('common.settings', 'fr')).toBe('Paramètres');
    expect(t('common.settings', 'de')).toBe('Einstellungen');
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

  it('formats dates and numbers with the active locale', () => {
    const value = new Date('2026-06-15T12:00:00Z');
    expect(formatDate(value, { month: 'long' }, 'fr')).toBe('juin');
    expect(formatNumber(1234.5, undefined, 'fr')).toBe('1 234,5');
    expect(formatNumber(1234.5, undefined, 'en')).toBe('1,234.5');
  });
});
