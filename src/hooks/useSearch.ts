import { useMemo, useState, useEffect } from 'react'
import type { Todo, Label } from '../db/schema'

export function useSearch(todos: Todo[], labels: Label[]) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Initialize from global header search and react to global-search events
  useEffect(() => {
    const stored = localStorage.getItem('globalQuery') || ''
    if (stored) setQuery(stored)
    const handler = (e: Event) => {
      try {
        // @ts-ignore
        if (e && (e as any).detail != null) setQuery(String((e as any).detail))
        else setQuery(localStorage.getItem('globalQuery') || '')
      } catch {
        setQuery(localStorage.getItem('globalQuery') || '')
      }
    }
    window.addEventListener('global-search', handler as any)
    return () => window.removeEventListener('global-search', handler as any)
  }, [])

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return todos
    const q = debouncedQuery.toLowerCase()
    return todos.filter((t) => {
      // Search in title
      if (t.title.toLowerCase().includes(q)) return true
      // Search in label names
      const todoLabels = labels.filter((l) => t.labelIds.includes(l.id))
      if (todoLabels.some((l) => l.name.toLowerCase().includes(q))) return true
      // Search in attributes (if any)
      if (t.attributes) {
        const attrStr = JSON.stringify(t.attributes).toLowerCase()
        if (attrStr.includes(q)) return true
      }
      return false
    })
  }, [todos, labels, debouncedQuery])

  return { query, setQuery, filtered }
}
