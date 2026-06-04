import { RepeatInterval } from '../types';

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'] as const;
const ORDINALS_NL = ['eerste', 'tweede', 'derde', 'vierde', 'vijfde'] as const;
const WEEKDAY_INDEX_TO_NAME_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const WEEKDAY_INDEX_TO_NAME_NL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'] as const;

type SupportedLanguage = 'nl' | 'en';

type MonthlyWeekdayParts = {
  weekdayIndex: number;
  occurrenceIndex: number;
  isLastOccurrence: boolean;
};

function toDate(value: number | string | Date): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function addMonthsPreservingDay(baseDate: Date, monthsToAdd: number): Date {
  const year = baseDate.getUTCFullYear();
  const monthIndex = baseDate.getUTCMonth() + monthsToAdd;
  const targetYear = year + Math.floor(monthIndex / 12);
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(baseDate.getUTCDate(), daysInMonth);

  return new Date(Date.UTC(
    targetYear,
    normalizedMonth,
    targetDay,
    baseDate.getUTCHours(),
    baseDate.getUTCMinutes(),
    baseDate.getUTCSeconds(),
    baseDate.getUTCMilliseconds()
  ));
}

function getMonthlyWeekdayParts(input: number | string | Date): MonthlyWeekdayParts {
  const date = toDate(input);
  const dayOfMonth = date.getUTCDate();
  const occurrenceIndex = Math.floor((dayOfMonth - 1) / 7);
  const weekdayIndex = date.getUTCDay();
  const nextSameWeekday = new Date(date.getTime());
  nextSameWeekday.setUTCDate(dayOfMonth + 7);

  return {
    weekdayIndex,
    occurrenceIndex,
    isLastOccurrence: nextSameWeekday.getUTCMonth() !== date.getUTCMonth(),
  };
}

function getNthWeekdayInMonth(baseDate: Date, monthsToAdd: number): Date {
  const targetMonthSeed = addMonthsPreservingDay(baseDate, monthsToAdd);
  const targetYear = targetMonthSeed.getUTCFullYear();
  const targetMonth = targetMonthSeed.getUTCMonth();
  const { weekdayIndex, occurrenceIndex, isLastOccurrence } = getMonthlyWeekdayParts(baseDate);

  const firstDayOfMonth = new Date(Date.UTC(
    targetYear,
    targetMonth,
    1,
    baseDate.getUTCHours(),
    baseDate.getUTCMinutes(),
    baseDate.getUTCSeconds(),
    baseDate.getUTCMilliseconds()
  ));

  const firstWeekdayOffset = (weekdayIndex - firstDayOfMonth.getUTCDay() + 7) % 7;
  const firstWeekdayDate = 1 + firstWeekdayOffset;
  let targetDay = firstWeekdayDate + (occurrenceIndex * 7);

  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  if (isLastOccurrence || targetDay > daysInMonth) {
    const lastDayOfMonth = new Date(Date.UTC(
      targetYear,
      targetMonth,
      daysInMonth,
      baseDate.getUTCHours(),
      baseDate.getUTCMinutes(),
      baseDate.getUTCSeconds(),
      baseDate.getUTCMilliseconds()
    ));
    const reverseOffset = (lastDayOfMonth.getUTCDay() - weekdayIndex + 7) % 7;
    targetDay = daysInMonth - reverseOffset;
  }

  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    targetDay,
    baseDate.getUTCHours(),
    baseDate.getUTCMinutes(),
    baseDate.getUTCSeconds(),
    baseDate.getUTCMilliseconds()
  ));
}

export function getRepeatDescriptor(
  repeatInterval?: RepeatInterval | null,
  dueDate?: number | string,
  language: SupportedLanguage = 'en'
): string | null {
  if (!repeatInterval) return null;

  const labels = language === 'nl'
    ? {
        day: 'Elke dag',
        week: 'Elke week',
        month: 'Elke maand',
        year: 'Elk jaar',
      }
    : {
        day: 'Every day',
        week: 'Every week',
        month: 'Every month',
        year: 'Every year',
      };

  if (repeatInterval !== 'month_weekday') {
    return labels[repeatInterval];
  }

  if (!dueDate) {
    return language === 'nl' ? 'Elke eerste maandag van de maand' : 'Every first Monday of the month';
  }

  const date = toDate(dueDate);
  const { weekdayIndex, occurrenceIndex, isLastOccurrence } = getMonthlyWeekdayParts(date);
  const weekday = language === 'nl' ? WEEKDAY_INDEX_TO_NAME_NL[weekdayIndex] : WEEKDAY_INDEX_TO_NAME_EN[weekdayIndex];

  if (isLastOccurrence) {
    return language === 'nl' ? `Elke laatste ${weekday} van de maand` : `Every last ${weekday} of the month`;
  }

  const ordinal = language === 'nl'
    ? ORDINALS_NL[Math.min(occurrenceIndex, ORDINALS_NL.length - 1)]
    : ORDINALS[Math.min(occurrenceIndex, ORDINALS.length - 1)];

  return language === 'nl'
    ? `Elke ${ordinal} ${weekday} van de maand`
    : `Every ${ordinal} ${weekday} of the month`;
}

export function getNextRecurringDueDate(repeatInterval: RepeatInterval, baseDateIso: string): string {
  const baseDate = toDate(baseDateIso);
  let nextDate: Date;

  switch (repeatInterval) {
    case 'day':
      nextDate = new Date(baseDate.getTime());
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      break;
    case 'week':
      nextDate = new Date(baseDate.getTime());
      nextDate.setUTCDate(nextDate.getUTCDate() + 7);
      break;
    case 'month':
      nextDate = addMonthsPreservingDay(baseDate, 1);
      break;
    case 'year':
      nextDate = new Date(baseDate.getTime());
      nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1);
      break;
    case 'month_weekday':
      nextDate = getNthWeekdayInMonth(baseDate, 1);
      break;
    default:
      nextDate = new Date(baseDate.getTime());
      break;
  }

  return nextDate.toISOString();
}
