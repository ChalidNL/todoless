import { useMemo, useState } from 'react'
import { useFilterContext } from '../contexts/FilterContext'
import { useSort } from '../contexts/SortContext'
import { SavedFilters, Labels } from '../db/dexieClient'
import { pushFilterToServer, updateFilterOnServer } from '../utils/syncFilters'
import { useAuth } from '../store/auth'

interface Props {
  onRefresh?: () => void
}

export default function SaveFilterButton({ onRefresh }: Props) {
  const {
    selectedLabelIds,
    blockedOnly,
    selectedAssigneeIds,
    selectedWorkflowIds,
    dueStart,
    dueEnd,
  } = useFilterContext()
  const { value: sortValue } = useSort()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = useMemo(() => {
    if (sortValue !== 'created') return true
    if (blockedOnly) return true
    if (selectedLabelIds.length) return true
    if (selectedAssigneeIds.length) return true
    if (selectedWorkflowIds.length) return true
    if (dueStart || dueEnd) return true
    return false
  }, [sortValue, blockedOnly, selectedLabelIds, selectedAssigneeIds, selectedWorkflowIds, dueStart, dueEnd])

  if (!isDirty) return null

  const onSave = async () => {
    setError(null)

    // v0.0.57: Generate filter name suggestion from selected labels
    let suggestedName = 'My filter'
    if (selectedLabelIds.length > 0) {
      try {
        const labels = await Labels.list()
        const selectedLabels = labels.filter(l => selectedLabelIds.includes(l.id))
        if (selectedLabels.length > 0) {
          suggestedName = selectedLabels.map(l => l.name).join(' + ')
        }
      } catch {}
    }

    const name = window.prompt('Save current filter as…', suggestedName)?.trim()
    if (!name) return

    // Check if 'All' is being used
    if (name.toLowerCase() === 'all') {
      setError('"All" is a reserved system filter name')
      setTimeout(() => setError(null), 3000)
      return
    }

    setSaving(true)
    try {
      // v0.0.57: Build queryJson object with current filter state
      const queryJson = {
        selectedLabelIds,
        selectedAssigneeIds,
        selectedWorkflowIds,
        blockedOnly,
        dueStart,
        dueEnd,
        sortBy: sortValue,
      }

      const existing = await SavedFilters.list()
      const duplicate = existing.find((f) => f.normalizedName === name.toLowerCase())

      // v0.0.57: Get current user ID from auth context
      const ownerId = user?.id || 1

      if (duplicate) {
        const overwrite = window.confirm(`Filter "${name}" already exists. Overwrite?`)
        if (!overwrite) {
          setSaving(false)
          return
        }
        // v0.0.57: Update existing filter on server (server-first)
        await updateFilterOnServer(duplicate.id, {
          name,
          queryJson,
        })
      } else {
        // v0.0.57: Create new filter - server-first, no local ID generation
        const newFilter = {
          id: 0, // Will be assigned by server
          name,
          normalizedName: name.toLowerCase(),
          queryJson,
          menuVisible: true,
          shared: true,
          ownerId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        }

        // Push to server (this will update local with server-assigned ID)
        await pushFilterToServer(newFilter)
      }

      window.dispatchEvent(new Event('saved-filters:refresh'))
      // Clear all filters after save
      window.dispatchEvent(new CustomEvent('filters:clear'))
      if (onRefresh) onRefresh()
    } catch (e) {
      setError('Failed to save filter')
      setTimeout(() => setError(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 text-lg"
        disabled={saving}
        onClick={onSave}
        title="Save current filter"
      >
        💾
      </button>
      {error && (
        <div className="absolute top-10 right-0 z-20 w-48 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700 shadow-lg">
          {error}
        </div>
      )}
    </div>
  )
}
