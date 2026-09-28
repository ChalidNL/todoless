// pb_hooks/lib/recurrence.js
// GH#7 — pure recurrence date math, ported from the never-loaded legacy
// pb_hooks/cron/recurring-tasks.js (pre-0.23 API, no .pb.js suffix).
//
// Pure JS — no PocketBase globals — so the same file can be
//   * required from PB Goja hook handlers (require(__hooks + '/lib/recurrence.js')), and
//   * unit-tested by `node --test tests/recurrence.test.mjs` (see that file).

const AMSTERDAM_TIME_ZONE = 'Europe/Amsterdam'

function toDate(value) {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value)
}

function getTimeZoneOffsetMinutes(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  })
  const timeZoneName = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+00:00'
  const match = timeZoneName.match(/GMT([+-])(\d{2}):(\d{2})/)

  if (!match) {
    return 0
  }

  const [, sign, hours, minutes] = match
  const totalMinutes = (Number(hours) * 60) + Number(minutes)
  return sign === '-' ? -totalMinutes : totalMinutes
}

function createAmsterdamNoonDate(year, monthIndex, day) {
  const utcGuess = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0, 0))
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, AMSTERDAM_TIME_ZONE)
  return new Date(utcGuess.getTime() - (offsetMinutes * 60_000))
}

function toCalendarDate(value) {
  if (typeof value === 'string') {
    const utcMidnightMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.000)?Z$/)
    if (utcMidnightMatch) {
      const [, year, month, day] = utcMidnightMatch
      return createAmsterdamNoonDate(Number(year), Number(month) - 1, Number(day))
    }
  }

  return toDate(value)
}

function addMonthsPreservingDay(baseDate, monthsToAdd) {
  const year = baseDate.getUTCFullYear()
  const monthIndex = baseDate.getUTCMonth() + monthsToAdd
  const targetYear = year + Math.floor(monthIndex / 12)
  const normalizedMonth = ((monthIndex % 12) + 12) % 12
  const daysInMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(baseDate.getUTCDate(), daysInMonth)

  return new Date(Date.UTC(
    targetYear,
    normalizedMonth,
    targetDay,
    baseDate.getUTCHours(),
    baseDate.getUTCMinutes(),
    baseDate.getUTCSeconds(),
    baseDate.getUTCMilliseconds()
  ))
}

function getMonthlyWeekdayParts(input) {
  const date = toCalendarDate(input)
  const dayOfMonth = date.getUTCDate()
  const occurrenceIndex = Math.floor((dayOfMonth - 1) / 7)
  const weekdayIndex = date.getUTCDay()
  const nextSameWeekday = new Date(date.getTime())
  nextSameWeekday.setUTCDate(dayOfMonth + 7)

  return {
    weekdayIndex,
    occurrenceIndex,
    isLastOccurrence: nextSameWeekday.getUTCMonth() !== date.getUTCMonth(),
  }
}

function getNthWeekdayInFollowingMonth(baseDate) {
  const calendarDate = toCalendarDate(baseDate)
  const targetMonthSeed = addMonthsPreservingDay(calendarDate, 1)
  const targetYear = targetMonthSeed.getUTCFullYear()
  const targetMonth = targetMonthSeed.getUTCMonth()
  const { weekdayIndex, occurrenceIndex, isLastOccurrence } = getMonthlyWeekdayParts(calendarDate)

  const firstDayOfMonth = new Date(Date.UTC(
    targetYear,
    targetMonth,
    1,
    calendarDate.getUTCHours(),
    calendarDate.getUTCMinutes(),
    calendarDate.getUTCSeconds(),
    calendarDate.getUTCMilliseconds()
  ))

  const firstWeekdayOffset = (weekdayIndex - firstDayOfMonth.getUTCDay() + 7) % 7
  const firstWeekdayDate = 1 + firstWeekdayOffset
  let targetDay = firstWeekdayDate + (occurrenceIndex * 7)

  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()

  if (isLastOccurrence || targetDay > daysInMonth) {
    const lastDayOfMonth = new Date(Date.UTC(
      targetYear,
      targetMonth,
      daysInMonth,
      calendarDate.getUTCHours(),
      calendarDate.getUTCMinutes(),
      calendarDate.getUTCSeconds(),
      calendarDate.getUTCMilliseconds()
    ))
    const reverseOffset = (lastDayOfMonth.getUTCDay() - weekdayIndex + 7) % 7
    targetDay = daysInMonth - reverseOffset
  }

  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    targetDay,
    calendarDate.getUTCHours(),
    calendarDate.getUTCMinutes(),
    calendarDate.getUTCSeconds(),
    calendarDate.getUTCMilliseconds()
  ))
}

function getNextRecurringDate(repeatInterval, baseDateInput) {
  const rawDate = toDate(baseDateInput)
  const nextDate = new Date(rawDate.getTime())

  switch (repeatInterval) {
    case 'day':
      nextDate.setUTCDate(nextDate.getUTCDate() + 1)
      return nextDate
    case 'week':
      nextDate.setUTCDate(nextDate.getUTCDate() + 7)
      return nextDate
    case 'month':
      return addMonthsPreservingDay(toCalendarDate(baseDateInput), 1)
    case 'month_weekday':
      return getNthWeekdayInFollowingMonth(baseDateInput)
    case 'year':
      nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1)
      return nextDate
    default:
      return null
  }
}

module.exports = {
  getNextRecurringDate,
  toCalendarDate,
};