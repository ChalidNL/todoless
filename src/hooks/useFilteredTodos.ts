import { useEffect, useMemo, useState } from 'react'
import { Labels, Todos, todoBus } from '../db/dexieClient'
import type { Label, Todo } from '../db/schema'
import { useFilterContext } from '../contexts/FilterContext'
import { useSort, sortTodosBy } from '../contexts/SortContext'

export default function useFilteredTodos() {
  const [rawTodos, setRawTodos] = useState<Todo[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const { apply, selectedLabelIds, selectedAssigneeIds, blockedOnly, dueStart, dueEnd, showCompleted } = useFilterContext()
  const { value: sortValue } = useSort()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const [all, allLabels] = await Promise.all([Todos.list(), Labels.list()])
      if (!mounted) return
      setRawTodos(all)
      setLabels(allLabels)
    })()

    const onAdded = (e: Event) => {
      const detail = (e as CustomEvent).detail as Todo
      console.log('useFilteredTodos: todo:added event received', detail)
      if (!detail || !detail.id) return
      setRawTodos((s) => [detail, ...s])
    }
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as Todo
      if (!detail || !detail.id) return
      setRawTodos((s) => s.map((t) => (t.id === detail.id ? detail : t)))
    }
    const onRemoved = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string }
      setRawTodos((s) => s.filter((t) => t.id !== detail.id))
    }

    todoBus.addEventListener('todo:added', onAdded)
    todoBus.addEventListener('todo:updated', onUpdated)
    todoBus.addEventListener('todo:mutated', onUpdated)
    todoBus.addEventListener('todo:removed', onRemoved)

    return () => {
      mounted = false
      todoBus.removeEventListener('todo:added', onAdded)
      todoBus.removeEventListener('todo:updated', onUpdated)
      todoBus.removeEventListener('todo:mutated', onUpdated)
      todoBus.removeEventListener('todo:removed', onRemoved)
    }
  }, [])

  // Recompute filtered todos when rawTodos or any filter changes
  const filtered = useMemo(() => {
  const f = apply(rawTodos)
  // Remove duplicate tasks by id
  const unique = Array.from(new Set(f.map(t => t.id))).map(id => f.find(t => t.id === id)).filter((t): t is Todo => t !== undefined)
  const sorted = sortTodosBy(sortValue, unique, labels)
  const unchecked = sorted.filter((t) => !t.completed)
  const checked = sorted.filter((t) => t.completed)
  if (!showCompleted) return unchecked
  return [...unchecked, ...checked]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTodos, selectedLabelIds?.join(','), selectedAssigneeIds?.join(','), blockedOnly, dueStart, dueEnd, sortValue, labels, showCompleted])

  const reload = async () => {
    const all = await Todos.list()
    setRawTodos(all)
  }

  return { todos: filtered, rawTodos, reload }
}
