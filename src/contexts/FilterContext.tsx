import React, { createContext, useContext } from 'react'
import { useFilters } from '../hooks/useFilters'
import type { Todo } from '../db/schema'

type Ctx = {
  selectedLabelIds: string[]
  toggleLabel: (id: string) => void
  clear: () => void
  setSelectedLabelIds: (ids: string[]) => void
  apply: (todos: Todo[]) => Todo[]
  blockedOnly: boolean
  setBlockedOnly: (v: boolean) => void
  selectedAssigneeIds: string[]
  setSelectedAssigneeIds: (ids: string[]) => void
  selectedWorkflowIds: string[]
  setSelectedWorkflowIds: (ids: string[]) => void
  dueStart: string | null
  setDueStart: (v: string | null) => void
  dueEnd: string | null
  setDueEnd: (v: string | null) => void
  selectedTypes: Array<'tasks' | 'notes'>
  setSelectedTypes: (v: Array<'tasks' | 'notes'>) => void
  showCompleted: boolean
  setShowCompleted: (v: boolean) => void
  showArchived: boolean
  setShowArchived: (v: boolean) => void
}

const FilterContext = createContext<Ctx | null>(null)

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const {
    selectedLabelIds,
    toggleLabel,
    clear,
    makeFilter,
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
  } = useFilters([])
  const apply = (todos: Todo[]) => makeFilter(todos)
  return (
    <FilterContext.Provider
      value={{
        selectedLabelIds,
        toggleLabel,
        clear,
        apply,
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
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export function useFilterContext() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilterContext must be used within a FilterProvider')
  return ctx
}
