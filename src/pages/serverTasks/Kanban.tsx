import ProtectedRoute from '../../components/auth/ProtectedRoute'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../store/auth'

const API = (import.meta as any).env?.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000')

interface Task { id: number; title: string; workflow: string | null; workflowStage: 'todo'|'doing'|'done'|null; created_by: number; assigned_to: number | null }

export default function KanbanPage() {
  return (
    <ProtectedRoute>
      <KanbanInner />
    </ProtectedRoute>
  )
}

function KanbanInner() {
  const { user } = useAuth()
  const [items, setItems] = useState<Task[]>([])

  async function refresh() {
    const res = await fetch(`${API}/api/tasks/kanban`, { credentials: 'include' })
    const json = await res.json()
    const all: Task[] = json.items || []
    const filtered = user?.role === 'child' ? all.filter(t => t.created_by === user.id || t.assigned_to === user.id) : all
    setItems(filtered)
  }

  useEffect(() => { refresh() }, [])

  const cols = useMemo(() => ({
    todo: items.filter(i => i.workflowStage === 'todo'),
    doing: items.filter(i => i.workflowStage === 'doing'),
    done: items.filter(i => i.workflowStage === 'done'),
  }), [items])

  async function move(id: number, dir: 'left'|'right') {
    const path = dir === 'right' ? 'push' : 'pull'
    await fetch(`${API}/api/tasks/${id}/${path}`, { method: 'POST', credentials: 'include' })
    refresh()
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Kanban</h1>
      <div className="grid grid-cols-3 gap-3">
        {(['todo','doing','done'] as const).map(stage => (
          <div key={stage} className="bg-white border rounded p-2 min-h-[300px]">
            <div className="font-semibold capitalize mb-2">{stage}</div>
            <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-1">
              {cols[stage].map(t => (
                <div key={t.id} className={`border rounded px-2 py-1 flex items-center justify-between ${stage==='done' ? 'bg-green-50 border-green-300' : ''}`}>
                  <span className="truncate pr-2">{t.title}</span>
                  <div className="flex gap-2">
                    <button className="text-sm px-2 py-1 rounded bg-gray-100" onClick={() => move(t.id, 'left')}>←</button>
                    <button className="text-sm px-2 py-1 rounded bg-gray-100" onClick={() => move(t.id, 'right')}>→</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
