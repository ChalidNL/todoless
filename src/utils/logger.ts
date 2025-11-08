type Level = 'error' | 'warn' | 'info' | 'debug'

function getLevel(): Level {
  try {
    const stored = (localStorage.getItem('logLevel') || '').toLowerCase()
    if (stored === 'error' || stored === 'warn' || stored === 'info' || stored === 'debug') return stored
  } catch {}
  return 'info'
}

function shouldLog(level: Level): boolean {
  const current = getLevel()
  const order: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 }
  return order[level] <= order[current]
}

export const logger = {
  setLevel(level: Level) {
    try { localStorage.setItem('logLevel', level) } catch {}
  },
  getLevel,
  error: (...args: any[]) => { if (shouldLog('error')) console.error('[ERR]', ...args) },
  warn: (...args: any[]) => { if (shouldLog('warn')) console.warn('[WARN]', ...args) },
  info: (...args: any[]) => { if (shouldLog('info')) console.log('[INFO]', ...args) },
  debug: (...args: any[]) => { if (shouldLog('debug')) console.log('[DBG]', ...args) },
}
