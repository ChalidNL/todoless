import { useEffect, useMemo, useState } from 'react'
import ArchivedNoteCard from '../components/ArchivedNoteCard'
import { PinIcon } from '../components/IconSet'
import ManagementHeader from '../components/ManagementHeader'
import { Labels, Notes, Todos, notesBus } from '../db/dexieClient'
import type { Label, Note, Todo } from '../db/schema'
import { useFilterContext } from '../contexts/FilterContext'

export default function Archive() {
  const [q, setQ] = useState('')
  const [todos, setTodos] = useState<Todo[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [labelPickerOpenId, setLabelPickerOpenId] = useState<string | null>(null)
  const { selectedTypes } = useFilterContext()

  const load = async () => {
    const [ts, ns, ls] = await Promise.all([Todos.list(), Notes.list(), Labels.list()])
    setTodos(ts)
    setNotes(ns)
    setLabels(ls)
  }

  useEffect(() => { 
    load()
    
    // Listen for note updates to sync pin/archive changes in real-time
    const onNoteUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as Note
      setNotes(prev => prev.map(n => n.id === detail.id ? detail : n))
    }
    const onNoteRemoved = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string }
      setNotes(prev => prev.filter(n => n.id !== detail.id))
    }
    
    notesBus.addEventListener('note:updated', onNoteUpdated)
    notesBus.addEventListener('note:removed', onNoteRemoved)
    
    return () => {
      notesBus.removeEventListener('note:updated', onNoteUpdated)
      notesBus.removeEventListener('note:removed', onNoteRemoved)
    }
  }, [])

  const restoreNote = async (n: Note) => {
    await Notes.update(n.id, { archived: false })
    await load()
  }

  const togglePin = async (n: Note) => {
    await Notes.update(n.id, { pinned: !n.pinned })
    await load()
  }

  const deleteAllCompletedTasks = async () => {
    if (!confirm(`Are you sure you want to permanently delete all ${completedTodos.length} completed tasks? This action cannot be undone.`)) {
      return
    }

    try {
      // Delete all completed tasks
      for (const todo of completedTodos) {
        await Todos.remove(todo.id)
      }
      await load()
    } catch (e) {
      alert('Failed to delete tasks: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const deleteAllArchivedNotes = async () => {
    if (!confirm(`Are you sure you want to permanently delete all ${archivedNotes.length} archived notes? This action cannot be undone.`)) {
      return
    }

    try {
      // Delete all archived notes
      for (const note of archivedNotes) {
        await Notes.remove(note.id)
      }
      await load()
    } catch (e) {
      alert('Failed to delete notes: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const completedTodos = useMemo(() => {
    const s = q.trim().toLowerCase()
    return todos
      .filter(t => t.completed)
      .filter(t => !s || t.title.toLowerCase().includes(s) || t.labelIds.some(id => labels.find(l => l.id === id)?.name.toLowerCase().includes(s)))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [todos, q, labels])

  const archivedNotes = useMemo(() => {
    const s = q.trim().toLowerCase()
    return notes
      .filter(n => n.archived)
      .filter(n => !s || (n.title || '').toLowerCase().includes(s) || (n.content || '').toLowerCase().includes(s))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  }, [notes, q])

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <ManagementHeader
        title="Archive"
        infoText="Completed tasks and archived notes. Search and restore quickly."
        showCreate={false}
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search archive..."
      />
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-white p-3">
            <div className="text-xs text-gray-500">Completed tasks</div>
            <div className="text-xl font-semibold">{selectedTypes.includes('tasks') ? completedTodos.length : 0}</div>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <div className="text-xs text-gray-500">Archived notes</div>
            <div className="text-xl font-semibold">{selectedTypes.includes('notes') ? archivedNotes.length : 0}</div>
          </div>
        </div>

        {/* Completed tasks */}
        {selectedTypes.includes('tasks') && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-gray-500">Completed tasks</div>
            {completedTodos.length > 0 && (
              <button
                onClick={deleteAllCompletedTasks}
                className="text-xs px-3 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete All ({completedTodos.length})
              </button>
            )}
          </div>
          {completedTodos.length === 0 ? (
            <div className="rounded border bg-white p-3 text-sm text-gray-600">No completed tasks</div>
          ) : (
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {completedTodos.map(t => (
                <div key={t.id} className="rounded-lg border bg-white p-3">
                  <div className="text-sm line-through text-gray-500" title={t.title}>{t.title}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.labelIds.map(id => {
                      const l = labels.find(x => x.id === id)
                      if (!l) return null
                      return (
                        <span key={id} className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px]" style={{ borderColor: l.color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                          {l.name}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {/* Archived notes */}
        {selectedTypes.includes('notes') && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-gray-500">Archived notes</div>
            {archivedNotes.length > 0 && (
              <button
                onClick={deleteAllArchivedNotes}
                className="text-xs px-3 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete All ({archivedNotes.length})
              </button>
            )}
          </div>
          {archivedNotes.length === 0 ? (
            <div className="rounded border bg-white p-3 text-sm text-gray-600">No archived notes</div>
          ) : (
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {archivedNotes.map(n => (
                <ArchivedNoteCard
                  key={n.id}
                  note={n}
                  labels={labels}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  labelPickerOpenId={labelPickerOpenId}
                  setLabelPickerOpenId={setLabelPickerOpenId}
                  restoreNote={restoreNote}
                  togglePin={togglePin}
                  updateLabels={async (noteId, labelIds) => {
                    await Notes.update(noteId, { labelIds })
                    await load()
                  }}
                />
              ))}
            </div>
          )}
        </section>
        )}
      </div>
    </div>
  )
}
