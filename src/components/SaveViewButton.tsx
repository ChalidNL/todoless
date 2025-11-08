import { useMemo, useState } from 'react'
import { useFilterContext } from '../contexts/FilterContext'
import { useSort } from '../contexts/SortContext'
import { SavedViews } from '../db/dexieClient'

interface Props {
  onRefresh?: () => void
}

export default function SaveViewButton({ onRefresh }: Props) {
  const {
    selectedLabelIds,
    blockedOnly,
    selectedAssigneeIds,
    selectedWorkflowIds,
    dueStart,
    dueEnd,
  } = useFilterContext()
  const { value: sortValue } = useSort()
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
    const name = window.prompt('Save current view as…', 'My view')?.trim()
    if (!name) return

    // Check if 'All' is being used
    if (name.toLowerCase() === 'all') {
      setError('"All" is a reserved system view name')
      setTimeout(() => setError(null), 3000)
      return
    }

    setSaving(true)
    try {
      const existing = await SavedViews.list()
  const duplicate = existing.find((v) => v.name.toLowerCase() === name.toLowerCase())

      if (duplicate) {
        if (duplicate.isSystem) {
          setError('Cannot overwrite a system view')
          setTimeout(() => setError(null), 3000)
          setSaving(false)
          return
        }
        const overwrite = window.confirm(`View "${name}" already exists. Overwrite?`)
        if (!overwrite) {
          setSaving(false)
          return
        }
        // Update existing view
        await SavedViews.update(duplicate.id, {
          labelFilterIds: selectedLabelIds,
          attributeFilters: {
            sort: sortValue,
            blockedOnly: blockedOnly ? '1' : '0',
            assignees: selectedAssigneeIds.join(','),
            workflows: selectedWorkflowIds.join(','),
            dueStart: dueStart || '',
            dueEnd: dueEnd || '',
          },
        })
      } else {
        // Create new view with default filter icon
        await SavedViews.add({
          name,
          icon: '🔍',
          labelFilterIds: selectedLabelIds,
          sortBy: sortValue,
          attributeFilters: {
            sort: sortValue,
            blockedOnly: blockedOnly ? '1' : '0',
            assignees: selectedAssigneeIds.join(','),
            workflows: selectedWorkflowIds.join(','),
            dueStart: dueStart || '',
            dueEnd: dueEnd || '',
          },
        })
      }
      window.dispatchEvent(new Event('saved-views:refresh'))
      // Clear all filters after save
      window.dispatchEvent(new CustomEvent('filters:clear'))
      if (onRefresh) onRefresh()
    } catch (e) {
      setError('Failed to save view')
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
        title="Save current view"
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
