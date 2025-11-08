import { useEffect, useMemo, useState } from 'react'
import ManagementHeader from '../components/ManagementHeader'
import { useRealtime } from '../store/realtime'

interface LogEntry {
  id: number
  timestamp: string // ISO string for stability across refreshes
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const { status, lastEventAt, errorCount, lastError } = useRealtime()
  const [levelFilter, setLevelFilter] = useState<LogEntry['level']>(() => {
    try {
      return (localStorage.getItem('logLevelFilter') as LogEntry['level']) || 'debug'
    } catch {
      return 'debug'
    }
  })
  const statusUI = useMemo(() => {
    const map: Record<string, { color: string; text: string; title?: string }> = {
      connected: { color: 'bg-green-500', text: 'connected' },
      connecting: { color: 'bg-yellow-500', text: 'connecting…' },
      error: { color: 'bg-orange-500', text: `errors (${errorCount})`, title: lastError },
      disconnected: { color: 'bg-red-500', text: 'not connected' },
    }
    const s = map[status] || map.disconnected
    const since = lastEventAt ? ` • last event ${timeAgo(lastEventAt)}` : ''
    return { ...s, label: `${s.text}${since}` }
  }, [status, lastEventAt, errorCount, lastError])
  const [debugEnabled, setDebugEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('debugEnabled')
      return stored !== 'false' // default ON
    } catch {
      return true
    }
  })

  useEffect(() => {
    try { localStorage.setItem('debugEnabled', String(debugEnabled)) } catch {}
  }, [debugEnabled])

  // Persist logs to survive refresh and keep original timestamps
  useEffect(() => {
    try {
      const raw = localStorage.getItem('adminLogs')
      if (raw) {
        const parsed = JSON.parse(raw) as LogEntry[]
        setLogs(parsed.slice(-500))
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    try { localStorage.setItem('adminLogs', JSON.stringify(logs.slice(-500))) } catch {}
  }, [logs])

  useEffect(() => {
    if (!debugEnabled) return
    // Intercept console methods
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error
    const originalInfo = console.info

    const addLog = (level: LogEntry['level'], ...args: any[]) => {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
      const entry: LogEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        level,
        message,
      }
      setLogs(prev => [...prev.slice(-499), entry]) // Keep last 500
    }

    console.log = (...args: any[]) => {
      addLog('debug', ...args)
      originalLog(...args)
    }
    console.info = (...args: any[]) => {
      addLog('info', ...args)
      originalInfo(...args)
    }
    console.warn = (...args: any[]) => {
      addLog('warn', ...args)
      originalWarn(...args)
    }
    console.error = (...args: any[]) => {
      addLog('error', ...args)
      originalError(...args)
    }

    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
      console.info = originalInfo
    }
  }, [debugEnabled])

  useEffect(() => {
    if (autoScroll) {
      const el = document.getElementById('logs-container')
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [logs, autoScroll])

  const clearLogs = () => setLogs([])

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <ManagementHeader
        title="Logs"
        infoText="Real-time console output voor debugging. Logs worden automatisch bijgewerkt."
        showCreate={false}
        showSearch={false}
      />
      <div className="p-4 border-b bg-white flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-4 h-4 rounded-full ${statusUI.color}`} title={statusUI.title || ''}></span>
          <span className="text-sm text-gray-700">Realtime: {statusUI.label}</span>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={debugEnabled} onChange={(e) => setDebugEnabled(e.target.checked)} />
          Capture logs
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          Level
          <select
            className="border rounded px-2 py-1 text-sm"
            value={levelFilter}
            onChange={(e) => {
              const v = e.target.value as LogEntry['level']
              setLevelFilter(v)
              try { localStorage.setItem('logLevelFilter', v) } catch {}
            }}
          >
            <option value="debug">debug (laagste)</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error (hoogste)</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>
        <button className="btn text-sm" onClick={clearLogs}>Clear</button>
        <div className="text-sm text-gray-600">{logs.length} entries</div>
      </div>
      <div id="logs-container" className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-gray-900 text-gray-100">
        {logs.length === 0 ? (
          <div className="text-gray-500">No logs yet...</div>
        ) : (
          logs
            .filter(log => severity(log.level) >= severity(levelFilter))
            .map(log => (
              <div key={log.id} className="mb-1 flex gap-2">
                <span className="text-gray-500">{formatTime(log.timestamp)}</span>
                <span className={`font-semibold ${
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warn' ? 'text-yellow-400' :
                  log.level === 'info' ? 'text-blue-400' :
                  'text-gray-300'
                }`}>{log.level.toUpperCase()}</span>
                <span className="flex-1">{log.message}</span>
              </div>
            ))
        )}
      </div>
    </div>
  )
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  if (diff < 1000) return 'just now'
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

function severity(level: LogEntry['level']): number {
  switch (level) {
    case 'debug': return 10
    case 'info': return 20
    case 'warn': return 30
    case 'error': return 40
    default: return 10
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString()
  } catch {
    return iso
  }
}
