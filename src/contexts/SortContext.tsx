import React, { createContext, useContext, useMemo, useState } from 'react'
import type { Todo, Label } from '../db/schema'
import { parseDueToDate } from '../utils/date'

export type SortValue =
  | 'alpha'
  | 'alpha-desc'
  | 'created'
  | 'created-desc'
  | 'label'
  | 'label-desc'

interface SortContextValue {
  value: SortValue
  setValue: (v: SortValue) => void
}

const SortContext = createContext<SortContextValue | null>(null)

export function SortProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<SortValue>(() => (localStorage.getItem('sort:value') as SortValue) || 'created')
  const api = useMemo<SortContextValue>(() => ({
    value,
    setValue: (v: SortValue) => {
      localStorage.setItem('sort:value', v)
      setValue(v)
    },
  }), [value])
  return <SortContext.Provider value={api}>{children}</SortContext.Provider>
}

export function useSort() {
  const ctx = useContext(SortContext)
  if (!ctx) throw new Error('useSort must be used within SortProvider')
  return ctx
}

export function sortTodosBy(value: SortValue, items: Todo[], labels?: Label[]) {
  const copy = items.slice()
  switch (value) {
    case 'alpha':
      return copy.sort((a, b) => a.title.localeCompare(b.title))
    case 'alpha-desc':
      return copy.sort((a, b) => b.title.localeCompare(a.title))
    case 'created':
      return copy.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    case 'created-desc':
      return copy.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    case 'label': {
      const names = (t: Todo) => (t.labelIds || []).map((id) => labels?.find((l) => l.id === id)?.name || '').join(', ')
      return copy.sort((a, b) => names(a).localeCompare(names(b)))
    }
    case 'label-desc': {
      const names = (t: Todo) => (t.labelIds || []).map((id) => labels?.find((l) => l.id === id)?.name || '').join(', ')
      return copy.sort((a, b) => names(b).localeCompare(names(a)))
    }
    default:
      // Default: sort by creation date (newest first)
      return copy.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }
}
