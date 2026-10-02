import { RepeatInterval } from '../types';
import { t } from '../i18n/translations';

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

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(value), template);
}

/** Full label of a repeat pattern ("Every second Monday of the month"). */
export function getRepeatDescriptor(
  repeatInterval?: RepeatInterval | null,
  dueDate?: number | string,
  language: SupportedLanguage = 'en'
): string | null {
  if (!repeatInterval) return null;
  if (repeatInterval !== 'month_weekday') return t(`repeat.${repeatInterval}`, language);
  if (!dueDate) return t('repeat.monthWeekdayFallback', language);

  const { weekdayIndex, occurrenceIndex, isLastOccurrence } = getMonthlyWeekdayParts(dueDate);
  const weekday = t(`repeat.weekday.${weekdayIndex}`, language);
  if (isLastOccurrence) return fill(t('repeat.monthWeekdayLast', language), { weekday });
  return fill(t('repeat.monthWeekday', language), { ordinal: t(`repeat.ordinal.${Math.min(occurrenceIndex, 4) + 1}`, language), weekday });
}

/**
 * Short chip label of a monthly-weekday pattern ("Mon · 2nd Monday"); without
 * a date, the default pattern (first Monday).
 */
export function getMonthWeekdayChipLabel(dueDate: number | string | undefined, language: SupportedLanguage): string {
  const { weekdayIndex, occurrenceIndex, isLastOccurrence } = dueDate
    ? getMonthlyWeekdayParts(dueDate)
    : { weekdayIndex: 1, occurrenceIndex: 0, isLastOccurrence: false };
  const weekday = t(`repeat.weekday.${weekdayIndex}`, language);
  if (isLastOccurrence) return fill(t('repeat.chipMonthWeekdayLast', language), { weekday });
  return fill(t('repeat.chipMonthWeekday', language), { ordinal: t(`repeat.chipOrdinal.${Math.min(occurrenceIndex, 4) + 1}`, language), weekday });
}

export function getNextRecurringDueDate(repeatInterval: RepeatInterval, baseDateIso: string): string {
  const next = getNextRecurringDate(repeatInterval, baseDateIso);
  return (next ?? new Date(baseDateIso)).toISOString();
}
