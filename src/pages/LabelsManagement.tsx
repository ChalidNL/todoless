import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Label, Todo } from '../db/schema'
import { Labels, Todos } from '../db/dexieClient'
import { useFilterContext } from '../contexts/FilterContext'
import { useAuth } from '../store/auth'
import CreateButton from '../components/ui/CreateButton'
import ManagementHeader from '../components/ManagementHeader'

// Simple random color from a small pleasant palette
function randomColor(): string {
  const palette = ['#0ea5e9', '#84cc16', '#f97316', '#a78bfa', '#10b981', '#ef4444', '#f59e0b']
  return palette[Math.floor(Math.random() * palette.length)]
}

export default function LabelsManagement() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [labels, setLabels] = useState<Label[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [q, setQ] = useState<string>(() => {
    try { return localStorage.getItem('globalQuery') || '' } catch { return '' }
  })
  const [newLabelName, setNewLabelName] = useState('')
  const [editingLabel, setEditingLabel] = useState<Label | null>(null)
  const [createPopup, setCreatePopup] = useState(false)

  const { apply, setSelectedLabelIds, clear } = useFilterContext()

  // Navigate to All view with label filter (v0.0.43: unified behavior)
  const handleLabelClick = (label: Label) => {
    // Use EXACT same pattern as TodoCard label click
    try { clear() } catch {}
    setSelectedLabelIds([label.id])
    navigate('/filter/all')
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

  const loadData = async () => {
    const [labelsData, todosData] = await Promise.all([
      Labels.list(),
      Todos.list(),
    ])
    setLabels(labelsData)
    setTodos(todosData)
  }

  const clearGlobalSearch = () => {
    try { localStorage.setItem('globalQuery', '') } catch {}
    window.dispatchEvent(new CustomEvent('global-search', { detail: '' }))
  }

  const getUsedInCount = (labelId: string) => {
    // Count ALL todos with this label, ignoring any active filters
    return todos.filter((t) => t.labelIds?.includes(labelId)).length
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this label?')) return
    await Labels.remove(id)
    await loadData()
  }

  const handleCreate = async () => {
    const name = newLabelName.trim()
    if (!name) return
    await Labels.add({ name, color: randomColor(), shared: true })
    setNewLabelName('')
    await loadData()
  }

  const handleUpdate = async (label: Label, updates: Partial<Label>) => {
    await Labels.update(label.id, updates)
    await loadData()
  }

  const filteredLabels = labels
    .filter((l) => l.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <ManagementHeader
        title="Labels"
        infoText="Labels groeperen items visueel en kunnen optioneel workflows activeren."
        onCreateClick={() => setCreatePopup(true)}
        createTitle="Create label"
        searchValue={q}
        onSearchChange={(val) => {
          setQ(val)
          try { localStorage.setItem('globalQuery', val) } catch {}
          window.dispatchEvent(new CustomEvent('global-search', { detail: val }))
        }}
        searchPlaceholder="Search labels..."
        compact
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredLabels.map((label) => {
            const isOwner = !label.ownerId || !user?.id || label.ownerId === user.id.toString()
            return (
              <div key={label.id} className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2">
                  {/* Left section: Color picker (only in edit mode), Privacy icon, Color swatch, Count */}
                  {editingLabel?.id === label.id ? (
                    <input
                      type="color"
                      className="w-8 h-8 cursor-pointer rounded border-2 border-gray-300 flex-shrink-0"
                      value={editingLabel.color}
                      onChange={(e) => {
                        const newColor = e.target.value
                        setEditingLabel({ ...editingLabel, color: newColor })
                        handleUpdate(label, { name: editingLabel.name, color: newColor })
                      }}
                    />
                  ) : (
                    <>
                      {/* Privacy icon - visible when private and not editing */}
                      {!label.shared && (
                        <div className="w-6 h-6 flex items-center justify-center text-yellow-600" title="Private">
                          <svg className="w-4 h-4" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      )}
                      {/* Color swatch - visual only */}
                      <div className="w-6 h-6 rounded border-2 border-gray-300 flex-shrink-0 pointer-events-none" style={{ backgroundColor: label.color }} />
                    </>
                  )}
                  {/* Count */}
                  <div className="text-xs text-gray-600 w-6 text-center">{getUsedInCount(label.id)}</div>
                  {/* Name (editable or clickable to filter) */}
                  <div className="flex-1 min-w-0">
                    {editingLabel?.id === label.id ? (
                      <input
                        type="text"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={editingLabel.name}
                        onChange={(e) => setEditingLabel({ ...editingLabel, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingLabel.name.trim()) {
                            handleUpdate(label, { name: editingLabel.name, color: editingLabel.color, shared: editingLabel.shared })
                            setEditingLabel(null)
                          }
                          if (e.key === 'Escape') setEditingLabel(null)
                        }}
                        autoFocus
                      />
                    ) : (
                      <div
                        className="font-medium text-sm cursor-pointer hover:text-accent truncate"
                        onClick={() => handleLabelClick(label)}
                        title={`Filter by ${label.name}`}
                      >
                        {label.name}
                      </div>
                    )}
                  </div>
                  {/* Right section: Privacy toggle (edit mode only), Edit/Save button, Delete button */}
                  {editingLabel?.id === label.id && (
                    <button
                      className={`w-8 h-8 flex items-center justify-center rounded border-2 transition-all ${!editingLabel.shared ? 'border-yellow-400 bg-yellow-50 text-yellow-600' : 'border-gray-300 text-gray-500'} ${!isOwner ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      onClick={() => {
                        if (!isOwner) {
                          alert('Only the label owner can change privacy settings')
                          return
                        }
                        const newShared = !editingLabel.shared
                        setEditingLabel({ ...editingLabel, shared: newShared })
                        handleUpdate(label, { shared: newShared })
                      }}
                      disabled={!isOwner}
                      title={editingLabel.shared ? 'Shared (click to make private)' : 'Private (click to make shared)'}
                    >
                      <svg className="w-4 h-4" fill={!editingLabel.shared ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </button>
                  )}
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-gray-100"
                    onClick={() => {
                      if (editingLabel?.id === label.id) {
                        if (editingLabel.name.trim()) {
                          handleUpdate(label, { name: editingLabel.name, color: editingLabel.color, shared: editingLabel.shared })
                        }
                        setEditingLabel(null)
                      } else {
                        setEditingLabel(label)
                      }
                    }}
                    title={editingLabel?.id === label.id ? 'Save' : 'Edit'}
                  >
                    {editingLabel?.id === label.id ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    )}
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-red-50 text-red-600" onClick={() => handleDelete(label.id)} title="Delete">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {filteredLabels.length === 0 && (
          <div className="text-center text-gray-500 mt-8">{q ? 'No labels found' : 'No labels yet. Create one!'}</div>
        )}
      </div>

      {/* Create Popup */}
      {createPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setCreatePopup(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Create Label</h2>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget as HTMLFormElement)
              const name = formData.get('name') as string
              const color = (formData.get('color') as string) || randomColor()
              if (!name.trim()) return
              await Labels.add({ name, color, shared: true })
              await loadData()
              setCreatePopup(false)
            }}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" name="name" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Label name" autoFocus />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="grid grid-cols-7 gap-2">
                  {['#0ea5e9', '#84cc16', '#f97316', '#a78bfa', '#10b981', '#ef4444', '#f59e0b'].map((color) => (
                    <label key={color} className="flex items-center justify-center cursor-pointer">
                      <input type="radio" name="color" value={color} className="sr-only peer" />
                      <div className="w-8 h-8 rounded border-2 border-gray-300 peer-checked:ring-2 peer-checked:ring-blue-500" style={{ backgroundColor: color }} />
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreatePopup(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
