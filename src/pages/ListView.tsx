import { useEffect, useMemo, useState, useRef } from 'react'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate, useParams } from 'react-router-dom'
import TodoCard from '../components/TodoCard'
import CheckedDivider from '../components/CheckedDivider'
import { Todos, Lists } from '../db/dexieClient'
import type { List, Todo } from '../db/schema'
import useFilteredTodos from '../hooks/useFilteredTodos'
import { useViewMode } from '../contexts/ViewModeContext'
import { useFilterContext } from '../contexts/FilterContext'
import useLabels from '../hooks/useLabels'

export default function ListView() {
  const { listId } = useParams()
  const navigate = useNavigate()
  const { todos } = useFilteredTodos()
  const { labels, reloadLabels } = useLabels()
  const { mode } = useViewMode()
  const { setSelectedLabelIds, clear } = useFilterContext()
  const [list, setList] = useState<List | null>(null)
  const [modifyMode] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function SortableRow({ todo }: { todo: Todo }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: todo.id })
    const style = { transform: CSS.Transform.toString(transform), transition }
    return (
      <div ref={setNodeRef} style={style} {...(modifyMode ? { ...attributes, ...listeners } : {})}>
        <TodoCard
          key={todo.id}
          todo={todo}
          labels={labels}
          onToggle={async (id, completed) => {
            const patch: Partial<Todo> = { completed }
            // If this todo has a workflow, push to first/last stage on toggle
            // We'll fetch workflow via labels -> omitted here for brevity in ListView
            await Todos.update(id, patch)
            await reload()
          }}
          onUpdate={async (id, title) => {
            await Todos.update(id, { title })
            await reload()
          }}
          onDelete={async (id) => {
            await Todos.remove(id)
            await reload()
          }}
          onLabelsChange={reloadLabels}
        />
      </div>
    )
  }

  const reload = async () => {
    const lx = await Lists.list()
    const found = lx.find((l) => l.id === listId)
    setList(found ?? null)
  }

  useEffect(() => {
    reload()
  }, [listId])

  const items = useMemo(() => todos.filter((t) => t.listId === listId).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [todos, listId])

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!modifyMode) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = items.findIndex((t) => t.id === active.id)
    const toIndex = items.findIndex((t) => t.id === over.id)
    if (fromIndex === -1 || toIndex === -1) return
    const reordered = items.slice()
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    // Assign sequential order values (step 1000) to minimize churn
    const updates = reordered.map((t, idx) => ({ id: t.id, order: (idx + 1) * 1000 }))
    await Promise.all(updates.map((u) => Todos.update(u.id, { order: u.order })))
    await reload()
  }

  return (
    <div>
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{list?.name ?? 'List'}</h2>
        </div>
        {list?.description && <p className="text-sm text-gray-600">{list.description}</p>}
        {list?.labelIds && list.labelIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {list.labelIds.map((id) => {
              const l = labels.find((x) => x.id === id)
              if (!l) return null
              return (
                <button
                  key={id}
                  className="chip border-gray-200 text-[11px] px-1.5 py-0.5 hover:bg-gray-50"
                  style={{ borderColor: l.color }}
                  onClick={() => { try { clear() } catch {}; setSelectedLabelIds([id]); navigate('/saved/all') }}
                  title={`Open label: ${l.name}`}
                >
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Local add/modify controls removed; use global header add/search */}

      <div className="mt-3" />

      {items.length === 0 ? (
        <div className="mt-6 text-center text-sm text-gray-500">This list is empty. Add your first todo!</div>
      ) : (
        // Group active first, then completed at bottom
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="mt-3 space-y-3">
            <SortableContext items={items.filter((t)=>!t.completed).map((t)=>t.id)} strategy={verticalListSortingStrategy}>
              {items.filter((t) => !t.completed).map((t) => (
                <SortableRow key={t.id} todo={t} />
              ))}
            </SortableContext>

            <CheckedDivider 
              checkedTodoIds={items.filter((t) => t.completed).map((t) => t.id)}
              onUncheckComplete={reload}
            />

            {items.some((t) => t.completed) && (
              <SortableContext items={items.filter((t)=>t.completed).map((t)=>t.id)} strategy={verticalListSortingStrategy}>
                {items.filter((t) => t.completed).map((t) => (
                  <SortableRow key={t.id} todo={t} />
                ))}
              </SortableContext>
            )}
          </div>
        </DndContext>
      )}
    </div>
  )
}
