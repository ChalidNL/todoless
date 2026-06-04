import { RepeatInterval } from '../types';
import { getRepeatDescriptor } from './repeat-schedule';

function getUiLanguage(): 'nl' | 'en' {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang?.toLowerCase();
    if (lang?.startsWith('nl')) return 'nl';
  }

  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('nl')) {
    return 'nl';
  }

  return 'en';
}

export function getRepeatLabel(repeatInterval?: RepeatInterval | null, dueDate?: number): string | null {
  if (!repeatInterval) return null;
  return getRepeatDescriptor(repeatInterval, dueDate, getUiLanguage());
}

export function getRepeatOptions(dueDate?: number): Array<{ value: '' | RepeatInterval; label: string; disabled?: boolean }> {
  const language = getUiLanguage();
  const repeatLabel = language === 'nl' ? 'Herhalen' : 'Repeat';

  return [
    { value: '', label: repeatLabel },
    { value: 'day', label: getRepeatDescriptor('day', dueDate, language) || '' },
    { value: 'week', label: getRepeatDescriptor('week', dueDate, language) || '' },
    { value: 'month', label: getRepeatDescriptor('month', dueDate, language) || '' },
    { value: 'month_weekday', label: getRepeatDescriptor('month_weekday', dueDate, language) || '', disabled: !dueDate },
    { value: 'year', label: getRepeatDescriptor('year', dueDate, language) || '' },
  ];
}
