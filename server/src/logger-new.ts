export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  t: string
  lvl: LogLevel
  msg: string
  meta?: any
}

// Ring buffer for in-memory log storage (last 500 entries)
const LOG_BUFFER_SIZE = 500
const logBuffer: LogEntry[] = []

function ts() {
  return new Date().toISOString()
}

function addToBuffer(entry: LogEntry) {
  logBuffer.push(entry)
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift() // Remove oldest entry
  }
}

export function getRecentLogs(count: number = 100): LogEntry[] {
  return logBuffer.slice(-count)
}

export const logger = {
  debug: (msg: string, meta?: any) => {
    const entry: LogEntry = { t: ts(), lvl: 'debug', msg, meta }
    console.debug(JSON.stringify(entry))
    addToBuffer(entry)
  },
  info: (msg: string, meta?: any) => {
    const entry: LogEntry = { t: ts(), lvl: 'info', msg, meta }
    console.info(JSON.stringify(entry))
    addToBuffer(entry)
  },
  warn: (msg: string, meta?: any) => {
    const entry: LogEntry = { t: ts(), lvl: 'warn', msg, meta }
    console.warn(JSON.stringify(entry))
    addToBuffer(entry)
  },
  error: (msg: string, meta?: any) => {
    const entry: LogEntry = { t: ts(), lvl: 'error', msg, meta }
    console.error(JSON.stringify(entry))
    addToBuffer(entry)
  },
}
