import { useEffect, useRef, useState } from 'react'
import { Labels, Users, Workflows } from '../db/dexieClient'
import type { Label, User, Workflow } from '../db/schema'
import { useFilterContext } from '../contexts/FilterContext'
import { useViewMode } from '../contexts/ViewModeContext'
import { useSort } from '../contexts/SortContext'
import CloseButton from './ui/CloseButton'

export default function GlobalFilters() {
  const [open, setOpen] = useState(false)
  const [labels, setLabels] = useState<Label[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const {
    selectedLabelIds,
    toggleLabel,
    clear,
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
    selectedTypes,
    setSelectedTypes,
    showCompleted,
    setShowCompleted,
    showArchived,
    setShowArchived,
  } = useFilterContext()
  const { mode, setMode } = useViewMode()
  const { value: sortValue, setValue: setSortValue } = useSort()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([Labels.list(), Users.list(), Workflows.list()]).then(([ls, us, ws]) => {
      setLabels(ls)
      setUsers(us)
      setWorkflows(ws)
    })
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button className="btn text-sm" title="Global filters" onClick={() => setOpen((v) => !v)}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-standard inline-block md:mr-1">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
        <span className="hidden md:inline">Filters</span>
      </button>
      {open && (
        <>
          {/* Backdrop on mobile only */}
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setOpen(false)} />
          <div className="fixed md:absolute left-1/2 md:left-auto top-20 md:top-auto -translate-x-1/2 md:translate-x-0 md:right-0 z-[100] md:mt-2 w-[95vw] max-w-[600px] rounded-lg border-2 border-gray-300 bg-white p-6 shadow-xl text-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-semibold text-gray-900">Global Filters</div>
            <CloseButton onClick={() => setOpen(false)} />
          </div>
          <div className="space-y-5 text-sm text-gray-800">
            {/* Types */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <div className="mb-2 text-xs text-gray-600 font-semibold uppercase">Types</div>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes('tasks')}
                      onChange={(e) => {
                        const checked = e.target.checked
                        const next = new Set(selectedTypes)
                        if (checked) next.add('tasks'); else next.delete('tasks')
                        const arr = Array.from(next) as Array<'tasks' | 'notes'>
                        setSelectedTypes(arr.length ? arr : ['tasks'])
                      }}
                      className="w-4 h-4"
                    />
                    Tasks
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes('notes')}
                      onChange={(e) => {
                        const checked = e.target.checked
                        const next = new Set(selectedTypes)
                        if (checked) next.add('notes'); else next.delete('notes')
                        const arr = Array.from(next) as Array<'tasks' | 'notes'>
                        setSelectedTypes(arr.length ? arr : ['notes'])
                      }}
                      className="w-4 h-4"
                    />
                    Notes
                  </label>
                </div>
              </div>
            </div>

            {/* Icon-only toggles */}
            <div className="flex items-center gap-3">
              <label title="Show completed" className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" className="sr-only" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />
                <svg className={`w-4 h-4 ${showCompleted ? 'text-green-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              </label>
              <label title="Show archived" className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" className="sr-only" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                <svg className={`w-4 h-4 ${showArchived ? 'text-gray-900' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
              </label>
              <label title="Blocked only" className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" className="sr-only" checked={blockedOnly} onChange={(e) => setBlockedOnly(e.target.checked)} />
                <svg className={`w-4 h-4 ${blockedOnly ? 'text-red-600' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h16l-6 7v7l-4-2v-5L4 4z"/></svg>
              </label>
            </div>
            {/* View Mode & Sort - mobile only */}
            <div className="md:hidden space-y-3 pb-3 border-b border-gray-200">
              <div>
                <div className="mb-2 text-xs text-gray-600 font-medium">View Mode</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode('list')}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded border-2 ${mode === 'list' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 hover:bg-gray-50'}`}
                    title="List"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setMode('tiles')}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded border-2 ${mode === 'tiles' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 hover:bg-gray-50'}`}
                    title="Tiles"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setMode('calendar')}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded border-2 ${mode === 'calendar' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 hover:bg-gray-50'}`}
                    title="Calendar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setMode('kanban')}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded border-2 ${mode === 'kanban' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 hover:bg-gray-50'}`}
                    title="Kanban"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h5v10H3zM10 7h4v10h-4zM16 7h5v10h-5z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs text-gray-600 font-medium">Sort By</div>
                <select
                  value={sortValue}
                  onChange={(e) => setSortValue(e.target.value as any)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="order">Manual Order</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="created">Created Date</option>
                  <option value="due">Due Date</option>
                </select>
              </div>
            </div>
            
            {/* Due Date Range */}
            <div>
              <div className="mb-2 text-xs text-gray-600 font-semibold uppercase">Due Date Range</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-xs text-gray-500">Start</div>
                  <input className="input text-sm py-1.5 w-full" type="date" value={dueStart || ''} onChange={(e) => setDueStart(e.target.value || null)} />
                </div>
                <div>
                  <div className="mb-1 text-xs text-gray-500">End</div>
                  <input className="input text-sm py-1.5 w-full" type="date" value={dueEnd || ''} onChange={(e) => setDueEnd(e.target.value || null)} />
                </div>
              </div>
            </div>

            {/* Filters Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="mb-2 text-xs text-gray-600 font-semibold uppercase">Labels</div>
                <div className="space-y-1">
                  {labels.length === 0 ? (
                    <div className="text-xs text-gray-400">No labels</div>
                  ) : (
                    labels.slice(0, 6).map((l) => (
                      <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedLabelIds.includes(l.id)}
                          onChange={() => toggleLabel(l.id)}
                          className="w-3.5 h-3.5"
                        />
                        <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                        <span className="flex-1 truncate text-sm">{l.name}</span>
                      </label>
                    ))
                  )}
                  {labels.length > 6 && <div className="text-xs text-gray-400 px-1">+{labels.length - 6} more...</div>}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs text-gray-600 font-semibold uppercase">Assignees</div>
                <div className="space-y-1">
                  {users.length === 0 ? (
                    <div className="text-xs text-gray-400">No users</div>
                  ) : (
                    users.slice(0, 6).map((u) => (
                      <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedAssigneeIds.includes(u.id)}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setSelectedAssigneeIds(
                              checked ? [...selectedAssigneeIds, u.id] : selectedAssigneeIds.filter((x) => x !== u.id)
                            )
                          }}
                          className="w-3.5 h-3.5"
                        />
                        <span className="flex-1 truncate text-sm">{u.name || 'User'}</span>
                      </label>
                    ))
                  )}
                  {users.length > 6 && <div className="text-xs text-gray-400 px-1">+{users.length - 6} more...</div>}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs text-gray-600 font-semibold uppercase">Workflows</div>
                <div className="space-y-1">
                  {workflows.length === 0 ? (
                    <div className="text-xs text-gray-400">No workflows</div>
                  ) : (
                    workflows.slice(0, 6).map((w) => (
                      <label key={w.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedWorkflowIds.includes(w.id)}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setSelectedWorkflowIds(
                              checked ? [...selectedWorkflowIds, w.id] : selectedWorkflowIds.filter((x) => x !== w.id)
                            )
                          }}
                          className="w-3.5 h-3.5"
                        />
                        <span className="flex-1 truncate text-sm">{w.name}</span>
                      </label>
                    ))
                  )}
                  {workflows.length > 6 && <div className="text-xs text-gray-400 px-1">+{workflows.length - 6} more...</div>}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={blockedOnly} onChange={(e) => setBlockedOnly(e.target.checked)} className="w-4 h-4" />
                <span>Blocked only</span>
              </label>
              <button className="px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md border border-gray-300" onClick={clear}>Clear All</button>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  )
}
