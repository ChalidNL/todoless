import { useEffect, useRef, useState } from 'react'
import { Labels, Users, Workflows, Attributes } from '../db/dexieClient'
import type { Label, User, Workflow, AttributeDef } from '../db/schema'
import { useFilterContext } from '../contexts/FilterContext'
import { useViewMode } from '../contexts/ViewModeContext'
import { useSort } from '../contexts/SortContext'
import CloseButton from './ui/CloseButton'

export default function GlobalFilters() {
  const [open, setOpen] = useState(false)
  const [labels, setLabels] = useState<Label[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [attributes, setAttributes] = useState<AttributeDef[]>([])
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
    Promise.all([Labels.list(), Users.list(), Workflows.list(), Attributes.list()]).then(([ls, us, ws, as]) => {
      setLabels(ls)
      // v0.0.49: Show ALL users without filtering
      // Deduplicate by ID to avoid duplicates
      const seen = new Set<string>()
      const filtered = us.filter(u => {
        if (seen.has(u.id)) return false
        seen.add(u.id)
        return true
      })
      setUsers(filtered)
      setWorkflows(ws)
      setAttributes(as)
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
            <div>
              <div className="mb-2 text-xs text-gray-600 font-semibold uppercase">Types</div>
              <div className="flex flex-wrap gap-2">
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
              <button
                title={blockedOnly ? "Show all items" : "Show blocked only"}
                onClick={() => setBlockedOnly(!blockedOnly)}
                className={`inline-flex items-center justify-center w-8 h-8 rounded border transition-all ${
                  blockedOnly ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <svg className={`w-4 h-4 ${blockedOnly ? 'text-red-600' : 'text-gray-600'}`} fill={blockedOnly ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
              </button>
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

            {/* Filters Grid - Multi-select dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Labels Dropdown */}
              <div>
                <div className="mb-2 text-xs text-gray-600 font-semibold uppercase">
                  Labels {selectedLabelIds.length > 0 && `(${selectedLabelIds.length})`}
                </div>
                <details className="relative">
                  <summary className="cursor-pointer list-none px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm">
                    {selectedLabelIds.length === 0 ? (
                      <span className="text-gray-500">Select labels...</span>
                    ) : (
                      <span className="text-gray-900">
                        {selectedLabelIds.length === 1
                          ? labels.find(l => l.id === selectedLabelIds[0])?.name
                          : `${selectedLabelIds.length} labels selected`}
                      </span>
                    )}
                  </summary>
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto border border-gray-300 rounded-md bg-white shadow-lg">
                    {/* v0.0.57: EMPTY option to filter tasks with no labels */}
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-200 bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedLabelIds.includes('EMPTY')}
                        onChange={() => toggleLabel('EMPTY')}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="inline-block h-3 w-3 rounded border border-gray-400 flex-shrink-0 bg-white" />
                      <span className="flex-1 truncate italic text-gray-600">No labels</span>
                    </label>
                    {labels.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-400">No labels defined</div>
                    ) : (
                      labels.map((l) => (
                        <label key={l.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedLabelIds.includes(l.id)}
                            onChange={() => toggleLabel(l.id)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                          <span className="flex-1 truncate">{l.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </details>
              </div>

              {/* Assignees Dropdown */}
              <div>
                <div className="mb-2 text-xs text-gray-600 font-semibold uppercase">
                  Assignees {selectedAssigneeIds.length > 0 && `(${selectedAssigneeIds.length})`}
                </div>
                <details className="relative">
                  <summary className="cursor-pointer list-none px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm">
                    {selectedAssigneeIds.length === 0 ? (
                      <span className="text-gray-500">Select assignees...</span>
                    ) : (
                      <span className="text-gray-900">
                        {selectedAssigneeIds.length === 1
                          ? users.find(u => u.id === selectedAssigneeIds[0])?.name || 'User'
                          : `${selectedAssigneeIds.length} assignees selected`}
                      </span>
                    )}
                  </summary>
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto border border-gray-300 rounded-md bg-white shadow-lg">
                    {/* v0.0.57: EMPTY option to filter tasks with no assignees */}
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-200 bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedAssigneeIds.includes('EMPTY')}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setSelectedAssigneeIds(
                            checked ? [...selectedAssigneeIds, 'EMPTY'] : selectedAssigneeIds.filter((x) => x !== 'EMPTY')
                          )
                        }}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="flex-1 truncate italic text-gray-600">No assignees</span>
                    </label>
                    {users.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-400">No users</div>
                    ) : (
                      users.map((u) => (
                        <label key={u.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedAssigneeIds.includes(u.id)}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setSelectedAssigneeIds(
                                checked ? [...selectedAssigneeIds, u.id] : selectedAssigneeIds.filter((x) => x !== u.id)
                              )
                            }}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="flex-1 truncate">{u.name || 'User'}</span>
                        </label>
                      ))
                    )}
                  </div>
                </details>
              </div>

              {/* Workflows Dropdown */}
              <div>
                <div className="mb-2 text-xs text-gray-600 font-semibold uppercase">
                  Workflows {selectedWorkflowIds.length > 0 && `(${selectedWorkflowIds.length})`}
                </div>
                <details className="relative">
                  <summary className="cursor-pointer list-none px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm">
                    {selectedWorkflowIds.length === 0 ? (
                      <span className="text-gray-500">Select workflows...</span>
                    ) : (
                      <span className="text-gray-900">
                        {selectedWorkflowIds.length === 1
                          ? workflows.find(w => w.id === selectedWorkflowIds[0])?.name
                          : `${selectedWorkflowIds.length} workflows selected`}
                      </span>
                    )}
                  </summary>
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto border border-gray-300 rounded-md bg-white shadow-lg">
                    {workflows.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-400">No workflows</div>
                    ) : (
                      workflows.map((w) => (
                        <label key={w.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedWorkflowIds.includes(w.id)}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setSelectedWorkflowIds(
                                checked ? [...selectedWorkflowIds, w.id] : selectedWorkflowIds.filter((x) => x !== w.id)
                              )
                            }}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="flex-1 truncate">{w.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </details>
              </div>

              {/* Attributes Dropdown (read-only for now) */}
              <div>
                <div className="mb-2 text-xs text-gray-600 font-semibold uppercase">Attributes</div>
                <details className="relative">
                  <summary className="cursor-pointer list-none px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm">
                    <span className="text-gray-500">View attributes...</span>
                  </summary>
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto border border-gray-300 rounded-md bg-white shadow-lg">
                    {attributes.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-400">No attributes</div>
                    ) : (
                      attributes.filter(a => !a.isDefault).map((a) => (
                        <div key={a.id} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                          {a.name}
                        </div>
                      ))
                    )}
                    {attributes.filter(a => !a.isDefault).length === 0 && attributes.length > 0 && (
                      <div className="px-3 py-2 text-xs text-gray-400">Only default attributes</div>
                    )}
                  </div>
                </details>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end pt-2 border-t border-gray-200">
              <button className="px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md border border-gray-300" onClick={clear}>Clear All</button>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  )
}
