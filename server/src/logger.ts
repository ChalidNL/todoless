export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function ts() {
  return new Date().toISOString()
}

export const logger = {
  debug: (msg: string, meta?: any) => console.debug(JSON.stringify({ t: ts(), lvl: 'debug', msg, meta })),
  info: (msg: string, meta?: any) => console.info(JSON.stringify({ t: ts(), lvl: 'info', msg, meta })),
  warn: (msg: string, meta?: any) => console.warn(JSON.stringify({ t: ts(), lvl: 'warn', msg, meta })),
  error: (msg: string, meta?: any) => console.error(JSON.stringify({ t: ts(), lvl: 'error', msg, meta })),
}
