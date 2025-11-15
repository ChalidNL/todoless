import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagementLayout from '../components/ManagementLayout'
import DataTable, { Column } from '../components/DataTable'
import type { List, Todo, Label } from '../db/schema'
import { Lists, Todos, Labels } from '../db/dexieClient'
import { useFilterContext } from '../contexts/FilterContext'
import Icon from '../components/Icon'

export default function ListsManagement() {
  const navigate = useNavigate()
  const [lists, setLists] = useState<List[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [editingList, setEditingList] = useState<List | null>(null)
  const [newListName, setNewListName] = useState('')

  const { apply } = useFilterContext()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [listsData, todosData, labelsData] = await Promise.all([
      Lists.list(),
      Todos.list(),
      Labels.list()
    ])
    setLists(listsData)
    setTodos(todosData)
    setLabels(labelsData)
  }

  const getItemCount = (listId: string) => {
    const filteredTodos = apply(todos)
    return filteredTodos.filter(t => t.listId === listId).length
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this list?')) return
    await Lists.remove(id)
    await loadData()
  }

  const handleCreate = async () => {
    if (!newListName.trim()) return
    await Lists.add({
      name: newListName,
      labelIds: []
    })
    setNewListName('')
    await loadData()
  }

  const handleUpdate = async (list: List, updates: Partial<List>) => {
    await Lists.update(list.id, updates)
    await loadData()
  }

  // Filter and sort
  let filteredLists = lists.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  filteredLists.sort((a, b) => {
    let aVal = sortBy === 'name' ? a.name : getItemCount(a.id)
    let bVal = sortBy === 'name' ? b.name : getItemCount(b.id)
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    
    return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
  })

  const columns: Column<List>[] = [
    {
      key: 'name',
      label: 'List Name',
      sortable: true,
      render: (list) => (
        <div className="font-medium">
          {editingList?.id === list.id ? (
            <input
              className="input input-sm"
              value={editingList.name}
              onChange={(e) => setEditingList({ ...editingList, name: e.target.value })}
              onBlur={() => {
                handleUpdate(list, { name: editingList.name })
                setEditingList(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUpdate(list, { name: editingList.name })
                  setEditingList(null)
                }
              }}
              autoFocus
            />
          ) : (
            <button
              className="text-left hover:text-accent"
              onClick={() => navigate(`/lists/${list.id}`)}
              title="Open list"
            >
              {list.name}
            </button>
          )}
        </div>
      )
    },
    {
      key: 'labels',
      label: 'Labels',
      render: (list) => (
        <div className="flex flex-wrap gap-1">
          {(list.labelIds || []).map(labelId => {
            const label = labels.find(l => l.id === labelId)
            if (!label) return null
            return (
              <span
                key={labelId}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                style={{ backgroundColor: label.color + '20', color: label.color }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </span>
            )
          })}
          {(!list.labelIds || list.labelIds.length === 0) && (
            <span className="text-xs text-gray-500">No labels</span>
          )}
        </div>
      )
    },
    {
      key: 'itemCount',
      label: 'Items',
      sortable: true,
      render: (list) => {
        const count = getItemCount(list.id)
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
            {count}
          </span>
        )
      }
    },
    {
      key: 'visibility',
      label: 'Shared',
      render: (list) => (
        <input
          type="checkbox"
          checked={(list.visibility || 'private') === 'public'}
          onChange={async (e) => {
            await handleUpdate(list, { visibility: e.target.checked ? 'public' : 'private' })
          }}
          title="Toggle shared"
        />
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (list) => (
        <div className="flex gap-2">
          <button
            className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
            onClick={(e) => {
              e.stopPropagation()
              setEditingList(list)
            }}
          >
            <Icon emoji="✏️" /> Edit
          </button>
          <button
            className="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(list.id)
            }}
          >
            <Icon emoji="🗑️" /> Delete
          </button>
        </div>
      )
    }
  ]

  return (
    <ManagementLayout
      title="Lists"
      compactHeader={true}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSortChange={(key, order) => {
        setSortBy(key)
        setSortOrder(order)
      }}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      sortOptions={[
        { key: 'name', label: 'Name' },
        { key: 'itemCount', label: 'Item Count' }
      ]}
      actionButton={
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="List name"
            className="input input-sm"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button className="create-btn" onClick={handleCreate}>+ Create List</button>
        </div>
      }
    >
      {viewMode === 'list' ? (
        <DataTable
          data={filteredLists}
          columns={columns}
          keyExtractor={(list) => list.id}
          emptyMessage="No lists found"
          searchQuery={searchQuery}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLists.map(list => (
            <div key={list.id} className="card">
              <div className="mb-2 font-medium">{list.name}</div>
              <div className="mb-2 text-xs text-gray-600">
                {getItemCount(list.id)} items
              </div>
              <div className="mb-3 flex flex-wrap gap-1">
                {(list.labelIds || []).slice(0, 3).map(labelId => {
                  const label = labels.find(l => l.id === labelId)
                  if (!label) return null
                  return (
                    <span
                      key={labelId}
                      className="h-4 w-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: label.color }}
                      title={label.name}
                    />
                  )
                })}
                {(list.labelIds?.length || 0) > 3 && (
                  <span className="text-xs text-gray-500">+{(list.labelIds?.length || 0) - 3}</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-sm flex-1"
                  onClick={() => setEditingList(list)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-sm bg-red-100 text-red-700"
                  onClick={() => handleDelete(list.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ManagementLayout>
  )
}
