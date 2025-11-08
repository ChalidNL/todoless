import { useEffect, useMemo, useState } from 'react'
import { useRealtime } from '../store/realtime'

export default function DebugConsole() {
  const [logs, setLogs] = useState<string[]>([])
  const [visible, setVisible] = useState(false)
  const { status, lastEventAt, errorCount, lastError } = useRealtime()

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

  useEffect(() => {
    const originalLog = console.log
    console.log = (...args: any[]) => {
      originalLog(...args)
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ')
      setLogs(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString()}: ${message}`])
    }

    return () => {
      console.log = originalLog
    }
  }, [])

  if (!visible) {
    return (
      <div className="fixed bottom-20 right-4 z-[100] flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 bg-white/95 border rounded-full shadow px-2 py-1 text-xs">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusUI.color}`} title={statusUI.title || ''}></span>
          <span className="text-gray-700 font-medium">{statusUI.label}</span>
        </div>
        <button
          onClick={() => setVisible(true)}
          className="bg-red-500 text-white px-3 py-2 rounded-full shadow-lg text-xs font-bold"
        >
          DEBUG
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-20 right-4 left-4 z-[100] bg-black/90 text-green-400 p-3 rounded-lg shadow-xl max-h-64 overflow-y-auto text-xs font-mono">
      <div className="flex justify-between items-center mb-2 sticky top-0 bg-black/90">
        <span className="text-white font-bold">Debug Console</span>
        <button
          onClick={() => {
            setLogs([])
            setVisible(false)
          }}
          className="text-white px-2 py-1 bg-red-600 rounded"
        >
          ✖
        </button>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusUI.color}`} title={statusUI.title || ''}></span>
          <span className="text-white">Realtime: {statusUI.label}</span>
        </div>
        {logs.length === 0 && <div className="text-gray-500">No logs yet...</div>}
        {logs.map((log, i) => (
          <div key={i} className="break-all">{log}</div>
        ))}
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
