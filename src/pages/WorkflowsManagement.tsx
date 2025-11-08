import { useEffect, useState } from 'react'
import type { Workflow, Todo } from '../db/schema'
import { Workflows, Todos } from '../db/dexieClient'
import WorkflowEditor from '../components/WorkflowEditor'
import { useFilterContext } from '../contexts/FilterContext'
import ManagementHeader from '../components/ManagementHeader'

export default function WorkflowsManagement() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [q, setQ] = useState<string>(() => {
    try { return localStorage.getItem('globalQuery') || '' } catch { return '' }
  })
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const { apply } = useFilterContext()

  useEffect(() => {
    loadData()
  }, [])

  // Sync with global search
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setQ(typeof detail === 'string' ? detail : '')
    }
    window.addEventListener('global-search', handler)
    return () => window.removeEventListener('global-search', handler)
  }, [])

  const clearGlobalSearch = () => {
    try { localStorage.setItem('globalQuery', '') } catch {}
    window.dispatchEvent(new CustomEvent('global-search', { detail: '' }))
  }

  const loadData = async () => {
    const [workflowsData, todosData] = await Promise.all([
      Workflows.list(),
      Todos.list()
    ])
    setWorkflows(workflowsData)
    setTodos(todosData)
  }

  const getUsedInCount = (workflowId: string) => {
    const filteredTodos = apply(todos)
    return filteredTodos.filter(t => t.workflowId === workflowId).length
  }

  const handleDelete = async (id: string, workflow: Workflow) => {
    if (workflow.isDefault) {
      alert('Cannot delete default workflows')
      return
    }
    if (!confirm('Delete this workflow?')) return
    await Workflows.remove(id)
    await loadData()
  }

  const handleSave = async (data: Omit<Workflow, 'id'>, id?: string) => {
    if (id) {
      await Workflows.update(id, data)
    } else {
      await Workflows.add(data)
    }
    setShowEditor(false)
    setEditingWorkflow(null)
    await loadData()
  }

  const filteredWorkflows = workflows.filter(w => 
    w.name.toLowerCase().includes(q.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <div className="h-full flex flex-col bg-gray-50">
        <ManagementHeader
          title="Workflows"
          infoText="Workflows definiëren de fases van je werk. Koppel labels of gebruik stages (3+) om Kanban te activeren."
          onCreateClick={() => { setEditingWorkflow(null); setShowEditor(true) }}
          createTitle="Create workflow"
          searchValue={q}
          onSearchChange={(val) => {
            setQ(val)
            try { localStorage.setItem('globalQuery', val) } catch {}
            window.dispatchEvent(new CustomEvent('global-search', { detail: val }))
          }}
          searchPlaceholder="Search workflows..."
          compact
        />

        {/* Workflows grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredWorkflows.map(workflow => (
              <div 
                key={workflow.id} 
                className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow"
              >
                {/* Icon and name */}
                <div className="flex items-start gap-2 mb-2">
                  <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                    getUsedInCount(workflow.id) > 0 ? 'bg-red-500' : 'bg-gray-200'
                  }`}>
                    {workflow.isDefault ? (
                      <span className="text-lg">⭐</span>
                    ) : (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate" title={workflow.name}>
                      {workflow.name}
                    </div>
                  </div>
                </div>

                {/* Stages */}
                <div className="mb-2">
                  <div className="text-xs text-gray-600 mb-1">
                    {workflow.stages?.length || 0} stages • {getUsedInCount(workflow.id)}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {workflow.stages?.slice(0, 3).map((stage, idx) => (
                      <span key={idx} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                        {stage}
                      </span>
                    ))}
                    {(workflow.stages?.length || 0) > 3 && (
                      <span className="text-xs text-gray-500">+{(workflow.stages?.length || 0) - 3}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingWorkflow(workflow)
                      setShowEditor(true)
                    }}
                    className="flex-1 w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-gray-100"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(workflow.id, workflow)}
                    className={`w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 ${workflow.isDefault ? 'opacity-30 cursor-not-allowed' : 'hover:bg-red-50 text-red-600'}`}
                    title={workflow.isDefault ? 'Cannot delete default workflow' : 'Delete'}
                    disabled={workflow.isDefault}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredWorkflows.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              {q ? 'No workflows found' : 'No workflows yet. Create one above!'}
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <WorkflowEditor
              initial={editingWorkflow}
              onSave={(data, id) => handleSave(data, id)}
              onCancel={() => {
                setShowEditor(false)
                setEditingWorkflow(null)
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
