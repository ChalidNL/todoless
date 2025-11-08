import ProtectedRoute from '../../components/auth/ProtectedRoute'
import { useEffect, useState } from 'react'
import { useAuth } from '../../store/auth'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'

interface Task { id: number; title: string; workflow: string | null; workflowStage: string | null; created_by: number; assigned_to: number | null }

export default function BacklogPage() {
  return (
    <ProtectedRoute>
      <BacklogInner />
    </ProtectedRoute>
  )
}

function BacklogInner() {
  const { user } = useAuth()
  const [items, setItems] = useState<Task[]>([])
  const [title, setTitle] = useState('')

  async function refresh() {
    const res = await fetch(`${API}/api/tasks/backlog`, { credentials: 'include' })
    const json = await res.json()
    const all: Task[] = json.items || []
    const filtered = user?.role === 'child' ? all.filter(t => t.created_by === user.id || t.assigned_to === user.id) : all
    setItems(filtered)
  }

  async function addItem() {
    if (!title.trim()) return
    await fetch(`${API}/api/tasks`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
    setTitle('')
    refresh()
  }

  useEffect(() => { refresh() }, [])

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Backlog</h1>
      <div className="flex gap-2 mb-3">
        <input className="border rounded px-3 py-2 flex-1" placeholder="New task" value={title} onChange={e => setTitle(e.target.value)} />
        <button className="bg-blue-600 text-white px-3 py-2 rounded" onClick={addItem}>+</button>
      </div>
      <ul className="space-y-2">
        {items.map(t => (
          <li key={t.id} className="border rounded px-3 py-2 flex items-center justify-between">
            <span>{t.title}</span>
            <div className="flex gap-2">
              <button className="text-sm px-2 py-1 rounded bg-gray-100" onClick={async () => { await fetch(`${API}/api/tasks/${t.id}/push`, { method: 'POST', credentials: 'include' }); refresh() }}>→</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
