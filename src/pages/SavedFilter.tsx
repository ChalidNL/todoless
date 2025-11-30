import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { SavedFilters, Todos } from '../db/dexieClient'
import type { SavedFilter as SF, Todo } from '../db/schema'
import { parseDueToDate } from '../utils/date'
import TodoCard from '../components/TodoCard'
import useFilteredTodos from '../hooks/useFilteredTodos'
import { useViewMode } from '../contexts/ViewModeContext'
import CheckedDivider from '../components/CheckedDivider'
import CalendarView from '../components/CalendarView'
import WorkflowKanban from '../components/WorkflowKanban'
import { Workflows } from '../db/dexieClient'
import type { Workflow } from '../db/schema'
import useLabels from '../hooks/useLabels'
import { useAuth } from '../store/auth'
import { evaluateFilterQuery } from '../utils/evaluateFilterQuery'

const VIEW_TITLES: Record<string, string> = {
  all: 'All',
  today: 'Today',
  completed: 'Completed',
}

export default function SavedFilter() {
  const { filterId } = useParams()
  const { todos: globalFilteredTodos, reload: reloadTodos } = useFilteredTodos()
  const { labels, reloadLabels } = useLabels()
  const { mode } = useViewMode()
  const { user: authUser } = useAuth()
  const [title, setTitle] = useState(filterId ? VIEW_TITLES[filterId] ?? filterId : 'Saved Filter')
  const [saved, setSaved] = useState<SF | null>(null)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [, setForceUpdate] = useState(0)

  // HOTFIX 0.0.55: Use authenticated user ID from auth store instead of local IndexedDB
  // This ensures @me filter works correctly in production where user IDs may differ
  const currentUserId = authUser?.id ? String(authUser.id) : 'local-user'

  const reloadWorkflows = async () => {
    const ws = await Workflows.list()
    setWorkflows(ws)
  }

  useEffect(() => {
    reloadWorkflows()
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!filterId) return
      // v0.0.57: Load saved filter by numeric ID
      const filterIdNum = parseInt(filterId, 10)
      if (isNaN(filterIdNum)) {
        // Built-in filter (all, today, etc.)
        setSaved(null)
        setTitle(VIEW_TITLES[filterId] ?? filterId)
      } else {
        // Numeric ID - load from IndexedDB
        const v = await SavedFilters.get(filterIdNum)
        if (!active) return
        if (v) {
          setSaved(v)
          setTitle(v.name)
        } else {
          setSaved(null)
          setTitle('Unknown Filter')
        }
      }
      // Force re-render and reload todos when filterId changes
      await reloadTodos()
      setForceUpdate(prev => prev + 1)
    })()
    return () => { active = false }
  }, [filterId, reloadTodos])

  let filtered = globalFilteredTodos
  if (saved && saved.queryJson) {
    // v0.0.57: Use evaluateFilterQuery to apply saved filter's queryJson
    // HOTFIX: Pass currentUserId for dynamic @me filter evaluation
    filtered = evaluateFilterQuery(globalFilteredTodos, saved.queryJson, currentUserId)
  } else if (filterId) {
    // Built-in filters: use global filters and add specific logic
    filtered = globalFilteredTodos.filter((t: Todo) => {
      if (filterId === 'all') return true
      if (filterId === 'completed') return t.completed
      if (filterId === 'today') return !t.completed
      if (filterId === 'backlog') {
        // Backlog: items with no workflowStage or explicitly in 'Backlog'
        const stage = (t.workflowStage || '').toLowerCase()
        return !stage || stage === 'backlog'
      }
      return true
    })
  }

  // De-duplicate projection for "All" filter: prefer uniqueness by serverId, then clientId, then id
  // Also deduplicate by plain ID to catch any double-rendering issues
  if (filterId === 'all') {
    const seen = new Set<string>()
    filtered = filtered.filter((t: Todo) => {
      // Primary dedup: serverId or clientId or local id
      const key = (t.serverId ? `s:${t.serverId}` : (t.clientId ? `c:${t.clientId}` : `l:${t.id}`))
      if (seen.has(key)) return false
      // Secondary dedup: plain ID (in case serverId/clientId not set)
      if (seen.has(t.id)) return false
      seen.add(key)
      seen.add(t.id)
      return true
    })
  }

  // Split into unchecked and checked
  const unchecked = filtered.filter((t) => !t.completed)
  const checked = filtered.filter((t) => t.completed)

  // Calendar view
  if (mode === 'calendar') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">{title}</div>
        </div>
        <CalendarView todos={filtered} />
      </div>
    )
  }

  // Kanban view (only when eligible workflow exists)
  if (mode === 'kanban') {
    const eligible = workflows.find((w) => Array.isArray(w.stages) && w.stages.length >= 3 && w.checkboxOnly !== true)
    if (!eligible) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{title}</div>
          </div>
          <div className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No multi-stage workflow found. Add a workflow with 3+ stages to use Kanban.
          </div>
        </div>
      )
    }
    const kanbanTodos = filtered.filter((t) => t.workflowId === eligible.id && !t.completed)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">{title}</div>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3">
          <WorkflowKanban workflow={eligible} todos={kanbanTodos} labels={labels} onReload={reloadWorkflows} />
        </div>
      </div>
    )
  }

  // Backlog special filter with quick-move arrow
  if (filterId === 'backlog') {
    const defaultWf = workflows.find((w) => w.id === 'default-kanban') || workflows.find((w) => w.isDefault)
    const firstNonBacklog = defaultWf?.stages?.find(s => s.toLowerCase() !== 'backlog') || defaultWf?.stages?.[0]
    const handleMoveRight = async (todo: Todo) => {
      if (!defaultWf || !firstNonBacklog) return
      await Todos.update(todo.id, { workflowId: defaultWf.id, workflowStage: firstNonBacklog, completed: false })
      await reloadWorkflows()
    }
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Backlog</div>
        </div>
        <div className="space-y-2">
          {unchecked.map((t) => (
            <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-2 flex items-center justify-between">
              <div className="text-sm">{t.title}</div>
              {defaultWf && firstNonBacklog && (
                <button
                  className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50"
                  title={`Move to ${firstNonBacklog}`}
                  onClick={() => handleMoveRight(t)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </button>
              )}
            </div>
          ))}
          {unchecked.length === 0 && (
            <div className="text-sm text-gray-600">No backlog items</div>
          )}
        </div>
      </div>
    )
  }

  // List/Tiles view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">{title}</div>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-sm text-gray-500">No todos in this filter.</div>
      ) : (
        <>
          <div className={mode === 'tiles' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>
            {unchecked.map((t) => (
              <TodoCard
                key={t.id}
                todo={t}
                labels={labels}
                onToggle={async (id, completed) => {
                  await Todos.update(id, { completed })
                }}
                onUpdate={async (id, title) => {
                  await Todos.update(id, { title })
                }}
                onLabelsChange={reloadLabels}
              />
            ))}
          </div>
          
          <CheckedDivider 
            checkedTodoIds={checked.map((t) => t.id)}
            onUncheckComplete={reloadWorkflows}
          />
          
          {checked.length > 0 && (
            <div className={mode === 'tiles' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>
              {checked.map((t) => (
                <TodoCard
                  key={t.id}
                  todo={t}
                  labels={labels}
                  onToggle={async (id, completed) => {
                    await Todos.update(id, { completed })
                  }}
                  onUpdate={async (id, title) => {
                    await Todos.update(id, { title })
                  }}
                  onLabelsChange={reloadLabels}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
