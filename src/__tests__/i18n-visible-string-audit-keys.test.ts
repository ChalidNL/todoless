import { describe, expect, it } from 'vitest';
import { t, type Language } from '../i18n/translations';

const LANGUAGES: Language[] = ['en', 'nl', 'fr', 'de', 'es'];

// Keys introduced/changed when the visible-string audit (GH#96) was wired into
// the quality gate. Every one of these must resolve to a real translation in
// every language — otherwise the audit passes but users see raw keys.
const REQUIRED_KEYS = [
  'auth.firstNamePlaceholder',
  'auth.lastNamePlaceholder',
  'calendar.moreCount',
  'common.edit',
  'common.manage',
  'common.untitled',
  'dashboard.blocked',
  'filters.none',
  'labels.visibilityFamily',
  'labels.visibilityPrivate',
  'labels.visibilityShared',
  'settings.membersSearchPlaceholder',
  'settings.sortAlpha',
  'settings.sortAlphaReverse',
  'settings.sortNewest',
  'settings.sortOldest',
  'filters.priority',
  'tasks.addFocus',
  'tasks.confirmDeleteSubtaskTitle',
  'tasks.deletedCount',
  'tasks.focus',
  'tasks.moveToBacklog',
  'tasks.priorityHigh',
  'tasks.priorityLow',
  'tasks.priorityMedium',
  'tasks.removeFocus',
];

describe('GH#96 visible-string audit i18n keys resolve in every language', () => {
  it.each(REQUIRED_KEYS)('key %s resolves in all 5 languages', (key) => {
    for (const lang of LANGUAGES) {
      const value = t(key, lang);
      expect(value, `${key} (${lang}) must not resolve to the raw key`).not.toBe(key);
      expect(value.trim().length, `${key} (${lang}) must be non-empty`).toBeGreaterThan(0);
    }
  });

  it('dashboard.blocked is English "Blocked" and Dutch "Geblokkeerd" (no cross-language leak)', () => {
    expect(t('dashboard.blocked', 'en')).toBe('Blocked');
    expect(t('dashboard.blocked', 'nl')).toBe('Geblokkeerd');
  });
});