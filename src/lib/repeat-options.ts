import { RepeatInterval } from '../types';
import { getRepeatDescriptor } from './repeat-schedule';

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

export function getRepeatChipLabel(repeatInterval?: RepeatInterval | null, dueDate?: number): string | null {
  if (!repeatInterval) return null;

  const language = getUiLanguage();
  const shortLabels = language === 'nl'
    ? { day: 'Dagelijks', week: 'Wekelijks', month: 'Maandelijks', year: 'Jaarlijks' }
    : language === 'fr'
      ? { day: 'Quotidien', week: 'Hebdomadaire', month: 'Mensuel', year: 'Annuel' }
      : language === 'de'
        ? { day: 'Täglich', week: 'Wöchentlich', month: 'Monatlich', year: 'Jährlich' }
        : language === 'es'
          ? { day: 'Diario', week: 'Semanal', month: 'Mensual', year: 'Anual' }
          : { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' };

  if (repeatInterval !== 'month_weekday') {
    return shortLabels[repeatInterval];
  }

  const fullLabel = getRepeatDescriptor(repeatInterval, dueDate, language);
  if (!fullLabel) return language === 'nl' ? 'Maandelijks' : language === 'fr' ? 'Mensuel' : language === 'de' ? 'Monatlich' : language === 'es' ? 'Mensual' : 'Monthly';

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
  if (language === 'de') {
    return fullLabel
      .replace(/^Jeden\s+/i, 'Mon · ')
      .replace(/\s+des Monats$/i, '')
      .replace(/erste/i, '1.')
      .replace(/zweite/i, '2.')
      .replace(/dritte/i, '3.')
      .replace(/vierte/i, '4.')
      .replace(/fünfte/i, '5.')
      .replace(/letzten/i, 'letzten');
  }
  if (language === 'es') {
    return fullLabel
      .replace(/^Cada\s+/i, 'Mes · ')
      .replace(/\s+del mes$/i, '')
      .replace(/primer/i, '1.º')
      .replace(/segundo/i, '2.º')
      .replace(/tercer/i, '3.º')
      .replace(/cuarto/i, '4.º')
      .replace(/quinto/i, '5.º')
      .replace(/último/i, 'último');
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
  const repeatLabel = language === 'nl' ? 'Herhalen' : language === 'fr' ? 'Répéter' : language === 'de' ? 'Wiederholen' : language === 'es' ? 'Repetir' : 'Repeat';

  return [
    { value: '', label: repeatLabel },
    { value: 'day', label: getRepeatDescriptor('day', dueDate, language) || '' },
    { value: 'week', label: getRepeatDescriptor('week', dueDate, language) || '' },
    { value: 'month', label: getRepeatDescriptor('month', dueDate, language) || '' },
    { value: 'month_weekday', label: getRepeatDescriptor('month_weekday', dueDate, language) || '', disabled: !dueDate },
    { value: 'year', label: getRepeatDescriptor('year', dueDate, language) || '' },
  ];
}
