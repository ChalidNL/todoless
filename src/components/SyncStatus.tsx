import { useSync } from '../store/sync'
import { useRealtime } from '../store/realtime'
import { useEffect, useState } from 'react'

export default function SyncStatus() {
  const { phase, lastSyncAt, pendingCount, hasConflicts } = useSync()
  const { status, reconnectAttempt, nextReconnectAt } = useRealtime()
  const [timeAgo, setTimeAgo] = useState('')

  useEffect(() => {
    if (!lastSyncAt) return

    const updateTimeAgo = () => {
      const now = Date.now()
      const diff = now - lastSyncAt
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)

      if (hours > 0) {
        setTimeAgo(`${hours}h ago`)
      } else if (minutes > 0) {
        setTimeAgo(`${minutes}m ago`)
      } else if (seconds > 0) {
        setTimeAgo(`${seconds}s ago`)
      } else {
        setTimeAgo('just now')
      }
    }

    updateTimeAgo()
    const interval = setInterval(updateTimeAgo, 10000) // Update every 10s
    return () => clearInterval(interval)
  }, [lastSyncAt])

  // Don't show if everything is idle and no sync has happened
  if (phase === 'idle' && !lastSyncAt && status === 'disconnected' && !hasConflicts) {
    return null
  }

  const getStatusColor = () => {
    if (hasConflicts) return 'text-red-600'
    if (status === 'error') return 'text-red-600'
    if (status === 'connected') return 'text-green-600'
    if (status === 'connecting' || phase === 'running') return 'text-yellow-600'
    return 'text-gray-500'
  }

  const getStatusIcon = () => {
    if (hasConflicts) return '⚠️'
    if (status === 'error') return '⚠️'
    if (status === 'connected') return '✓'
    if (status === 'connecting' || phase === 'running') return '⟳'
    return '○'
  }

  const getStatusText = () => {
    if (hasConflicts) return 'Sync conflicts detected'
    if (phase === 'running') return 'Syncing...'
    if (status === 'connecting') return 'Connecting...'
    if (status === 'error') {
      if (reconnectAttempt > 0 && nextReconnectAt) {
        const secondsUntil = Math.max(0, Math.floor((nextReconnectAt - Date.now()) / 1000))
        return `Reconnecting in ${secondsUntil}s (attempt ${reconnectAttempt})`
      }
      return 'Connection error'
    }
    if (status === 'connected') {
      if (pendingCount > 0) {
        return `${pendingCount} pending`
      }
      return lastSyncAt ? `Synced ${timeAgo}` : 'Connected'
    }
    return 'Offline'
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`${getStatusColor()} font-medium`}>
        {getStatusIcon()}
      </span>
      <span className={getStatusColor()}>
        {getStatusText()}
      </span>
    </div>
  )
}
