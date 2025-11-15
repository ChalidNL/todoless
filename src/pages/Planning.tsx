import { useEffect, useMemo } from 'react'
import { DndContext, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Todo } from '../db/schema'
import { mutateTodo, Todos } from '../db/dexieClient'
import useFilteredTodos from '../hooks/useFilteredTodos'
import { useFilterContext } from '../contexts/FilterContext'
import TodoCard from '../components/TodoCard'
import { parseDueToDate } from '../utils/date'
import useLabels from '../hooks/useLabels'

function isoDate(d: Date) {
  return d.toISOString().substring(0, 10)
}

export default function Planning() {
  const { todos } = useFilteredTodos()
  const { labels, reloadLabels } = useLabels()
  const {
    selectedLabelIds,
    selectedAssigneeIds,
    selectedWorkflowIds,
    blockedOnly,
    dueStart,
    dueEnd,
  } = useFilterContext()

  const today = useMemo(() => new Date(), [])
  today.setHours(0, 0, 0, 0)
  const tomorrow = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return d
  }, [today])
  const nextWeek = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 7)
    return d
  }, [today])

  const filtered = todos.filter((t: Todo) => !t.completed)

  const byBucket = useMemo(() => {
    const groups: Record<string, Todo[]> = { backlog: [], today: [], tomorrow: [], nextWeek: [] }
    filtered.forEach((t: Todo) => {
      const raw = t.dueDate || t.attributes?.dueDate
      if (!raw) return groups.backlog.push(t)
      const d = parseDueToDate(raw)
      if (!d) return groups.backlog.push(t)
      const ds = new Date(d); ds.setHours(0, 0, 0, 0)
      if (ds.getTime() === today.getTime()) groups.today.push(t)
      else if (ds.getTime() === tomorrow.getTime()) groups.tomorrow.push(t)
      else if (ds.getTime() > tomorrow.getTime() && ds.getTime() <= nextWeek.getTime()) groups.nextWeek.push(t)
      else groups.backlog.push(t)
    })
    return groups
  }, [filtered, today, tomorrow, nextWeek])

  const setDue = async (todo: Todo, bucket: 'backlog' | 'today' | 'tomorrow' | 'nextWeek') => {
    let newDate: string | undefined
    if (bucket === 'today') newDate = isoDate(today)
    else if (bucket === 'tomorrow') newDate = isoDate(tomorrow)
    else if (bucket === 'nextWeek') newDate = isoDate(nextWeek)
    else newDate = undefined
    await mutateTodo(todo.id, { dueDate: newDate, attributes: { ...(todo.attributes || {}), dueDate: newDate } })
  }

  const onDrop = async (e: DragEndEvent) => {
    const id = e.active.id as string
    const overId = (e.over?.id as string) || ''
    const t = filtered.find((x: Todo) => x.id === id)
    if (!t) return
    if (overId === 'bucket-today') return setDue(t, 'today')
    if (overId === 'bucket-tomorrow') return setDue(t, 'tomorrow')
    if (overId === 'bucket-nextWeek') return setDue(t, 'nextWeek')
    if (overId === 'bucket-backlog') return setDue(t, 'backlog')
  }

  const Bucket = ({ id, title, items }: { id: string; title: string; items: Todo[] }) => (
    <div className="flex-1 min-w-[260px]">
      <div id={id} className="card bg-gray-50">
        <div className="mb-2 text-xs font-semibold text-gray-600">{title}</div>
        <div className="space-y-2">
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((t) => (
              <div key={t.id} id={t.id}>
                <TodoCard
                  todo={t}
                  labels={labels}
                  onToggle={async (id, completed) => {
                    await mutateTodo(id, { completed })
                  }}
                  onUpdate={async (id, title) => {
                    await mutateTodo(id, { title })
                  }}
                  onDelete={async (id) => {
                    await Todos.remove(id)
                  }}
                  onLabelsChange={reloadLabels}
                />
              </div>
            ))}
          </SortableContext>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Planning</h2>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>Drag tasks into buckets to set due dates.</span>
          {(blockedOnly || selectedLabelIds.length || selectedAssigneeIds.length || selectedWorkflowIds.length || dueStart || dueEnd) && (
            <span className="chip border-accent bg-accent/10 text-accent">Filters active</span>
          )}
        </div>
      </div>
      <DndContext onDragEnd={onDrop}>
        <div className="flex flex-wrap gap-3">
          <Bucket id="bucket-backlog" title="Backlog" items={byBucket.backlog} />
          <Bucket id="bucket-today" title="Today" items={byBucket.today} />
          <Bucket id="bucket-tomorrow" title="Tomorrow" items={byBucket.tomorrow} />
          <Bucket id="bucket-nextWeek" title="Next 7 Days" items={byBucket.nextWeek} />
        </div>
      </DndContext>
    </div>
  )
}
