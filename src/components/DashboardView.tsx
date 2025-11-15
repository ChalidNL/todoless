import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Todos, Workflows, Labels, Notes, Attributes, Users, todoBus } from '../db/dexieClient'
import type { Todo, AttributeDef } from '../db/schema'
import { useSync } from '../store/sync'

interface SummaryCardProps {
  title: string
  value: number
  color?: string
}

function SummaryCard({ title, value, color = 'indigo' }: SummaryCardProps) {
  const colorClasses: Record<string, string> = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  }
  
  return (
    <div className={`p-6 rounded-xl border-2 ${colorClasses[color]} transition-all hover:shadow-md`}>
      <div className="text-sm font-medium opacity-80">{title}</div>
      <div className="text-4xl font-bold mt-2">{value}</div>
    </div>
  )
}

export default function DashboardView() {
  const navigate = useNavigate()
  const { ready } = useSync()
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    blocked: 0,
    pending: 0,
    dueToday: 0,
    overdue: 0,
    workflows: 0,
    labels: 0,
    notes: 0,
    completionRate: 0,
  })
  const [myTasks, setMyTasks] = useState<Todo[]>([])
  const [attrWidgets, setAttrWidgets] = useState<Array<{ name: string; data: Array<{ label: string; count: number }> }>>([])

  useEffect(() => {
    let cancelled = false

    const loadStats = async () => {
      try {
        // Fetch server counters as source of truth
        let serverCounters = null
        try {
          const response = await fetch('/api/counters', { credentials: 'include' })
          if (response.ok) {
            serverCounters = await response.json()
          }
        } catch (e) {
          console.warn('Failed to fetch server counters, using local data', e)
        }

        const [todos, workflows, labels, notes, attrs, users] = await Promise.all([
          Todos.list(),
          Workflows.list(),
          Labels.list(),
          Notes.list(),
          Attributes.list(),
          Users.list(),
        ])

        if (cancelled) return

        // Use server counters if available, otherwise fall back to local
        const total = serverCounters?.total ?? todos.length
        const completed = serverCounters?.completed ?? todos.filter((t: Todo) => t.completed).length
        const pending = serverCounters?.active ?? todos.filter((t: Todo) => !t.completed).length
        const labelsCount = serverCounters?.labels ?? labels.length

        const blocked = todos.filter((t: Todo) => t.blocked).length

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStr = today.toISOString().split('T')[0]

        const dueToday = todos.filter((t: Todo) => {
          if (t.completed) return false
          const due = t.dueDate || (t.attributes as any)?.dueDate
          return due && due.startsWith(todayStr)
        }).length

        const overdue = todos.filter((t: Todo) => {
          if (t.completed) return false
          const due = t.dueDate || (t.attributes as any)?.dueDate
          if (!due) return false
          return due < todayStr
        }).length

        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

        setStats({
          total,
          completed,
          blocked,
          pending,
          dueToday,
          overdue,
          workflows: workflows.length,
          labels: labelsCount,
          notes: notes.length,
          completionRate,
        })

        const currentUserId = users[0]?.id || 'local-user'
        // My tasks = tasks assigned to me (via assigneeIds)
        const mine = todos.filter((t: Todo) =>
          !t.completed &&
          Array.isArray(t.assigneeIds) &&
          t.assigneeIds.includes(currentUserId)
        )
        setMyTasks(
          mine
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
            .slice(0, 5)
        )

        const widgets = attrs
          .filter((def: AttributeDef) => def.type === 'select' && Array.isArray(def.options) && def.options.length > 0)
          .map(def => {
            const counts: Record<string, number> = {}
            todos.forEach(todo => {
              const value = (todo.attributes as any)?.[def.id]
              if (!value) return
              counts[value] = (counts[value] || 0) + 1
            })

            const rows = (def.options || [])
              .map(opt => ({
                label: opt.label || opt.value,
                count: counts[opt.value] || 0,
              }))
              .filter(row => row.count > 0)
              .sort((a, b) => b.count - a.count)
              .slice(0, 4)

            if (!rows.length) return null
            return { name: def.name, data: rows }
          })
          .filter((widget): widget is { name: string; data: Array<{ label: string; count: number }> } => Boolean(widget))
          .slice(0, 4)

        setAttrWidgets(widgets)
      } catch (error) {
        console.error('Failed to load dashboard stats', error)
      }
    }

    void loadStats()

    const handler: EventListener = () => { void loadStats() }
    const customHandler = (e: Event) => { void loadStats() }

    todoBus.addEventListener('todo:added', handler)
    todoBus.addEventListener('todo:updated', handler)
    todoBus.addEventListener('todo:removed', handler)
    todoBus.addEventListener('todo:mutated', handler)
    window.addEventListener('todos:refresh', customHandler)
    window.addEventListener('labels:refresh', customHandler)

    return () => {
      cancelled = true
      todoBus.removeEventListener('todo:added', handler)
      todoBus.removeEventListener('todo:updated', handler)
      todoBus.removeEventListener('todo:removed', handler)
      todoBus.removeEventListener('todo:mutated', handler)
      window.removeEventListener('todos:refresh', customHandler)
      window.removeEventListener('labels:refresh', customHandler)
    }
  }, [])

  // Recompute when initial sync finishes to avoid showing zeros after login
  useEffect(() => {
    if (ready) {
      ;(async () => {
        const todos = await Todos.list()
        if (todos.length) {
          // Trigger recompute via bus so we reuse logic
          todoBus.dispatchEvent(new CustomEvent('todo:mutated'))
        }
      })()
    }
  }, [ready])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Overview of your tasks and workflows</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button onClick={() => navigate('/saved/all')} className="text-left">
          <SummaryCard title="Total Tasks" value={stats.total} color="indigo" />
        </button>
        <SummaryCard title="Pending" value={stats.pending} color="purple" />
        <SummaryCard title="Completed" value={stats.completed} color="green" />
        <SummaryCard title="Due Today" value={stats.dueToday} color="indigo" />
        <SummaryCard title="Overdue" value={stats.overdue} color="red" />
        {stats.blocked > 0 && (
          <SummaryCard title="Blocked" value={stats.blocked} color="red" />
        )}
      </div>

      {/* Completion Progress */}
      <div className="p-6 rounded-xl border-2 border-gray-200 bg-white">
        <div className="text-sm font-medium text-gray-600">Completion Rate</div>
        <div className="text-3xl font-bold text-gray-900 mt-1">{stats.completionRate}%</div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-600 h-2 rounded-full transition-all"
            style={{ width: `${stats.completionRate}%` }}
          />
        </div>
      </div>

      {/* My Tasks */}
      {myTasks.length > 0 && (
        <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-900">My tasks</div>
            <button
              onClick={() => navigate('/saved/me')}
              className="text-xs underline text-gray-600 hover:text-gray-900"
            >
              View all
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {myTasks.map(t => (
              <li key={t.id} className="py-2 flex items-center justify-between">
                <div className="text-sm text-gray-800 truncate pr-3">{t.title}</div>
                {t.dueDate && (
                  <div className="text-xs text-gray-500 shrink-0">{t.dueDate}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Attribute widgets */}
      {attrWidgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attrWidgets.map(w => (
            <div key={w.name} className="p-4 rounded-xl border-2 border-gray-200 bg-white">
              <div className="text-sm font-semibold text-gray-900 mb-3">{w.name}</div>
              <div className="grid grid-cols-4 gap-2">
                {w.data.map(row => (
                  <div key={row.label} className="p-2 rounded-lg border border-gray-200 text-center">
                    <div className="text-xs text-gray-500">{row.label}</div>
                    <div className="text-xl font-bold text-gray-900">{row.count}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Links Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/manage/workflows')}
          className="p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-gray-400 hover:shadow-md transition-all text-left"
        >
          <div className="mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="text-sm font-medium text-gray-900">{stats.workflows} Workflows</div>
          <div className="text-xs text-gray-500">Manage workflows</div>
        </button>
        <button
          onClick={() => navigate('/manage/labels')}
          className="p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-gray-400 hover:shadow-md transition-all text-left"
        >
          <div className="mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <div className="text-sm font-medium text-gray-900">{stats.labels} Labels</div>
          <div className="text-xs text-gray-500">Organize with labels</div>
        </button>
        <button
          onClick={() => navigate('/manage/notes')}
          className="p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-gray-400 hover:shadow-md transition-all text-left"
        >
          <div className="mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div className="text-sm font-medium text-gray-900">{stats.notes} Notes</div>
          <div className="text-xs text-gray-500">Reference notes</div>
        </button>
        <button
          onClick={() => navigate('/manage/views')}
          className="p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-gray-400 hover:shadow-md transition-all text-left"
        >
          <div className="mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div className="text-sm font-medium text-gray-900">Saved Views</div>
          <div className="text-xs text-gray-500">Custom filters</div>
        </button>
      </div>
    </div>
  )
}
