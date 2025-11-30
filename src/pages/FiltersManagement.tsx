import { useEffect, useState } from 'react'
import { SavedFilters } from '../db/dexieClient'
import type { SavedFilter } from '../db/schema'
import ToggleSwitch from '../components/ui/ToggleSwitch'
import ManagementHeader from '../components/ManagementHeader'
import { useAuth } from '../store/auth'
import { deleteFilterFromServer, updateFilterOnServer } from '../utils/syncFilters'

export default function FiltersManagement() {
  const { user: authUser } = useAuth()
  const [filters, setFilters] = useState<SavedFilter[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [q, setQ] = useState<string>(() => {
    try { return localStorage.getItem('globalQuery') || '' } catch { return '' }
  })

  const loadData = async () => {
    const filtersData = await SavedFilters.list()
    setFilters(filtersData)
  }

  useEffect(() => {
    loadData()

    // HOTFIX 0.0.57: Listen for filter changes from other devices (cross-device sync)
    const handler = () => loadData()
    window.addEventListener('saved-filters:refresh', handler)

    return () => window.removeEventListener('saved-filters:refresh', handler)
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

  const startEdit = (filter: SavedFilter) => {
    // HOTFIX 0.0.57: Don't allow editing system filters (by normalized name)
    const systemFilters = ['all', '@me', 'backlog']
    if (systemFilters.includes(filter.normalizedName)) return
    setEditingId(filter.id)
    setEditName(filter.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return

    const duplicate = filters.find(
      (v) => v.id !== editingId && v.normalizedName === editName.trim().toLowerCase()
    )
    if (duplicate) {
      alert(`Filter "${editName}" already exists`)
      return
    }

    if (editName.toLowerCase() === 'all') {
      alert('"All" is a reserved system filter name')
      return
    }

    await SavedFilters.update(editingId, {
      name: editName,
      normalizedName: editName.trim().toLowerCase(),
    })

    // HOTFIX 0.0.57: Push changes to server with correct parameters
    const updated = await SavedFilters.get(editingId)
    if (updated) {
      updateFilterOnServer(updated.id, {
        name: updated.name,
        queryJson: updated.queryJson,
        menuVisible: updated.menuVisible,
        shared: updated.shared,
        ranking: updated.ranking,
      }).catch(() => {})
    }
    await loadData()
    cancelEdit()
  }

  const deleteFilter = async (id: number) => {
    const target = filters.find(v => v.id === id)
    // HOTFIX 0.0.57: Check if system filter by normalized name
    const systemFilters = ['all', '@me', 'backlog']
    if (target && systemFilters.includes(target.normalizedName)) {
      alert('This filter is a system filter and cannot be deleted')
      return
    }
    if (!confirm('Delete this filter?')) return
    await SavedFilters.remove(id)
    // HOTFIX 0.0.57: Delete from server as well
    deleteFilterFromServer(id).catch(() => {})
    await loadData()
  }

  const toggleMenuVisible = async (filter: SavedFilter) => {
    const systemFilters = ['all', '@me', 'backlog']
    if (systemFilters.includes(filter.normalizedName)) return

    await SavedFilters.update(filter.id, {
      menuVisible: !filter.menuVisible,
    })

    const updated = await SavedFilters.get(filter.id)
    if (updated) {
      updateFilterOnServer(updated.id, {
        menuVisible: updated.menuVisible,
      }).catch(() => {})
    }
    await loadData()
  }

  const toggleShared = async (filter: SavedFilter) => {
    // Only owner can change shared status
    if (filter.ownerId !== authUser?.id) {
      alert('Only the filter owner can change shared status')
      return
    }

    await SavedFilters.update(filter.id, {
      shared: !filter.shared,
    })

    const updated = await SavedFilters.get(filter.id)
    if (updated) {
      updateFilterOnServer(updated.id, {
        shared: updated.shared,
      }).catch(() => {})
    }
    await loadData()
  }

  const filteredFilters = filters.filter(v =>
    v.name.toLowerCase().includes(q.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <ManagementHeader
        title="Filters"
        infoText="Beheer je opgeslagen filters. Gebruik de filter UI op het dashboard en klik op 'Save filter' om een nieuwe filter op te slaan."
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
          {filteredFilters.map(filter => {
            const isSystem = ['all', '@me', 'backlog'].includes(filter.normalizedName)
            const isOwner = filter.ownerId === authUser?.id

            return (
              <div
                key={filter.id}
                className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow"
              >
                {editingId === filter.id ? (
                  <div className="space-y-3">
                    {/* Name input */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                        placeholder="Filter name"
                        autoFocus
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="flex-1 py-1.5 px-3 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 py-1.5 px-3 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm truncate">{filter.name}</h3>
                          {isSystem && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">System</span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {Object.keys(filter.queryJson || {}).length} filter rules
                        </div>
                      </div>
                    </div>

                    {/* Menu Visible Toggle */}
                    {!isSystem && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Show in sidebar</span>
                        <ToggleSwitch
                          checked={filter.menuVisible}
                          onChange={() => toggleMenuVisible(filter)}
                        />
                      </div>
                    )}

                    {/* Shared Toggle */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Shared</span>
                      <ToggleSwitch
                        checked={filter.shared}
                        onChange={() => toggleShared(filter)}
                        disabled={!isOwner}
                      />
                    </div>

                    {!isOwner && (
                      <div className="text-[10px] text-gray-500 italic">
                        Owned by another user
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isSystem && (
                      <div className="flex gap-2 pt-2 border-t border-gray-100">
                        <button
                          onClick={() => startEdit(filter)}
                          className="flex-1 py-1.5 px-3 text-blue-600 text-xs rounded hover:bg-blue-50 border border-blue-200"
                        >
                          Rename
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => deleteFilter(filter.id)}
                            className="flex-1 py-1.5 px-3 text-red-600 text-xs rounded hover:bg-red-50 border border-red-200"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {filteredFilters.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p>No filters found</p>
            <p className="text-sm mt-2">Create a filter by using the filter UI on the dashboard and clicking 'Save filter'</p>
          </div>
        )}
      </div>
    </div>
  )
}
