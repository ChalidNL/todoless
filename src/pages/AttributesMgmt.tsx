import { useEffect, useState } from 'react'
import type { AttributeDef, Todo, Workflow } from '../db/schema'
import { Attributes, Todos, Workflows } from '../db/dexieClient'
import { useFilterContext } from '../contexts/FilterContext'
import ManagementHeader from '../components/ManagementHeader'
import CreateButton from '../components/ui/CreateButton'

export default function AttributesMgmt() {
  const [attributes, setAttributes] = useState<AttributeDef[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [createPopup, setCreatePopup] = useState(false)
  const [createType, setCreateType] = useState<'text' | 'number' | 'date' | 'select' | 'workflow'>('text')
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [workflowDefaultId, setWorkflowDefaultId] = useState<string>('')

  const { apply } = useFilterContext()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [attrsData, todosData, wfData] = await Promise.all([
      Attributes.list(),
      Todos.list(),
      Workflows.list(),
    ])
    setAttributes(attrsData)
    setTodos(todosData)
    setWorkflows(wfData)
    // choose default workflow for creator
    const def = wfData.find(w => w.id === 'default-kanban' || w.isDefault)
    setWorkflowDefaultId(def?.id || wfData[0]?.id || '')
  }

  const getUsedInCount = (attrId: string) => {
    const filteredTodos = apply(todos)
    return filteredTodos.filter(t => t.attributes && attrId in t.attributes).length
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    await Attributes.add({ name, type: 'text', defaultValue: '' })
    setNewName('')
    await loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this attribute?')) return
    await Attributes.remove(id)
    await loadData()
  }

  const handleQuickRename = async (attr: AttributeDef) => {
    const next = prompt('Rename attribute', attr.name)
    if (next && next.trim() && next.trim() !== attr.name) {
      await Attributes.update(attr.id, { name: next.trim() })
      await loadData()
    }
  }

  const filtered = attributes
    .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <ManagementHeader
        title="Attributes"
        infoText="Add custom fields to tasks (text, number, date, or select)."
        onCreateClick={() => setCreatePopup(true)}
        createTitle="Create attribute"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search attributes..."
        compact
      />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(attr => (
            <div key={attr.id} className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-2 mb-2">
                <div className="w-8 h-8 rounded border-2 border-gray-300 flex items-center justify-center flex-shrink-0">
                  {attr.icon ? (
                    <span className="text-lg">{attr.icon}</span>
                  ) : (
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate flex items-center gap-1" title={attr.name}>
                    {attr.name}
                    {attr.isDefault && <span title="Default" className="text-yellow-500">⭐</span>}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-600 mb-2">
                Type: {attr.type} • {getUsedInCount(attr.id)}
                {attr.defaultValue && (
                  <div className="mt-1">
                    Default: {attr.type === 'workflow'
                      ? (workflows.find(w => w.id === attr.defaultValue)?.name || String(attr.defaultValue))
                      : String(attr.defaultValue)
                    }
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {attr.isDefault ? (
                  <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border-2 border-gray-200 bg-gray-50 text-gray-400 text-xs">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/>
                    </svg>
                    System Default
                  </div>
                ) : (
                  <>
                <button
                  onClick={() => handleQuickRename(attr)}
                  className="flex-1 w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-gray-100"
                  title="Rename"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(attr.id)}
                  className="w-8 h-8 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-red-50 text-red-600"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            {searchQuery ? 'No attributes found' : 'No attributes yet. Create one above!'}
          </div>
        )}
      </div>

      {/* Create Popup */}
      {createPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setCreatePopup(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Create Attribute</h2>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const name = formData.get('name') as string
              const type = formData.get('type') as 'text' | 'number' | 'date' | 'select' | 'workflow'
              if (!name.trim()) return
              if (type === 'workflow') {
                const defId = (formData.get('workflowDefaultId') as string) || workflowDefaultId
                await Attributes.add({ name, type, defaultValue: defId })
              } else {
                await Attributes.add({ name, type, defaultValue: '' })
              }
              await loadData()
              setCreatePopup(false)
            }}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Attribute name"
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['text', 'number', 'date', 'select', 'workflow'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer p-2 border border-gray-300 rounded-md hover:bg-gray-50">
                      <input
                        type="radio"
                        name="type"
                        value={type}
                        checked={createType === type}
                        onChange={() => setCreateType(type)}
                        className="text-blue-500"
                      />
                      <span className="capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {createType === 'workflow' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default workflow</label>
                  <select
                    name="workflowDefaultId"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={workflowDefaultId}
                    onChange={(e) => setWorkflowDefaultId(e.target.value)}
                  >
                    {workflows.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name}{w.isDefault ? ' ⭐' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreatePopup(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
