// Normalize human-friendly date strings to ISO YYYY-MM-DD where possible
export function normalizeDueDate(raw?: string | null): string | null {
  if (!raw) return null
  const s = String(raw).trim().toLowerCase()
  if (!s) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const toISO = (d: Date) => d.toISOString().substring(0, 10)

  // Common keywords
  if (['today', 'tod', 'now'].includes(s)) return toISO(today)
  if (['tomorrow', 'tmr', 'tmrw', 'tommorow'].includes(s)) {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return toISO(d)
  }

  // next week → 7 days ahead from today
  if (s === 'nextweek' || s === 'next week' || s === 'in a week') {
    const d = new Date(today)
    d.setDate(d.getDate() + 7)
    return toISO(d)
  }

  // Weekday names (next occurrence)
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const idx = weekdays.indexOf(s)
  if (idx >= 0) {
    const d = new Date(today)
    const delta = (idx + 7 - d.getDay()) % 7
    d.setDate(d.getDate() + (delta === 0 ? 7 : delta))
    return toISO(d)
  }

  // Already ISO-like YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // Try parsing locale date safely
  const tryDate = new Date(s)
  if (!isNaN(tryDate.getTime())) return toISO(tryDate)

  return null
}

export function parseDueToDate(raw?: string | null): Date | null {
  const n = normalizeDueDate(raw)
  if (!n) return null
  const d = new Date(`${n}T00:00:00`)
  return isNaN(d.getTime()) ? null : d
}
