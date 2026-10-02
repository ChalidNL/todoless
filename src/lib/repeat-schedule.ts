import { RepeatInterval } from '../types';

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'] as const;
const ORDINALS_NL = ['eerste', 'tweede', 'derde', 'vierde', 'vijfde'] as const;
const ORDINALS_FR = ['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième'] as const;
const ORDINALS_DE = ['erste', 'zweite', 'dritte', 'vierte', 'fünfte'] as const;
const ORDINALS_ES = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto'] as const;
const WEEKDAY_INDEX_TO_NAME_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const WEEKDAY_INDEX_TO_NAME_NL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'] as const;
const WEEKDAY_INDEX_TO_NAME_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;
const WEEKDAY_INDEX_TO_NAME_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const;
const WEEKDAY_INDEX_TO_NAME_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;
type SupportedLanguage = 'nl' | 'en' | 'fr' | 'de' | 'es';

type MonthlyWeekdayParts = {
  weekdayIndex: number;
  occurrenceIndex: number;
  isLastOccurrence: boolean;
};

// ── Recurrence date math ─────────────────────────────────────────────────────
// Line-for-line copy of pb_hooks/lib/recurrence.js, which creates the real
// next occurrence on the server; the calendar preview and "next:" hint use
// this copy. src/__tests__/recurrence-client-server.test.ts requires both to
// produce identical dates (#256). Change both or neither.
//
//   * 00:00:00.000 UTC is a date-only value: it moves by calendar days in
//     UTC and stays at UTC midnight.
//   * Any other date moves on the Europe/Amsterdam wall clock, so "every
//     Monday 09:00" stays 09:00 across DST changes.
//   * month: same day, clamped to the month's last day. month_weekday: the
//     same n-th weekday; the 5th (or the month's last) becomes the last one.
//   * Each occurrence is computed from the previous one.

const MINUTE_MS = 60 * 1000;

function lastSundayOfMonth(year: number, monthIndex: number): number {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return last.getUTCDate() - last.getUTCDay();
}

// CEST (+120) from the last Sunday of March 01:00 UTC to the last Sunday of
// October 01:00 UTC, CET (+60) otherwise.
function amsterdamOffsetMinutes(ms: number): number {
  const year = new Date(ms).getUTCFullYear();
  const start = Date.UTC(year, 2, lastSundayOfMonth(year, 2), 1);
  const end = Date.UTC(year, 9, lastSundayOfMonth(year, 9), 1);
  return ms >= start && ms < end ? 120 : 60;
}

function toMs(value: number | string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function isDateOnly(ms: number): boolean {
  return ms % (24 * 60 * MINUTE_MS) === 0;
}

function toWall(ms: number, dateOnly: boolean): Date {
  return new Date(dateOnly ? ms : ms + amsterdamOffsetMinutes(ms) * MINUTE_MS);
}

function fromWall(wall: Date, dateOnly: boolean): Date {
  const wallMs = wall.getTime();
  if (dateOnly) return new Date(wallMs);
  const guess = wallMs - amsterdamOffsetMinutes(wallMs - 60 * MINUTE_MS) * MINUTE_MS;
  return new Date(wallMs - amsterdamOffsetMinutes(guess) * MINUTE_MS);
}

function withDate(wall: Date, year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(
    year, monthIndex, day,
    wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds(), wall.getUTCMilliseconds(),
  ));
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addMonthsClamped(wall: Date, monthsToAdd: number): Date {
  const monthIndex = wall.getUTCMonth() + monthsToAdd;
  const year = wall.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  return withDate(wall, year, month, Math.min(wall.getUTCDate(), daysInMonth(year, month)));
}

function monthlyWeekdayParts(wall: Date): MonthlyWeekdayParts {
  const day = wall.getUTCDate();
  return {
    weekdayIndex: wall.getUTCDay(),
    occurrenceIndex: Math.floor((day - 1) / 7),
    isLastOccurrence: day + 7 > daysInMonth(wall.getUTCFullYear(), wall.getUTCMonth()),
  };
}

function nthWeekdayInFollowingMonth(wall: Date): Date {
  const parts = monthlyWeekdayParts(wall);
  const monthIndex = wall.getUTCMonth() + 1;
  const year = wall.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  const total = daysInMonth(year, month);
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  let day = 1 + ((parts.weekdayIndex - firstWeekday + 7) % 7) + parts.occurrenceIndex * 7;
  if (parts.isLastOccurrence || day > total) {
    const lastWeekday = new Date(Date.UTC(year, month, total)).getUTCDay();
    day = total - ((lastWeekday - parts.weekdayIndex + 7) % 7);
  }
  return withDate(wall, year, month, day);
}

/** The next occurrence after `baseDate`, exactly as the server creates it. */
export function getNextRecurringDate(repeatInterval: RepeatInterval, baseDate: number | string | Date): Date | null {
  const ms = toMs(baseDate);
  if (Number.isNaN(ms)) return null;
  const dateOnly = isDateOnly(ms);
  const wall = toWall(ms, dateOnly);
  let next: Date;

  switch (repeatInterval) {
    case 'day':
      next = withDate(wall, wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + 1);
      break;
    case 'week':
      next = withDate(wall, wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + 7);
      break;
    case 'month':
      next = addMonthsClamped(wall, 1);
      break;
    case 'month_weekday':
      next = nthWeekdayInFollowingMonth(wall);
      break;
    case 'year':
      next = addMonthsClamped(wall, 12);
      break;
    default:
      return null;
  }
  return fromWall(next, dateOnly);
}

function getMonthlyWeekdayParts(dateInput: number | string | Date): MonthlyWeekdayParts {
  const ms = toMs(dateInput);
  return monthlyWeekdayParts(toWall(ms, isDateOnly(ms)));
}

export function getRepeatDescriptor(
  repeatInterval?: RepeatInterval | null,
  dueDate?: number | string,
  language: SupportedLanguage = 'en'
): string | null {
  if (!repeatInterval) return null;

  const labels = language === 'nl'
    ? { day: 'Elke dag', week: 'Elke week', month: 'Elke maand', year: 'Elk jaar' }
    : language === 'fr'
      ? { day: 'Chaque jour', week: 'Chaque semaine', month: 'Chaque mois', year: 'Chaque année' }
      : language === 'de'
        ? { day: 'Jeden Tag', week: 'Jede Woche', month: 'Jeden Monat', year: 'Jedes Jahr' }
        : language === 'es'
          ? { day: 'Cada día', week: 'Cada semana', month: 'Cada mes', year: 'Cada año' }
          : { day: 'Every day', week: 'Every week', month: 'Every month', year: 'Every year' };

  if (repeatInterval !== 'month_weekday') {
    return labels[repeatInterval];
  }

  if (!dueDate) {
    return language === 'nl' ? 'Elke eerste maandag van de maand'
      : language === 'fr' ? 'Chaque premier lundi du mois'
      : language === 'de' ? 'Jeden ersten Montag des Monats'
      : language === 'es' ? 'Cada primer lunes del mes'
      : 'Every first Monday of the month';
  }

  const { weekdayIndex, occurrenceIndex, isLastOccurrence } = getMonthlyWeekdayParts(dueDate);
  const weekday = language === 'nl' ? WEEKDAY_INDEX_TO_NAME_NL[weekdayIndex]
    : language === 'fr' ? WEEKDAY_INDEX_TO_NAME_FR[weekdayIndex]
    : language === 'de' ? WEEKDAY_INDEX_TO_NAME_DE[weekdayIndex]
    : language === 'es' ? WEEKDAY_INDEX_TO_NAME_ES[weekdayIndex]
    : WEEKDAY_INDEX_TO_NAME_EN[weekdayIndex];

  if (isLastOccurrence) {
    return language === 'nl' ? `Elke laatste ${weekday} van de maand`
      : language === 'fr' ? `Chaque dernier ${weekday} du mois`
      : language === 'de' ? `Jeden letzten ${weekday} des Monats`
      : language === 'es' ? `Cada último ${weekday} del mes`
      : `Every last ${weekday} of the month`;
  }

  const ordinal = language === 'nl'
    ? ORDINALS_NL[Math.min(occurrenceIndex, ORDINALS_NL.length - 1)]
    : language === 'fr'
      ? ORDINALS_FR[Math.min(occurrenceIndex, ORDINALS_FR.length - 1)]
      : language === 'de'
        ? ORDINALS_DE[Math.min(occurrenceIndex, ORDINALS_DE.length - 1)]
        : language === 'es'
          ? ORDINALS_ES[Math.min(occurrenceIndex, ORDINALS_ES.length - 1)]
          : ORDINALS[Math.min(occurrenceIndex, ORDINALS.length - 1)];

  return language === 'nl'
    ? `Elke ${ordinal} ${weekday} van de maand`
    : language === 'fr'
      ? `Chaque ${ordinal} ${weekday} du mois`
      : language === 'de'
        ? `Jeden ${ordinal}n ${weekday} des Monats`
        : language === 'es'
          ? `Cada ${ordinal} ${weekday} del mes`
          : `Every ${ordinal} ${weekday} of the month`;
}

export function getNextRecurringDueDate(repeatInterval: RepeatInterval, baseDateIso: string): string {
  const next = getNextRecurringDate(repeatInterval, baseDateIso);
  return (next ?? new Date(baseDateIso)).toISOString();
}
