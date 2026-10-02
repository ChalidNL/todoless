// pb_hooks/lib/ics-recurrence.js
// #257 — map an imported VEVENT's RRULE onto the app's recurrence model
// (tasks.repeat_interval), so an imported series behaves like one made in the
// app: the calendar shows its occurrences and completing one creates the
// next. Only rules the model expresses exactly are mapped:
//
//   FREQ=DAILY                          -> day
//   FREQ=WEEKLY  [BYDAY=<start weekday>] -> week
//   FREQ=MONTHLY [BYMONTHDAY=<start day>] -> month
//   FREQ=MONTHLY BYDAY=<n><WD> matching the start (n = its week, or -1 when
//                it is the month's last such weekday)            -> month_weekday
//   FREQ=YEARLY  [BYMONTH=<start month>][BYMONTHDAY=<start day>] -> year
//
// always with INTERVAL absent or 1 and no COUNT/UNTIL (the model has no end).
// Anything else returns null; the importer then keeps the raw RRULE and the
// app shows the event once, marked as not fully supported.
//
// Pure JS, no PocketBase globals - unit-tested by tests/ics-recurrence.test.mjs.

var WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function parseRrule(rrule) {
  var parts = {}
  var text = String(rrule || '').trim().replace(/^RRULE:/i, '')
  if (!text) return null
  var pieces = text.split(';')
  for (var i = 0; i < pieces.length; i++) {
    if (!pieces[i]) continue
    var eq = pieces[i].indexOf('=')
    if (eq <= 0) return null
    var key = pieces[i].slice(0, eq).trim().toUpperCase()
    if (Object.prototype.hasOwnProperty.call(parts, key)) return null
    parts[key] = pieces[i].slice(eq + 1).trim().toUpperCase()
  }
  return parts
}

// `start` is the anchor in the terms recurrence.js uses: { weekdayIndex,
// occurrenceIndex, isLastOccurrence, day, month } (month 1-12).
function rruleToRepeatInterval(rrule, start) {
  var parts = parseRrule(rrule)
  if (!parts || !parts.FREQ || !start) return null
  if (parts.INTERVAL !== undefined && parts.INTERVAL !== '1') return null
  if (parts.COUNT !== undefined || parts.UNTIL !== undefined) return null

  var allowed = { FREQ: 1, INTERVAL: 1, WKST: 1 }
  var weekday = WEEKDAYS[start.weekdayIndex]

  switch (parts.FREQ) {
    case 'DAILY':
      return onlyKeys(parts, allowed) ? 'day' : null
    case 'WEEKLY':
      if (parts.BYDAY !== undefined && parts.BYDAY !== weekday) return null
      return onlyKeys(parts, withKeys(allowed, ['BYDAY'])) ? 'week' : null
    case 'MONTHLY':
      if (parts.BYDAY !== undefined) {
        if (!onlyKeys(parts, withKeys(allowed, ['BYDAY']))) return null
        var m = /^([+-]?\d)([A-Z]{2})$/.exec(parts.BYDAY)
        if (!m || m[2] !== weekday) return null
        var n = parseInt(m[1], 10)
        if (n === -1) return start.isLastOccurrence ? 'month_weekday' : null
        // The 5th weekday becomes "the last" in the app's model, which is
        // exactly RRULE n=5 only in months that have five; not mapped.
        if (n >= 1 && n <= 4 && n === start.occurrenceIndex + 1) return 'month_weekday'
        return null
      }
      if (parts.BYMONTHDAY !== undefined && parts.BYMONTHDAY !== String(start.day)) return null
      // A plain monthly rule on the 29th-31st skips short months in RRULE but
      // clamps to the month's last day in the app; only map days 1-28.
      if (start.day > 28) return null
      return onlyKeys(parts, withKeys(allowed, ['BYMONTHDAY'])) ? 'month' : null
    case 'YEARLY':
      if (parts.BYMONTH !== undefined && parts.BYMONTH !== String(start.month)) return null
      if (parts.BYMONTHDAY !== undefined && parts.BYMONTHDAY !== String(start.day)) return null
      if (start.month === 2 && start.day === 29) return null
      return onlyKeys(parts, withKeys(allowed, ['BYMONTH', 'BYMONTHDAY'])) ? 'year' : null
    default:
      return null
  }
}

function withKeys(base, extra) {
  var out = {}
  for (var k in base) out[k] = 1
  for (var i = 0; i < extra.length; i++) out[extra[i]] = 1
  return out
}

function onlyKeys(parts, allowed) {
  for (var k in parts) {
    if (!allowed[k]) return false
  }
  return true
}

module.exports = { rruleToRepeatInterval: rruleToRepeatInterval }
