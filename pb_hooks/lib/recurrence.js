// pb_hooks/lib/recurrence.js
// GH#7 — pure recurrence date math, ported from the never-loaded legacy
// pb_hooks/cron/recurring-tasks.js (pre-0.23 API, no .pb.js suffix).
//
// Pure JS — no PocketBase globals and no Intl (Goja has none) — so the same
// file can be
//   * required from PB Goja hook handlers (require(__hooks + '/lib/recurrence.js')), and
//   * unit-tested by `node --test tests/recurrence.test.mjs` (see that file).
//
// src/lib/repeat-schedule.ts is a line-for-line TypeScript copy for the
// calendar preview; src/__tests__/recurrence-client-server.test.ts runs both
// over every interval and several years of anchors and requires identical
// dates (#256). Change both or neither.
//
// The rule:
//   * A date at exactly 00:00:00.000 UTC is a date-only value (how the app
//     stores a due date without a time): it moves by calendar days in UTC and
//     stays at UTC midnight.
//   * Any other date is a moment in time: it moves on the Europe/Amsterdam
//     wall clock, so "every Monday 09:00" stays 09:00 across DST changes.
//   * month: same day of the month, clamped to the month's last day.
//   * month_weekday: the same n-th weekday of the month; the 5th (or one
//     that is the month's last) becomes the last one.
//   * Each occurrence is computed from the previous one, exactly as the
//     server creates them.

var MINUTE_MS = 60 * 1000

// Last Sunday of the given month (0-based), as a UTC day of the month.
function lastSundayOfMonth(year, monthIndex) {
  var last = new Date(Date.UTC(year, monthIndex + 1, 0))
  return last.getUTCDate() - last.getUTCDay()
}

// Europe/Amsterdam offset from UTC in minutes at the given instant: CEST
// (+120) from the last Sunday of March 01:00 UTC to the last Sunday of
// October 01:00 UTC, CET (+60) otherwise (EU rule since 1996).
function amsterdamOffsetMinutes(ms) {
  var year = new Date(ms).getUTCFullYear()
  var start = Date.UTC(year, 2, lastSundayOfMonth(year, 2), 1)
  var end = Date.UTC(year, 9, lastSundayOfMonth(year, 9), 1)
  return ms >= start && ms < end ? 120 : 60
}

function toMs(value) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime()
}

function isDateOnly(ms) {
  return ms % (24 * 60 * MINUTE_MS) === 0
}

// Wall-clock fields as a "UTC" Date (read them with getUTC*).
function toWall(ms, dateOnly) {
  return new Date(dateOnly ? ms : ms + amsterdamOffsetMinutes(ms) * MINUTE_MS)
}

function fromWall(wall, dateOnly) {
  var wallMs = wall.getTime()
  if (dateOnly) return new Date(wallMs)
  // The offset depends on the result itself; one correction step settles it
  // (a wall time inside the spring-forward gap lands an hour later).
  var guess = wallMs - amsterdamOffsetMinutes(wallMs - 60 * MINUTE_MS) * MINUTE_MS
  return new Date(wallMs - amsterdamOffsetMinutes(guess) * MINUTE_MS)
}

function withDate(wall, year, monthIndex, day) {
  return new Date(Date.UTC(
    year, monthIndex, day,
    wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds(), wall.getUTCMilliseconds()
  ))
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function addMonthsClamped(wall, monthsToAdd) {
  var monthIndex = wall.getUTCMonth() + monthsToAdd
  var year = wall.getUTCFullYear() + Math.floor(monthIndex / 12)
  var month = ((monthIndex % 12) + 12) % 12
  return withDate(wall, year, month, Math.min(wall.getUTCDate(), daysInMonth(year, month)))
}

// Which weekday of its month a wall date is: index 0 = first, and whether it
// is the month's last one.
function monthlyWeekdayParts(wall) {
  var day = wall.getUTCDate()
  return {
    weekdayIndex: wall.getUTCDay(),
    occurrenceIndex: Math.floor((day - 1) / 7),
    isLastOccurrence: day + 7 > daysInMonth(wall.getUTCFullYear(), wall.getUTCMonth()),
  }
}

function nthWeekdayInFollowingMonth(wall) {
  var parts = monthlyWeekdayParts(wall)
  var monthIndex = wall.getUTCMonth() + 1
  var year = wall.getUTCFullYear() + Math.floor(monthIndex / 12)
  var month = monthIndex % 12
  var total = daysInMonth(year, month)
  var firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay()
  var day = 1 + ((parts.weekdayIndex - firstWeekday + 7) % 7) + parts.occurrenceIndex * 7
  if (parts.isLastOccurrence || day > total) {
    var lastWeekday = new Date(Date.UTC(year, month, total)).getUTCDay()
    day = total - ((lastWeekday - parts.weekdayIndex + 7) % 7)
  }
  return withDate(wall, year, month, day)
}

function getNextRecurringDate(repeatInterval, baseDateInput) {
  var ms = toMs(baseDateInput)
  if (isNaN(ms)) return null
  var dateOnly = isDateOnly(ms)
  var wall = toWall(ms, dateOnly)
  var next

  switch (repeatInterval) {
    case 'day':
      next = withDate(wall, wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + 1)
      break
    case 'week':
      next = withDate(wall, wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + 7)
      break
    case 'month':
      next = addMonthsClamped(wall, 1)
      break
    case 'month_weekday':
      next = nthWeekdayInFollowingMonth(wall)
      break
    case 'year':
      next = addMonthsClamped(wall, 12)
      break
    default:
      return null
  }
  return fromWall(next, dateOnly)
}

// The monthly-weekday pattern of a date, in the same terms the next date is
// computed with (for labels such as "every second Monday").
function getMonthlyWeekdayParts(dateInput) {
  var ms = toMs(dateInput)
  return monthlyWeekdayParts(toWall(ms, isDateOnly(ms)))
}

// Calendar position of a date for matching an imported RRULE (#257): the
// monthly-weekday parts plus day of month and month (1-12), in the same
// date-only / Amsterdam wall-clock terms as above.
function getAnchorParts(dateInput) {
  var ms = toMs(dateInput)
  var wall = toWall(ms, isDateOnly(ms))
  var parts = monthlyWeekdayParts(wall)
  parts.day = wall.getUTCDate()
  parts.month = wall.getUTCMonth() + 1
  return parts
}

module.exports = {
  getNextRecurringDate: getNextRecurringDate,
  getAnchorParts: getAnchorParts,
  getMonthlyWeekdayParts: getMonthlyWeekdayParts,
  amsterdamOffsetMinutes: amsterdamOffsetMinutes,
}
