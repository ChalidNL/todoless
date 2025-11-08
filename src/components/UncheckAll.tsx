import { useState } from 'react'
import { Todos, Workflows } from '../db/dexieClient'

interface Props {
  todoIds: string[]
  onUncheckComplete?: () => void
}

export default function UncheckAll({ todoIds, onUncheckComplete }: Props) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [processing, setProcessing] = useState(false)

  if (todoIds.length === 0) return null

  const handleUncheckAll = async () => {
    setProcessing(true)
    try {
      // Get all todos and workflows
      const [allTodos, workflows] = await Promise.all([Todos.list(), Workflows.list()])
      
      // Update all checked todos
      await Promise.all(
        todoIds.map(async (id) => {
          const todo = allTodos.find((t) => t.id === id)
          if (!todo) return
          
          // Reset to first workflow stage if workflow is set
          let workflowStage = todo.workflowStage
          if (todo.workflowId) {
            const workflow = workflows.find((w) => w.id === todo.workflowId)
            if (workflow && workflow.stages.length > 0) {
              workflowStage = workflow.stages[0]
            }
          }
          
          await Todos.update(id, { 
            completed: false,
            workflowStage 
          })
        })
      )
      
      setShowConfirm(false)
      if (onUncheckComplete) onUncheckComplete()
    } catch (error) {
      console.error('Failed to uncheck todos:', error)
      alert('Failed to uncheck items. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full mt-4 py-3 px-4 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium text-gray-700"
      >
        <svg className="icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Uncheck All ({todoIds.length})
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Confirm Uncheck All</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to uncheck all {todoIds.length} item{todoIds.length !== 1 ? 's' : ''}?
              {' '}This will reset them to the first workflow stage if applicable.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={processing}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUncheckAll}
                disabled={processing}
                className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Yes, Uncheck All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
