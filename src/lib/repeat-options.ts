import { RepeatInterval } from '../types';
import { getRepeatDescriptor } from './repeat-schedule';

function getUiLanguage(): 'nl' | 'en' | 'fr' {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang?.toLowerCase();
    if (lang?.startsWith('nl')) return 'nl';
    if (lang?.startsWith('fr')) return 'fr';
  }

  if (typeof navigator !== 'undefined') {
    const navLang = navigator.language?.toLowerCase();
    if (navLang?.startsWith('nl')) return 'nl';
    if (navLang?.startsWith('fr')) return 'fr';
  }

  return 'en';
}

export function getRepeatLabel(repeatInterval?: RepeatInterval | null, dueDate?: number): string | null {
  if (!repeatInterval) return null;
  return getRepeatDescriptor(repeatInterval, dueDate, getUiLanguage());
}

export function getRepeatChipLabel(repeatInterval?: RepeatInterval | null, dueDate?: number): string | null {
  if (!repeatInterval) return null;

  const language = getUiLanguage();
  const shortLabels = language === 'nl'
    ? { day: 'Dagelijks', week: 'Wekelijks', month: 'Maandelijks', year: 'Jaarlijks' }
    : language === 'fr'
      ? { day: 'Quotidien', week: 'Hebdomadaire', month: 'Mensuel', year: 'Annuel' }
      : { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' };

  if (repeatInterval !== 'month_weekday') {
    return shortLabels[repeatInterval];
  }

  const fullLabel = getRepeatDescriptor(repeatInterval, dueDate, language);
  if (!fullLabel) return language === 'nl' ? 'Maandelijks' : language === 'fr' ? 'Mensuel' : 'Monthly';

  if (language === 'nl') {
    return fullLabel
      .replace(/^Elke\s+/i, 'Mnd · ')
      .replace(/\s+van de maand$/i, '')
      .replace(/eerste/i, '1e')
      .replace(/tweede/i, '2e')
      .replace(/derde/i, '3e')
      .replace(/vierde/i, '4e')
      .replace(/vijfde/i, '5e')
      .replace(/laatste/i, 'laatste');
  }
  if (language === 'fr') {
    return fullLabel
      .replace(/^Chaque\s+/i, 'Mois · ')
      .replace(/\s+du mois$/i, '')
      .replace(/premier/i, '1er')
      .replace(/deuxième/i, '2e')
      .replace(/troisième/i, '3e')
      .replace(/quatrième/i, '4e')
      .replace(/cinquième/i, '5e')
      .replace(/dernier/i, 'dernier');
  }
  return fullLabel
    .replace(/^Every\s+/i, 'Mon · ')
    .replace(/\s+of the month$/i, '')
    .replace(/first/i, '1st')
    .replace(/second/i, '2nd')
    .replace(/third/i, '3rd')
    .replace(/fourth/i, '4th')
    .replace(/fifth/i, '5th')
    .replace(/last/i, 'last');
}

export function getRepeatOptions(dueDate?: number): Array<{ value: '' | RepeatInterval; label: string; disabled?: boolean }> {
  const language = getUiLanguage();
  const repeatLabel = language === 'nl' ? 'Herhalen' : language === 'fr' ? 'Répéter' : 'Repeat';

  return [
    { value: '', label: repeatLabel },
    { value: 'day', label: getRepeatDescriptor('day', dueDate, language) || '' },
    { value: 'week', label: getRepeatDescriptor('week', dueDate, language) || '' },
    { value: 'month', label: getRepeatDescriptor('month', dueDate, language) || '' },
    { value: 'month_weekday', label: getRepeatDescriptor('month_weekday', dueDate, language) || '', disabled: !dueDate },
    { value: 'year', label: getRepeatDescriptor('year', dueDate, language) || '' },
  ];
}
