import { useEffect, useMemo, useState } from 'react'
import ManagementHeader from '../components/ManagementHeader'
import { Labels, Notes, Todos } from '../db/dexieClient'
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

  useEffect(() => { load() }, [])

  const restoreNote = async (n: Note) => {
    await Notes.update(n.id, { archived: false })
    await load()
  }

  const togglePin = async (n: Note) => {
    await Notes.update(n.id, { pinned: !n.pinned })
    await load()
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
        infoText="Hier vind je voltooide taken en gearchiveerde notities. Je kunt zoeken en snel terugvinden."
        showCreate={false}
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Zoek in archive..."
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
          <div className="mb-2 text-xs font-semibold uppercase text-gray-500">Completed tasks</div>
          {completedTodos.length === 0 ? (
            <div className="rounded border bg-white p-3 text-sm text-gray-600">Geen voltooide taken</div>
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
          <div className="mb-2 text-xs font-semibold uppercase text-gray-500">Archived notes</div>
          {archivedNotes.length === 0 ? (
            <div className="rounded border bg-white p-3 text-sm text-gray-600">Geen gearchiveerde notities</div>
          ) : (
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {archivedNotes.map(n => (
                <div key={n.id} className="rounded-lg border bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate" title={n.title || '(untitled)'}>{n.title || '(untitled)'}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {n.pinned && (
                        <div className="w-6 h-6 flex items-center justify-center text-gray-800" title="Pinned">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M15 3l6 6-3 3-4-4-7 7v4H3v-4l7-7-4-4 3-3 4 4z" /></svg>
                        </div>
                      )}
                      <button className="px-2 py-1 rounded border text-xs hover:bg-gray-50" onClick={() => restoreNote(n)} title="Restore">Restore</button>
                      <button
                        className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-100 hover:text-gray-900"
                        onClick={() => setOpenMenuId(openMenuId === n.id ? null : n.id)}
                        title="Options"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap">{n.content}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {n.labelIds.map(id => {
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
                  {openMenuId === n.id && (
                    <div className="mt-2 w-full max-w-full flex flex-wrap items-center justify-start gap-1.5 p-2 bg-white rounded-lg border border-gray-200">
                      {/* Pin toggle */}
                      <button
                        className={`p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${n.pinned ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-800 bg-white hover:bg-gray-50'}`}
                        title={n.pinned ? 'Unpin' : 'Pin'}
                        onClick={() => togglePin(n)}
                      >
                        <svg className="w-4 h-4" fill={n.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3l6 6-3 3-4-4-7 7v4H3v-4l7-7-4-4 3-3 4 4z" />
                        </svg>
                      </button>
                      {/* Labels */}
                      <button className="p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50" onClick={() => setLabelPickerOpenId(labelPickerOpenId === n.id ? null : n.id)} title="Manage labels">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                      </button>
                      {labelPickerOpenId === n.id && (
                        <div className="w-full border rounded p-2 flex flex-wrap gap-1">
                          {labels.map(l => {
                            const active = n.labelIds.includes(l.id)
                            return (
                              <button key={l.id} className={`px-2 py-0.5 text-xs rounded border ${active ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 hover:bg-gray-100'}`} onClick={async () => {
                                const next = active ? n.labelIds.filter(x => x !== l.id) : [...n.labelIds, l.id]
                                await Notes.update(n.id, { labelIds: next })
                                await load()
                              }}>
                                {l.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        )}
      </div>
    </div>
  )
}
