import { useEffect, useState } from 'react'
import { SavedViews } from '../db/dexieClient'
import type { SavedView } from '../db/schema'
import ToggleSwitch from '../components/ui/ToggleSwitch'
import ManagementHeader from '../components/ManagementHeader'

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

export default function ViewsManagement() {
  const [views, setViews] = useState<SavedView[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<SavedView>>({})
  const [q, setQ] = useState<string>(() => {
    try { return localStorage.getItem('globalQuery') || '' } catch { return '' }
  })
  const [createPopup, setCreatePopup] = useState(false)

  const loadViews = async () => {
    await SavedViews.ensureMeView()
    const all = await SavedViews.list()
    setViews(all)
  }

  useEffect(() => {
    loadViews()
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

  const startEdit = (view: SavedView) => {
    // Don't allow editing default views
    if (view.isDefault || view.isSystem) return
    setEditingId(view.id)
    setEditForm({ ...view })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async () => {
    if (!editingId || !editForm.name?.trim()) return
    
    const duplicate = views.find(
      (v) => v.id !== editingId && v.name.toLowerCase() === editForm.name!.toLowerCase()
    )
    if (duplicate) {
      alert(`View "${editForm.name}" already exists`)
      return
    }
    
    if (editForm.name.toLowerCase() === 'all') {
      alert('"All" is a reserved system view name')
      return
    }

    await SavedViews.update(editingId, editForm)
    await loadViews()
    cancelEdit()
  }

  const deleteView = async (id: string) => {
    const target = views.find(v => v.id === id)
    if (target?.isSystem || target?.isDefault) {
      alert('This view is a system/default view and cannot be deleted')
      return
    }
    if (!confirm('Delete this view?')) return
    await SavedViews.remove(id)
    await loadViews()
  }

  const filteredViews = views.filter(v => 
    v.name.toLowerCase().includes(q.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <ManagementHeader
        title="Views"
        infoText="Beheer je opgeslagen weergaven. Pas filters toe en klik op Save om een view op te slaan."
        onCreateClick={() => setCreatePopup(true)}
        createTitle="Create view"
        searchValue={q}
        onSearchChange={(val) => {
          setQ(val)
          try { localStorage.setItem('globalQuery', val) } catch {}
          window.dispatchEvent(new CustomEvent('global-search', { detail: val }))
        }}
        searchPlaceholder="Search views..."
        compact
      />

      {/* Views grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredViews.map(view => (
            <div 
              key={view.id} 
              className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow"
            >
              {editingId === view.id ? (
                <div className="space-y-3">
                  {/* Name input */}
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder="View name"
                  />

                  {/* Icon picker */}
                  <div className="grid grid-cols-5 gap-1">
                    {iconOptions.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setEditForm({ ...editForm, icon })}
                        className={`w-full aspect-square flex items-center justify-center text-lg border-2 rounded ${
                          editForm.icon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="flex-1 w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-gray-100"
                      title="Save"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-gray-100"
                      title="Cancel"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Icon and name */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-base flex-shrink-0">
                        {view.icon || '🔖'}
                      </div>
                      <div className="font-medium text-sm truncate" title={view.name}>
                        {view.name}
                      </div>
                    </div>
                    {(view.isSystem || view.isDefault) && (
                      <div className="text-xs text-gray-400" title="Default view">⭐</div>
                    )}
                  </div>

                  {/* Compact metadata + toggle */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-xs text-gray-500">
                      {view.labelFilterIds && view.labelFilterIds.length > 0 && `${view.labelFilterIds.length} filters`}
                      {view.sortBy && ` • ${view.sortBy}`}
                    </div>
                    <ToggleSwitch
                      size="sm"
                      label="Sidebar"
                      checked={view.showInSidebar !== false}
                      onChange={async (checked) => {
                        await SavedViews.update(view.id, { showInSidebar: checked })
                        await loadViews()
                        window.dispatchEvent(new CustomEvent('saved-views:refresh'))
                      }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {!view.isDefault && !view.isSystem ? (
                      <button
                        onClick={() => startEdit(view)}
                        className="flex-1 w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-gray-100"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    ) : (
                      <div className="flex-1 w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 opacity-30 cursor-not-allowed">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                    )}
                    {!view.isSystem && !view.isDefault ? (
                      <button
                        onClick={() => deleteView(view.id)}
                        className="w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-red-50 text-red-600"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    ) : (
                      <div className="w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 opacity-30 cursor-not-allowed">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {filteredViews.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            {q ? 'No views found' : 'No saved views yet. Create views by applying filters and clicking save!'}
          </div>
        )}
      </div>

      {/* Create Popup */}
      {createPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setCreatePopup(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Create View</h2>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const name = formData.get('name') as string
              const icon = formData.get('icon') as string || '📌'
              if (!name.trim()) return
              const id = await SavedViews.add({ name, icon, showInSidebar: true, viewMode: 'list' })
              const v = await SavedViews.get(id)
              setViews((prev) => [...prev, v!])
              setCreatePopup(false)
            }}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="View name"
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <div className="grid grid-cols-8 gap-2">
                  {['📌', '📋', '⭐', '🎯', '📊', '📅', '🔖', '🏷️', '📁', '🗂️', '📌', '🔍', '🎨', '⚡', '🔥', '💡'].map((emoji) => (
                    <label key={emoji} className="flex items-center justify-center cursor-pointer">
                      <input type="radio" name="icon" value={emoji} className="sr-only peer" />
                      <span className="text-2xl p-1 rounded hover:bg-gray-100 peer-checked:bg-blue-100 peer-checked:ring-2 peer-checked:ring-blue-500">{emoji}</span>
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
