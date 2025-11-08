import { DndContext, DragEndEvent, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Todo, Label, Workflow } from '../db/schema'
import { Todos } from '../db/dexieClient'
import { useSort, sortTodosBy } from '../contexts/SortContext'

interface Props {
  workflow: Workflow
  todos: Todo[]
  labels: Label[]
  onReload: () => Promise<void>
}

function SortableTodoCard({ todo, labels, onMoveLeft, onMoveRight, canMoveLeft, canMoveRight }: {
  todo: Todo;
  labels: Label[];
  onMoveLeft?: (todo: Todo) => void;
  onMoveRight?: (todo: Todo) => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: todo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative bg-white rounded-lg border border-gray-200 p-2 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
      {(canMoveLeft || canMoveRight) && (
        <div className="absolute right-1 top-1 flex items-center gap-1">
          {canMoveLeft && (
            <button
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-50"
              title="Move left"
              onClick={(e) => { e.stopPropagation(); onMoveLeft && onMoveLeft(todo) }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
          )}
          {canMoveRight && (
            <button
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-50"
              title="Move right"
              onClick={(e) => { e.stopPropagation(); onMoveRight && onMoveRight(todo) }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
          )}
        </div>
      )}
      <div className="mb-1 text-xs font-medium">{todo.title}</div>
      <div className="flex flex-wrap gap-1">
        {todo.labelIds.map((id) => {
          const l = labels.find((x) => x.id === id)
          if (!l) return null
          return (
            <span key={id} className="chip border-gray-200 text-[10px] px-1 py-0.5" style={{ borderColor: l.color }}>
              <span className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default function WorkflowKanban({ workflow, todos, labels, onReload }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const { value: sortValue } = useSort()

  // Filter out backlog if hideBacklog is true
  const visibleStages = workflow.hideBacklog 
    ? workflow.stages.filter(s => s.toLowerCase() !== 'backlog')
    : workflow.stages

  const grouped = visibleStages.map((stage) => ({
    stage,
    todos: todos.filter((t) => t.workflowStage === stage),
    isFinal: stage === workflow.stages[workflow.stages.length - 1],
  }))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const todoId = active.id as string
    const targetStage = over.id as string
    // Check if it's the final stage (last in original stages array)
    const finalStage = workflow.stages[workflow.stages.length - 1]
    const isMovingToFinal = targetStage === finalStage

    await Todos.update(todoId, { workflowStage: targetStage, completed: isMovingToFinal })
    await onReload()
  }

  const stageIndex = (stage: string) => visibleStages.findIndex(s => s === stage)
  const moveTodoToStage = async (todo: Todo, targetStage: string) => {
    const finalStage = workflow.stages[workflow.stages.length - 1]
    await Todos.update(todo.id, { workflowStage: targetStage, completed: targetStage === finalStage, workflowId: workflow.id })
    await onReload()
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-h-[60vh]">
        {grouped.map(({ stage, todos: stageTodos, isFinal }) => (
          <div key={stage} className="flex flex-col min-w-0">
            <div className={`mb-1.5 flex items-center justify-between rounded-lg px-2 py-1.5 ${isFinal ? 'bg-green-100' : 'bg-gray-100'}`}>
              <span className={`text-xs font-semibold truncate ${isFinal ? 'text-green-700' : ''}`}>{stage}</span>
              <span className={`text-xs ml-2 ${isFinal ? 'text-green-600' : 'text-gray-500'}`}>{stageTodos.length}</span>
            </div>
            <SortableContext id={stage} items={stageTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5 flex-1 min-h-20">
                {sortTodosBy(sortValue, stageTodos, labels).map((t) => {
                  const idx = stageIndex(t.workflowStage || stage)
                  return (
                    <SortableTodoCard
                      key={t.id}
                      todo={t}
                      labels={labels}
                      canMoveLeft={idx > 0}
                      canMoveRight={idx >= 0 && idx < visibleStages.length - 1}
                      onMoveLeft={(todo) => moveTodoToStage(todo, visibleStages[Math.max(0, idx - 1)])}
                      onMoveRight={(todo) => moveTodoToStage(todo, visibleStages[Math.min(visibleStages.length - 1, idx + 1)])}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </div>
        ))}
      </div>
    </DndContext>
  )
}
