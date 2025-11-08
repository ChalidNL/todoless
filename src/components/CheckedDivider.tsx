import { Todos } from '../db/dexieClient'

interface Props {
  checkedTodoIds: string[]
  onUncheckComplete?: () => void
}

export default function CheckedDivider({ checkedTodoIds, onUncheckComplete }: Props) {
  if (checkedTodoIds.length === 0) return null

  const handleUncheckAll = async () => {
    if (!confirm(`Uncheck all ${checkedTodoIds.length} completed items?`)) return
    
    try {
      await Promise.all(
        checkedTodoIds.map((id) => Todos.update(id, { completed: false }))
      )
      if (onUncheckComplete) onUncheckComplete()
    } catch (error) {
      console.error('Failed to uncheck todos:', error)
      alert('Failed to uncheck items. Please try again.')
    }
  }

  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-gray-300"></div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          Checked ({checkedTodoIds.length})
        </span>
        <button
          onClick={handleUncheckAll}
          className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors"
          title="Mark all as incomplete"
        >
          Uncheck All
        </button>
      </div>
      <div className="flex-1 h-px bg-gray-300"></div>
    </div>
  )
}
