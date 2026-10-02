import { RepeatInterval } from '../types';
import { getMonthWeekdayChipLabel, getRepeatDescriptor } from './repeat-schedule';
import { t } from '../i18n/translations';

function getUiLanguage(): 'nl' | 'en' | 'fr' | 'de' | 'es' {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang?.toLowerCase();
    if (lang?.startsWith('nl')) return 'nl';
    if (lang?.startsWith('fr')) return 'fr';
    if (lang?.startsWith('de')) return 'de';
    if (lang?.startsWith('es')) return 'es';
  }

  if (typeof navigator !== 'undefined') {
    const navLang = navigator.language?.toLowerCase();
    if (navLang?.startsWith('nl')) return 'nl';
    if (navLang?.startsWith('fr')) return 'fr';
    if (navLang?.startsWith('de')) return 'de';
    if (navLang?.startsWith('es')) return 'es';
  }

  return 'en';
}

export function getRepeatLabel(repeatInterval?: RepeatInterval | null, dueDate?: number): string | null {
  if (!repeatInterval) return null;
  return getRepeatDescriptor(repeatInterval, dueDate, getUiLanguage());
}

const SHORT_KEYS = { day: 'repeat.shortDay', week: 'repeat.shortWeek', month: 'repeat.shortMonth', year: 'repeat.shortYear' } as const;

export function getRepeatChipLabel(repeatInterval?: RepeatInterval | null, dueDate?: number): string | null {
  if (!repeatInterval) return null;

  const language = getUiLanguage();
  if (repeatInterval !== 'month_weekday') return t(SHORT_KEYS[repeatInterval], language);
  return getMonthWeekdayChipLabel(dueDate, language);
}

export function getRepeatOptions(dueDate?: number): Array<{ value: '' | RepeatInterval; label: string; disabled?: boolean }> {
  const language = getUiLanguage();

  return [
    { value: '', label: t('repeat.repeat', language) },
    { value: 'day', label: getRepeatDescriptor('day', dueDate, language) || '' },
    { value: 'week', label: getRepeatDescriptor('week', dueDate, language) || '' },
    { value: 'month', label: getRepeatDescriptor('month', dueDate, language) || '' },
    { value: 'month_weekday', label: getRepeatDescriptor('month_weekday', dueDate, language) || '', disabled: !dueDate },
    { value: 'year', label: getRepeatDescriptor('year', dueDate, language) || '' },
  ];
}
