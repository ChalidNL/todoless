import { useEffect, useMemo, useState } from 'react'
import ManagementHeader from '../components/ManagementHeader'
import { useRealtime } from '../store/realtime'
import SyncStatus from '../components/SyncStatus'

interface LogEntry {
  t: string // ISO timestamp
  lvl: 'info' | 'warn' | 'error' | 'debug'
  msg: string
  meta?: any
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const { status, lastEventAt, errorCount, lastError } = useRealtime()
  const [levelFilter, setLevelFilter] = useState<LogEntry['lvl']>(() => {
    try {
      return (localStorage.getItem('logLevelFilter') as LogEntry['lvl']) || 'debug'
    } catch {
      return 'debug'
    }
  })
  const [loading, setLoading] = useState(false)
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

  // Fetch server logs on mount
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/logs?count=200', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setLogs(data.logs || [])
        }
      } catch (err) {
        console.error('Failed to fetch server logs:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [])

  useEffect(() => {
    if (autoScroll) {
      const el = document.getElementById('logs-container')
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [logs, autoScroll])

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/logs?count=200', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (err) {
      console.error('Failed to fetch server logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const clearLogs = () => setLogs([])

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <ManagementHeader
        title="Logs"
        infoText="Server logs and diagnostics. Admin only."
        showCreate={false}
        showSearch={false}
      />
      <div className="p-4 border-b bg-white space-y-3">
        {/* Sync Status Section */}
        <div className="flex items-center gap-4 pb-3 border-b border-gray-200">
          <div className="font-medium text-sm text-gray-700">Sync Status:</div>
          <SyncStatus />
          <div className="flex items-center gap-2 ml-auto">
            <span className={`inline-block w-4 h-4 rounded-full ${statusUI.color}`} title={statusUI.title || ''}></span>
            <span className="text-sm text-gray-700">Realtime: {statusUI.label}</span>
          </div>
        </div>

        {/* Log Controls */}
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            Level
            <select
              className="border rounded px-2 py-1 text-sm"
              value={levelFilter}
              onChange={(e) => {
                const v = e.target.value as LogEntry['lvl']
                setLevelFilter(v)
                try { localStorage.setItem('logLevelFilter', v) } catch {}
              }}
            >
              <option value="debug">debug (lowest)</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error (highest)</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
            Auto-scroll
          </label>
          <button className="btn text-sm" onClick={handleRefresh} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <div className="text-sm text-gray-600">{logs.length} entries</div>
        </div>
      </div>
      <div id="logs-container" className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-gray-900 text-gray-100">
        {logs.length === 0 ? (
          <div className="text-gray-500">No logs yet...</div>
        ) : (
          logs
            .filter(log => severity(log.lvl) >= severity(levelFilter))
            .map((log, i) => (
              <div key={i} className="mb-1 flex gap-2">
                <span className="text-gray-500">{formatTime(log.t)}</span>
                <span className={`font-semibold ${
                  log.lvl === 'error' ? 'text-red-400' :
                  log.lvl === 'warn' ? 'text-yellow-400' :
                  log.lvl === 'info' ? 'text-blue-400' :
                  'text-gray-300'
                }`}>{log.lvl.toUpperCase()}</span>
                <span className="flex-1">{log.msg}</span>
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

function severity(level: LogEntry['lvl']): number {
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