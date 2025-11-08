import { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Todo } from '../../db/schema'
import type { Label } from '../../db/schema'
import TodoCard from '../TodoCard'
import CheckedDivider from '../CheckedDivider'

interface TaskListProps {
  items: Todo[]
  labels?: Label[]
  loading?: boolean
  emptyMessage?: string
  onToggle: (id: string, completed: boolean) => void
  onUpdate: (id: string, title: string) => void
  onDelete?: (id: string) => Promise<void>
  onLabelsChange?: () => Promise<void>
  onUncheckComplete?: () => void
  renderCard?: (todo: Todo) => ReactNode
}

export default function TaskList({ 
  items,
  labels = [],
  loading = false,
  emptyMessage = 'No tasks found',
  onToggle,
  onUpdate,
  onDelete,
  onLabelsChange,
  onUncheckComplete,
  renderCard
}: TaskListProps) {
  if (loading) {
    return (
      <div className="task-list-loading">
        <div className="text-center py-12 text-gray-500">
          <div className="text-sm">Loading tasks...</div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="task-list-empty">
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  // Separate completed and uncompleted
  const uncompleted = items.filter(t => !t.completed)
  const completed = items.filter(t => t.completed)

  return (
    <div className="task-list-container">
      {/* Uncompleted Tasks */}
      {uncompleted.length > 0 && (
        <div className="task-list-section">
          <AnimatePresence>
            {uncompleted.map((todo) => (
              <motion.div
                key={todo.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {renderCard ? renderCard(todo) : (
                  <TodoCard
                    todo={todo}
                    labels={labels}
                    onToggle={onToggle}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onLabelsChange={onLabelsChange}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Divider between unchecked and checked */}
      <CheckedDivider 
        checkedTodoIds={completed.map((t) => t.id)}
        onUncheckComplete={onUncheckComplete}
      />

      {/* Completed Tasks */}
      {completed.length > 0 && (
        <div className="task-list-section task-list-completed">
          <AnimatePresence>
            {completed.map((todo) => (
              <motion.div
                key={todo.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {renderCard ? renderCard(todo) : (
                  <TodoCard
                    todo={todo}
                    labels={labels}
                    onToggle={onToggle}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onLabelsChange={onLabelsChange}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
