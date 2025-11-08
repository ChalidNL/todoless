import { useEffect, useState } from 'react'
import type { Label, Todo } from '../db/schema'
import { parseDueToDate } from '../utils/date'

export function useFilters(initial: string[] = []) {
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('globalFilters')
      if (!raw) return initial
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed.selectedLabelIds) ? parsed.selectedLabelIds : initial
    } catch {
      return initial
    }
  })
  const [blockedOnly, setBlockedOnly] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('globalFilters')
      if (!raw) return false
      const parsed = JSON.parse(raw)
      return !!parsed.blockedOnly
    } catch {
      return false
    }
  })
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('globalFilters')
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed.selectedAssigneeIds) ? parsed.selectedAssigneeIds : []
    } catch {
      return []
    }
  })
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('globalFilters')
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed.selectedWorkflowIds) ? parsed.selectedWorkflowIds : []
    } catch {
      return []
    }
  })
  const [dueStart, setDueStart] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem('globalFilters')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed.dueStart || null
    } catch {
      return null
    }
  })
  const [dueEnd, setDueEnd] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem('globalFilters')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed.dueEnd || null
    } catch {
      return null
    }
  })
  const [selectedTypes, setSelectedTypes] = useState<Array<'tasks' | 'notes'>>(() => {
    try {
      const raw = localStorage.getItem('globalFilters')
      if (!raw) return ['tasks', 'notes']
      const parsed = JSON.parse(raw)
      const arr = parsed.selectedTypes
      return Array.isArray(arr) && arr.length ? arr : ['tasks', 'notes']
    } catch {
      return ['tasks', 'notes']
    }
  })
  const [showCompleted, setShowCompleted] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('globalFilters')
      if (!raw) return true
      const parsed = JSON.parse(raw)
      return parsed.showCompleted !== false // default show completed = true
    } catch { return true }
  })
  const [showArchived, setShowArchived] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('globalFilters')
      if (!raw) return false
      const parsed = JSON.parse(raw)
      return !!parsed.showArchived
    } catch { return false }
  })

  const toggleLabel = (id: string) => {
    setSelectedLabelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const clear = () => {
    setSelectedLabelIds([])
    setBlockedOnly(false)
    setSelectedAssigneeIds([])
    setSelectedWorkflowIds([])
    setDueStart(null)
    setDueEnd(null)
    setSelectedTypes(['tasks', 'notes'])
    setShowCompleted(true)
    setShowArchived(false)
  }

  const makeFilter = (todos: Todo[]) => {
    // Note: This is a pure function. Consumers should memoize results as needed.
    let next = todos
    if (selectedLabelIds.length > 0) {
      next = next.filter((t) => selectedLabelIds.every((id) => t.labelIds.includes(id)))
    }
    if (selectedWorkflowIds.length > 0) {
      next = next.filter((t) => t.workflowId && selectedWorkflowIds.includes(t.workflowId))
    }
    if (selectedAssigneeIds.length > 0) {
      next = next.filter((t) => {
        const ids = t.assigneeIds || []
        return ids.some((id) => selectedAssigneeIds.includes(id))
      })
    }
    if (blockedOnly) {
      next = next.filter((t) => t.blocked)
    }
    if (dueStart || dueEnd) {
      const startD = dueStart ? parseDueToDate(dueStart) : null
      const endD = dueEnd ? parseDueToDate(dueEnd) : null
      next = next.filter((t) => {
        const raw = (t as any).dueDate || (t as any).attributes?.dueDate
        const d = raw ? parseDueToDate(raw) : null
        if (!d) return false
        if (startD && d < startD) return false
        if (endD) {
          const endCopy = new Date(endD)
          endCopy.setHours(23, 59, 59, 999)
          if (d > endCopy) return false
        }
        return true
      })
    }
    return next
  }

  const selectionAsChips = (labels: Label[]) =>
    labels.filter((l) => selectedLabelIds.includes(l.id)).map((l) => ({ id: l.id, name: l.name, color: l.color }))

  useEffect(() => {
    try {
      localStorage.setItem(
        'globalFilters',
        JSON.stringify({ selectedLabelIds, blockedOnly, selectedAssigneeIds, selectedWorkflowIds, dueStart, dueEnd, selectedTypes, showCompleted, showArchived })
      )
    } catch {}
  }, [selectedLabelIds, blockedOnly, selectedAssigneeIds, selectedWorkflowIds, dueStart, dueEnd, selectedTypes, showCompleted, showArchived])

  useEffect(() => {
    const handleClear = () => clear()
    window.addEventListener('filters:clear', handleClear)
    return () => window.removeEventListener('filters:clear', handleClear)
  }, [])

  return {
    selectedLabelIds,
    toggleLabel,
    clear,
    makeFilter,
    selectionAsChips,
    setSelectedLabelIds,
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
  }
}
