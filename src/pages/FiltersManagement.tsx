import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { SavedFilters, Labels, Workflows, Users } from '../db/dexieClient'
import type { SavedFilter, Label, Workflow, User } from '../db/schema'
import ToggleSwitch from '../components/ui/ToggleSwitch'
import ManagementHeader from '../components/ManagementHeader'
import { useAuth } from '../store/auth'

const iconOptions = [
  // General
  '🔍', '🧩', '📋', '📊', '🎯', '🔖', '📌', '⭐', '🏷️', '📁',
  '🗂️', '📂', '🔔', '✅', '💼', '🎨', '🚀', '⚡', '🌟', '💡',
  // Requested categories
  '🛒', // grocery cart
  '🧾', // administration / receipts
  '🏀', // sports
  '🛠️', // repairs
  '🎓', // school
  '🔁', // subscriptions (recurring)
  '💳', // subscriptions (billing)
]

export default function FiltersManagement() {
  const { user: authUser } = useAuth()
  const [filters, setFilters] = useState<SavedFilter[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<SavedFilter>>({})
  const [q, setQ] = useState<string>(() => {
    try { return localStorage.getItem('globalQuery') || '' } catch { return '' }
  })
  const [createPopup, setCreatePopup] = useState(false)
  const [labels, setLabels] = useState<Label[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [users, setUsers] = useState<User[]>([])

  const loadFilters = async () => {
    // HOTFIX 0.0.55: Pass authenticated user ID
    await SavedFilters.ensureMeFilter(authUser?.id)
    const all = await SavedFilters.list()
    setFilters(all)
  }

  const loadData = async () => {
    const [filtersData, labelsData, workflowsData, usersData] = await Promise.all([
      SavedFilters.list(),
      Labels.list(),
      Workflows.list(),
      Users.list(),
    ])
    setFilters(filtersData)
    setLabels(labelsData)
    setWorkflows(workflowsData)
    setUsers(usersData)
  }

  useEffect(() => {
    loadData()
  }, [])

  // Sync with global search
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setQ(typeof detail === 'string' ? detail : '')
    }
    window.addEventListener('global-search', handler)
    return () => window.removeEventListener('global-search', handler)
  }, [])

  const clearGlobalSearch = () => {
    try { localStorage.setItem('globalQuery', '') } catch {}
    window.dispatchEvent(new CustomEvent('global-search', { detail: '' }))
  }

  const startEdit = (filter: SavedFilter) => {
    // Don't allow editing default filters
    if (filter.isDefault || filter.isSystem) return
    setEditingId(filter.id)
    setEditForm({ ...filter })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async () => {
    if (!editingId || !editForm.name?.trim()) return

    const duplicate = filters.find(
      (v) => v.id !== editingId && v.name.toLowerCase() === editForm.name!.toLowerCase()
    )
    if (duplicate) {
      alert(`Filter "${editForm.name}" already exists`)
      return
    }

    if (editForm.name.toLowerCase() === 'all') {
      alert('"All" is a reserved system filter name')
      return
    }

    await SavedFilters.update(editingId, editForm)
    await loadData()
    cancelEdit()
  }

  const deleteFilter = async (id: string) => {
    const target = filters.find(v => v.id === id)
    if (target?.isSystem || target?.isDefault) {
      alert('This filter is a system/default filter and cannot be deleted')
      return
    }
    if (!confirm('Delete this filter?')) return
    await SavedFilters.remove(id)
    await loadData()
  }

  const filteredFilters = filters.filter(v => 
    v.name.toLowerCase().includes(q.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <ManagementHeader
        title="Filters"
        infoText="Beheer je opgeslagen weergaven. Pas filters toe en klik op Save om een filter op te slaan."
        onCreateClick={() => setCreatePopup(true)}
        createTitle="Create filter"
        searchValue={q}
        onSearchChange={(val) => {
          setQ(val)
          try { localStorage.setItem('globalQuery', val) } catch {}
          window.dispatchEvent(new CustomEvent('global-search', { detail: val }))
        }}
        searchPlaceholder="Search filters..."
        compact
      />

      {/* Filters grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredFilters.map(filter => (
            <div 
              key={filter.id} 
              className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow"
            >
              {editingId === filter.id ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {/* Name input */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                      placeholder="Filter name"
                    />
                  </div>

                  {/* Icon picker */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Icon</label>
                    <div className="grid grid-cols-5 gap-1">
                      {iconOptions.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, icon })}
                          className={`w-full aspect-square flex items-center justify-center text-lg border-2 rounded ${
                            editForm.icon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Labels selection */}
                  {labels.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Labels</label>
                      <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                        {labels.map((label) => {
                          const isSelected = editForm.labelFilterIds?.includes(label.id) || false
                          return (
                            <label key={label.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const current = editForm.labelFilterIds || []
                                  const updated = e.target.checked
                                    ? [...current, label.id]
                                    : current.filter(id => id !== label.id)
                                  setEditForm({ ...editForm, labelFilterIds: updated })
                                }}
                                className="rounded border-gray-300"
                              />
                              <span className="w-3 h-3 rounded" style={{ backgroundColor: label.color }} />
                              <span className="flex-1">{label.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Workflows selection */}
                  {workflows.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Workflows</label>
                      <div className="max-h-24 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                        {workflows.map((workflow) => {
                          const currentWorkflows = editForm.attributeFilters?.workflows?.split(',').filter(Boolean) || []
                          const isSelected = currentWorkflows.includes(workflow.id)
                          return (
                            <label key={workflow.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const updated = e.target.checked
                                    ? [...currentWorkflows, workflow.id]
                                    : currentWorkflows.filter(id => id !== workflow.id)
                                  setEditForm({
                                    ...editForm,
                                    attributeFilters: {
                                      ...editForm.attributeFilters,
                                      workflows: updated.join(',')
                                    }
                                  })
                                }}
                                className="rounded border-gray-300"
                              />
                              <span className="flex-1">{workflow.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Assignees selection */}
                  {users.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Assignees</label>
                      <div className="max-h-24 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                        {users.map((user) => {
                          const currentAssignees = editForm.attributeFilters?.assignees?.split(',').filter(Boolean) || []
                          const isSelected = currentAssignees.includes(user.id)
                          return (
                            <label key={user.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const updated = e.target.checked
                                    ? [...currentAssignees, user.id]
                                    : currentAssignees.filter(id => id !== user.id)
                                  setEditForm({
                                    ...editForm,
                                    attributeFilters: {
                                      ...editForm.attributeFilters,
                                      assignees: updated.join(',')
                                    }
                                  })
                                }}
                                className="rounded border-gray-300"
                              />
                              <span className="flex-1">{user.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sort by */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Sort by</label>
                    <select
                      value={editForm.attributeFilters?.sort || editForm.sortBy || 'created'}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        sortBy: e.target.value,
                        attributeFilters: {
                          ...editForm.attributeFilters,
                          sort: e.target.value
                        }
                      })}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      <option value="created">Created date</option>
                      <option value="updated">Updated date</option>
                      <option value="title">Title</option>
                      <option value="dueDate">Due date</option>
                    </select>
                  </div>

                  {/* Blocked only */}
                  <div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.attributeFilters?.blockedOnly === '1'}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          attributeFilters: {
                            ...editForm.attributeFilters,
                            blockedOnly: e.target.checked ? '1' : '0'
                          }
                        })}
                        className="rounded border-gray-300"
                      />
                      <span className="font-medium text-gray-700">Show blocked tasks only</span>
                    </label>
                  </div>

                  {/* Due date range */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Due date range</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="date"
                        value={editForm.attributeFilters?.dueStart || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          attributeFilters: {
                            ...editForm.attributeFilters,
                            dueStart: e.target.value
                          }
                        })}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                      <span className="text-xs text-gray-500">to</span>
                      <input
                        type="date"
                        value={editForm.attributeFilters?.dueEnd || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          attributeFilters: {
                            ...editForm.attributeFilters,
                            dueEnd: e.target.value
                          }
                        })}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={saveEdit}
                      className="flex-1 px-3 py-2 flex items-center justify-center gap-1 rounded bg-blue-500 text-white hover:bg-blue-600 text-sm"
                      title="Save"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-2 flex items-center justify-center gap-1 rounded border-2 border-gray-300 hover:bg-gray-100 text-sm"
                      title="Cancel"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Icon and name */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="sidebar-icon-container">
                        <Icon emoji={filter.icon || '🔖'} />
                      </div>
                      <div className="font-medium text-sm truncate" title={filter.name}>
                        {filter.name}
                      </div>
                    </div>
                    {(filter.isSystem || filter.isDefault) && (
                      <div className="text-xs text-gray-400" title="System filter">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Compact metadata */}
                  <div className="text-xs text-gray-500 space-y-1 mb-2">
                    {filter.labelFilterIds && filter.labelFilterIds.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {filter.labelFilterIds.slice(0, 3).map(labelId => {
                          const label = labels.find(l => l.id === labelId)
                          if (!label) return null
                          return (
                            <span key={labelId} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50">
                              <span className="w-2 h-2 rounded" style={{ backgroundColor: label.color }} />
                              <span className="text-[10px]">{label.name}</span>
                            </span>
                          )
                        })}
                        {filter.labelFilterIds.length > 3 && (
                          <span className="text-[10px] text-gray-400">+{filter.labelFilterIds.length - 3} more</span>
                        )}
                      </div>
                    )}
                    {filter.attributeFilters?.workflows && (
                      <div className="text-[10px]">Workflows: {filter.attributeFilters.workflows.split(',').length}</div>
                    )}
                    {filter.attributeFilters?.assignees && (
                      <div className="text-[10px]">Assignees: {filter.attributeFilters.assignees.split(',').length}</div>
                    )}
                    {filter.attributeFilters?.blockedOnly === '1' && (
                      <div className="text-[10px] text-red-600">Blocked only</div>
                    )}
                    {(filter.attributeFilters?.dueStart || filter.attributeFilters?.dueEnd) && (
                      <div className="text-[10px]">Due: {filter.attributeFilters.dueStart || '...'} - {filter.attributeFilters.dueEnd || '...'}</div>
                    )}
                    {filter.sortBy && (
                      <div className="text-[10px]">Sort: {filter.sortBy}</div>
                    )}
                  </div>

                  {/* Toggle */}
                  <div className="mb-2">
                    <ToggleSwitch
                      size="sm"
                      label="Sidebar"
                      checked={filter.showInSidebar !== false}
                      onChange={async (checked) => {
                        await SavedFilters.update(filter.id, { showInSidebar: checked })
                        await loadData()
                        window.dispatchEvent(new CustomEvent('saved-filters:refresh'))
                      }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {!filter.isDefault && !filter.isSystem ? (
                      <>
                        <button
                          onClick={() => startEdit(filter)}
                          className="flex-1 w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-gray-100"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteFilter(filter.id)}
                          className="w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-red-50 text-red-600"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>System Default</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {filteredFilters.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            {q ? 'No filters found' : 'No saved filters yet. Create filters by applying filters and clicking save!'}
          </div>
        )}
      </div>

      {/* Create Popup */}
      {createPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setCreatePopup(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Create Filter</h2>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const name = formData.get('name') as string
              const icon = formData.get('icon') as string || '📌'
              if (!name.trim()) return
              const id = await SavedFilters.add({ name, icon, showInSidebar: true, filterMode: 'list' })
              const v = await SavedFilters.get(id)
              setFilters((prev) => [...prev, v!])
              setCreatePopup(false)
            }}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Filter name"
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <div className="grid grid-cols-8 gap-2">
                  {['📌', '📋', '⭐', '🎯', '📊', '📅', '🔖', '🏷️', '📁', '🗂️', '📌', '🔍', '🎨', '⚡', '🔥', '💡'].map((emoji) => (
                    <label key={emoji} className="flex items-center justify-center cursor-pointer">
                      <input type="radio" name="icon" value={emoji} className="sr-only peer" />
                      <span className="text-lg p-0.5 rounded align-middle hover:bg-gray-100 peer-checked:bg-blue-100 peer-checked:ring-2 peer-checked:ring-blue-500" style={{lineHeight: '1', verticalAlign: 'middle'}}>{emoji}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreatePopup(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
