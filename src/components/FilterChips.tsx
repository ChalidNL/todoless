import { useEffect, useMemo, useState } from 'react'
import { Labels, Users, Workflows, SavedViews } from '../db/dexieClient'
import { useNavigate } from 'react-router-dom'
import type { Label, User, Workflow } from '../db/schema'
import { useFilterContext } from '../contexts/FilterContext'

function Chip({ color, children, onClear }: { color?: string; children: React.ReactNode; onClear: () => void }) {
  return (
    <span
      className="chip border-gray-200 bg-white text-xs px-2 py-1 inline-flex items-center gap-1"
      style={color ? { borderColor: color } : undefined}
    >
      {children}
      <button className="ml-1" onClick={onClear} title="Clear">✖</button>
    </span>
  )
}

export default function FilterChips() {
  const {
    selectedLabelIds,
    toggleLabel,
    blockedOnly,
    setBlockedOnly,
    selectedAssigneeIds,
    setSelectedAssigneeIds,
    selectedWorkflowIds,
    setSelectedWorkflowIds,
    dueStart,
    setDueStart,
    dueEnd,
    setDueEnd,
    clear,
  } = useFilterContext()
  const navigate = useNavigate()

  const [labels, setLabels] = useState<Label[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])

  useEffect(() => {
    Promise.all([Labels.list(), Users.list(), Workflows.list()]).then(([ls, us, ws]) => {
      setLabels(ls)
      setUsers(us)
      setWorkflows(ws)
    })
  }, [])

  const active = useMemo(() => {
    return (
      blockedOnly ||
      selectedLabelIds.length > 0 ||
      selectedAssigneeIds.length > 0 ||
      selectedWorkflowIds.length > 0 ||
      !!dueStart ||
      !!dueEnd
    )
  }, [blockedOnly, selectedLabelIds, selectedAssigneeIds, selectedWorkflowIds, dueStart, dueEnd])

  if (!active) return null

  return (
    <div className="mt-2 flex w-full items-center gap-2 overflow-x-auto whitespace-nowrap pr-1">
      {blockedOnly && (
        <Chip onClear={() => setBlockedOnly(false)}>
          <span title="Blocked only">🚩</span>
        </Chip>
      )}
      {dueStart && (
        <Chip onClear={() => setDueStart(null)}>From {dueStart}</Chip>
      )}
      {dueEnd && (
        <Chip onClear={() => setDueEnd(null)}>To {dueEnd}</Chip>
      )}
      {selectedWorkflowIds.map((id) => {
        const w = workflows.find((x) => x.id === id)
        if (!w) return null
        return (
          <Chip key={id} onClear={() => setSelectedWorkflowIds(selectedWorkflowIds.filter((x) => x !== id))}>
            🧩 {w.name}
          </Chip>
        )
      })}
      {selectedAssigneeIds.map((id) => {
        const u = users.find((x) => x.id === id)
        if (!u) return null
        return (
          <Chip key={id} onClear={() => setSelectedAssigneeIds(selectedAssigneeIds.filter((x) => x !== id))}>
            @ {u.name || 'User'}
          </Chip>
        )
      })}
      {selectedLabelIds.map((id) => {
        const l = labels.find((x) => x.id === id)
        if (!l) return null
        return (
          <Chip key={id} color={l.color} onClear={() => toggleLabel(id)}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} /> {l.name}
          </Chip>
        )
      })}
      <button className="btn text-xs" onClick={clear}>Clear All</button>
      <button
        className="btn text-xs"
        title="Save current filters as a view"
        onClick={async () => {
          const name = window.prompt('Name this view:')?.trim()
          if (!name) return
          // Stash complete filter state in attributeFilters.filters as JSON string to avoid a schema change
          const payload = {
            blockedOnly,
            selectedLabelIds,
            selectedAssigneeIds,
            selectedWorkflowIds,
            dueStart,
            dueEnd,
          }
          const id = await SavedViews.add({
            name,
            attributeFilters: { filters: JSON.stringify(payload) },
          })
          // Notify sidebar to refresh its saved views list
          try { window.dispatchEvent(new Event('saved-views:refresh')) } catch {}
          navigate(`/saved/${id}`)
        }}
      >
        Save View
      </button>
    </div>
  )
}
