import { useEffect, useMemo, useState } from 'react'
import { Labels, Notes, Todos, Users } from '../db/dexieClient'
import type { Label, Note, Todo, User } from '../db/schema'
import LinkTaskModal from '../components/LinkTaskModal'
import ShareNoteModal from '../components/ShareNoteModal'
import ManagementHeader from '../components/ManagementHeader'

export default function NotesManagement() {
  const [notes, setNotes] = useState<Note[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [localSearch, setLocalSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Note>>({})
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [sharePickerOpenId, setSharePickerOpenId] = useState<string | null>(null)
  const [labelPickerOpenId, setLabelPickerOpenId] = useState<string | null>(null)
  const [linkTaskOpen, setLinkTaskOpen] = useState<string | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState<string | null>(null)
  const [scheduleOpenId, setScheduleOpenId] = useState<string | null>(null)
  // Live state for instant visual feedback
  const [liveLabelIds, setLiveLabelIds] = useState<Record<string, string[]>>({})
  const [liveFlagged, setLiveFlagged] = useState<Record<string, boolean>>({})

  const load = async () => {
    const [ns, ls, ts] = await Promise.all([Notes.list(), Labels.list(), Todos.list()])
    setNotes(ns)
    setLabels(ls)
    setTodos(ts)
    // Initialize live state
    const labelMap: Record<string, string[]> = {}
    const flagMap: Record<string, boolean> = {}
    ns.forEach(n => {
      labelMap[n.id] = [...n.labelIds]
      flagMap[n.id] = n.flagged || false
    })
    setLiveLabelIds(labelMap)
    setLiveFlagged(flagMap)
  }

  useEffect(() => { load(); Users.list().then(setUsers) }, [])

  const filtered = useMemo(() => {
    let result = notes.filter(n => !n.archived)
    if (localSearch.trim()) {
      const s = localSearch.toLowerCase()
      result = result.filter(n => (n.title || '').toLowerCase().includes(s) || (n.content || '').toLowerCase().includes(s))
    }
    // Always sort by updated (most recent first)
    result = result.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    return result
  }, [notes, localSearch])

  // Split pinned and unpinned
  const pinned = filtered.filter(n => n.pinned)
  const unpinned = filtered.filter(n => !n.pinned)

  const startNew = () => {
    setEditingId('NEW')
    setDraft({ title: '', content: '', labelIds: [] })
  }
  const startEdit = (n: Note) => {
    setEditingId(n.id)
    setDraft({ ...n })
  }
  const cancelEdit = () => { setEditingId(null); setDraft({}) }

  const saveDraft = async () => {
    if (!draft.title && !draft.content) { cancelEdit(); return }
    if (editingId === 'NEW') {
      await Notes.add({ title: draft.title || '', content: draft.content || '', labelIds: draft.labelIds || [], pinned: false, archived: false })
    } else if (editingId) {
      await Notes.update(editingId, {
        title: draft.title || '',
        content: draft.content || '',
        labelIds: draft.labelIds || [],
      })
    }
    await load()
    cancelEdit()
  }
  const remove = async (id: string) => {
    const note = notes.find(n => n.id === id)
    if (!note) return
    
    // Check if note has linked tasks
    if (note.linkedTodoIds && note.linkedTodoIds.length > 0) {
      const linkedTasks = todos.filter(t => note.linkedTodoIds!.includes(t.id))
      const taskTitles = linkedTasks.map(t => `• ${t.title}`).join('\n')
      
      const confirmMsg = `⚠️ WARNING: This note is linked to ${linkedTasks.length} task(s):\n\n${taskTitles}\n\nDeleting this note will remove these links. Continue?`
      
      if (!confirm(confirmMsg)) return
    } else {
      if (!confirm('Delete this note?')) return
    }
    
    await Notes.remove(id)
    await load()
  }
  const togglePin = async (n: Note) => {
    await Notes.update(n.id, { pinned: !n.pinned })
    await load()
  }
  const toggleArchive = async (n: Note) => {
    await Notes.update(n.id, { archived: !n.archived })
    await load()
  }
  const toggleFlag = async (n: Note) => {
    const newFlagged = !n.flagged
    // Instant visual feedback
    setLiveFlagged(prev => ({ ...prev, [n.id]: newFlagged }))
    await Notes.update(n.id, { flagged: newFlagged })
    await load()
  }
  const toggleShared = async (n: Note) => {
    // Inline share picker like assignee UX
    setSharePickerOpenId((prev) => (prev === n.id ? null : n.id))
  }
  
  const shareWithUser = async (noteId: string, userId: string) => {
    const note = notes.find(n => n.id === noteId)
    if (!note) return
    const newSharedWith = [...(note.sharedWith || []), userId]
    await Notes.update(noteId, { sharedWith: newSharedWith, shared: newSharedWith.length > 0 })
    await load()
  }
  
  const unshareWithUser = async (noteId: string, userId: string) => {
    const note = notes.find(n => n.id === noteId)
    if (!note) return
    const newSharedWith = (note.sharedWith || []).filter(id => id !== userId)
    await Notes.update(noteId, { sharedWith: newSharedWith, shared: newSharedWith.length > 0 })
    await load()
  }

  const toggleDraftLabel = (id: string) => {
    setDraft((d) => {
      const list = d.labelIds || []
      return { ...d, labelIds: list.includes(id) ? list.filter(x => x !== id) : [...list, id] }
    })
  }

  const toggleNoteLabel = async (noteId: string, labelId: string) => {
    const note = notes.find(n => n.id === noteId)
    if (!note) return
    
    const currentLabels = liveLabelIds[noteId] || note.labelIds
    const hasLabel = currentLabels.includes(labelId)
    const nextLabels = hasLabel 
      ? currentLabels.filter(id => id !== labelId)
      : [...currentLabels, labelId]
    
    // Instant visual feedback
    setLiveLabelIds(prev => ({ ...prev, [noteId]: nextLabels }))
    
    await Notes.update(noteId, { labelIds: nextLabels })
    await load()
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <ManagementHeader
        title="Notes"
        infoText="Snelle notities, te pinnen en te delen. Je kunt ze koppelen aan taken."
        onCreateClick={startNew}
        createTitle="New note"
        searchValue={localSearch}
        onSearchChange={setLocalSearch}
        searchPlaceholder="Search notes..."
        compact
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Editor Modal */}
        {editingId && (
          <>
            <div className="fixed inset-0 z-50 bg-black/50" onClick={cancelEdit} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="w-full max-w-2xl rounded-lg border-2 border-gray-300 bg-white p-4 shadow-xl pointer-events-auto">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={draft.title || ''}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Title"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={saveDraft}
                    className="w-9 h-9 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-gray-100 flex-shrink-0"
                    title="Save"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="w-9 h-9 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-gray-100 flex-shrink-0"
                    title="Cancel"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <textarea
                  value={draft.content || ''}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  placeholder="Write your note..."
                  className="min-h-[200px] w-full rounded border border-gray-300 px-3 py-2 text-sm resize-none"
                />
                {/* Label selector */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {labels.map(l => (
                    <button
                      key={l.id}
                      onClick={() => toggleDraftLabel(l.id)}
                      className={`px-2 py-1 rounded text-xs border ${draft.labelIds?.includes(l.id) ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 hover:bg-gray-100'}`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Pinned Notes */}
        {pinned.length > 0 && (
          <>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Pinned</div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-6">
              {pinned.map(n => {
                const isFlagged = liveFlagged[n.id] ?? n.flagged ?? false
                const noteLabelIds = liveLabelIds[n.id] || n.labelIds
                return (
                  <div key={n.id} className={`rounded-lg border-2 p-3 hover:shadow-md transition-shadow flex flex-col ${isFlagged ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
                {/* Top row: title bar actions */}
                <div className="mb-2 flex items-center justify-end gap-1">
                  {n.pinned && (
                    <div className="w-7 h-7 flex items-center justify-center text-gray-800" title="Pinned">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                      </svg>
                    </div>
                  )}
                  <button
                    className="p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-100 hover:text-gray-900"
                    onClick={() => setOpenMenuId(openMenuId === n.id ? null : n.id)}
                    title="Options"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                </div>
                {/* Content (click to edit) */}
                <div className="flex-1 min-w-0 mb-3 cursor-pointer" onClick={() => startEdit(n)} title="Click to edit">
                  <div className="font-medium text-sm truncate mb-1" title={n.title || '(untitled)'}>
                    {n.title || '(untitled)'}
                  </div>
                  <div className="text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap">{n.content}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {noteLabelIds.map(id => {
                      const l = labels.find(x => x.id === id)
                      if (!l) return null
                      return (
                        <button
                          key={id}
                          className="chip border-gray-200 text-[11px] px-1.5 py-0.5 hover:bg-red-50 hover:border-red-300 inline-flex items-center gap-1 rounded-full border transition-colors"
                          style={{ borderColor: l.color }}
                          title={labelPickerOpenId === n.id ? `Remove ${l.name}` : l.name}
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (labelPickerOpenId === n.id) {
                              await toggleNoteLabel(n.id, id)
                            }
                          }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                          {l.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {/* Options panel - All icons in ONE ROW */}
                {openMenuId === n.id && (
                  <div className="w-full max-w-full flex flex-wrap items-center justify-start gap-1.5 p-2 bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden">
                    {/* Pin toggle (black/white; filled when active) */}
                    <button
                      className={`p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border transition-all hover:scale-105 ${n.pinned ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-800 bg-white hover:bg-gray-50'}`}
                      title={n.pinned ? 'Unpin' : 'Pin'}
                      onClick={() => togglePin(n)}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                      </svg>
                    </button>

                    {/* Schedule / Due date - click to open options */}
                    <button
                      className={`p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border transition-all hover:scale-105 ${n.dueDate ? 'border-yellow-400 text-yellow-600 bg-yellow-50' : 'border-gray-200 text-gray-800 bg-white hover:bg-gray-50'}`}
                      onClick={() => setScheduleOpenId(scheduleOpenId === n.id ? null : n.id)}
                      title="Schedule"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                    
                    {/* Labels toggle */}
                    <button
                      className={`p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border transition-all hover:scale-105 ${n.labelIds.length > 0 ? 'border-indigo-400 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-800 bg-white hover:bg-gray-50'}`}
                      onClick={() => { setLabelPickerOpenId(labelPickerOpenId === n.id ? null : n.id); setSharePickerOpenId(null); setScheduleOpenId(null) }}
                      title="Manage labels"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    </button>
                    
                    {/* Share (assignee-like) */}
                    <button
                      className={`p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border transition-all hover:scale-105 ${(n.sharedWith || []).length > 0 ? 'border-purple-400 text-purple-600 bg-purple-50' : 'border-gray-200 text-gray-800 bg-white hover:bg-gray-50'}`}
                      onClick={() => { setSharePickerOpenId(sharePickerOpenId === n.id ? null : n.id); setLabelPickerOpenId(null); setScheduleOpenId(null) }}
                      title="Share"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </button>
                    
                    {/* Link Task */}
                    <button 
                      className={`p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border transition-all hover:scale-105 ${(n.linkedTodoIds || []).length > 0 ? 'border-teal-400 text-teal-600 bg-teal-50' : 'border-gray-200 text-gray-800 bg-white hover:bg-gray-50'}`}
                      title={(n.linkedTodoIds || []).length > 0 ? `Linked to ${n.linkedTodoIds!.length} task(s)` : 'Link task'} 
                      onClick={() => { setLinkTaskOpen(n.id); setSharePickerOpenId(null); setLabelPickerOpenId(null); setScheduleOpenId(null) }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </button>
                    
                    {/* Archive */}
                    <button 
                      className="p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-800 bg-white hover:bg-gray-50 transition-all hover:scale-105" 
                      title={n.archived ? 'Unarchive' : 'Archive'} 
                      onClick={() => toggleArchive(n)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                    </button>
                    
                    {/* Delete */}
                    <button 
                      className="p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-800 bg-white hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all hover:scale-105" 
                      title="Delete" 
                      onClick={() => remove(n.id)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                )}
                
                {/* Expandable panels BELOW the icon row */}
                {scheduleOpenId === n.id && (
                  <NoteSchedule
                    value={n.dueDate || ''}
                    onClose={() => setScheduleOpenId(null)}
                    onChange={async (val) => { await Notes.update(n.id, { dueDate: val || undefined }); await load() }}
                  />
                )}
                {labelPickerOpenId === n.id && (
                  <div className="w-full border rounded p-2 flex flex-wrap gap-1 bg-gray-50">
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
                {sharePickerOpenId === n.id && (
                  <div className="w-full border rounded p-2 flex flex-wrap gap-2 bg-gray-50">
                    {users.map(u => {
                      const active = (n.sharedWith || []).includes(u.id)
                      const initials = (u.firstName?.[0] || '') + (u.lastName?.[0] || '') || u.name?.[0] || 'U'
                      return (
                        <button key={u.id} className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-[10px] font-semibold ${active ? 'border-accent bg-accent/10 text-accent' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`} onClick={async () => {
                          const current = n.sharedWith || []
                          const next = active ? current.filter(id => id !== u.id) : [...current, u.id]
                          await Notes.update(n.id, { sharedWith: next, shared: next.length > 0 })
                          await load()
                        }} title={u.name}>
                          {initials}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              )
              })}
          </div>
          </>
        )}

        {/* Unpin Divider */}
        {pinned.length > 0 && unpinned.length > 0 && (
          <div className="flex items-center gap-2 my-6">
            <div className="flex-1 h-px bg-gray-300"></div>
            <button 
              className="text-xs font-semibold text-gray-500 uppercase px-2 py-1 rounded hover:bg-gray-100"
              onClick={async () => {
                for (const n of pinned) {
                  await Notes.update(n.id, { pinned: false })
                }
                await load()
              }}
            >
              Unpin All
            </button>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>
        )}

        {/* Unpinned Notes */}
        {unpinned.length > 0 && (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {unpinned.map(n => {
              const isFlagged = liveFlagged[n.id] ?? n.flagged ?? false
              const noteLabelIds = liveLabelIds[n.id] || n.labelIds
              return (
                <div key={n.id} className={`rounded-lg border-2 p-3 hover:shadow-md transition-shadow flex flex-col ${isFlagged ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
                {/* Top row: title bar actions */}
                <div className="mb-2 flex items-center justify-end gap-1">
                  {n.pinned && (
                    <div className="w-7 h-7 flex items-center justify-center text-gray-800" title="Pinned">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                      </svg>
                    </div>
                  )}
                  <button
                    className="p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-100 hover:text-gray-900"
                    onClick={() => setOpenMenuId(openMenuId === n.id ? null : n.id)}
                    title="Options"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                </div>
                {/* Content (click to edit) */}
                <div className="flex-1 min-w-0 mb-3 cursor-pointer" onClick={() => startEdit(n)} title="Click to edit">
                  <div className="font-medium text-sm truncate mb-1" title={n.title || '(untitled)'}>
                    {n.title || '(untitled)'}
                  </div>
                  <div className="text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap">{n.content}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {noteLabelIds.map(id => {
                      const l = labels.find(x => x.id === id)
                      if (!l) return null
                      return (
                        <button
                          key={id}
                          className="chip border-gray-200 text-[11px] px-1.5 py-0.5 hover:bg-red-50 hover:border-red-300 inline-flex items-center gap-1 rounded-full border transition-colors"
                          style={{ borderColor: l.color }}
                          title={labelPickerOpenId === n.id ? `Remove ${l.name}` : l.name}
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (labelPickerOpenId === n.id) {
                              await toggleNoteLabel(n.id, id)
                            }
                          }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                          {l.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {/* Options panel - All icons in ONE ROW */}
                {openMenuId === n.id && (
                  <div className="w-full max-w-full flex flex-wrap items-center justify-start gap-1.5 p-2 bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden">
                    {/* Pin toggle */}
                    <button
                      className={`p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border transition-all hover:scale-105 ${n.pinned ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-800 bg-white hover:bg-gray-50'}`}
                      title={n.pinned ? 'Unpin' : 'Pin'}
                      onClick={() => togglePin(n)}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                      </svg>
                    </button>
                    
                    {/* Schedule */}
                    <button
                      className={`p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border transition-all hover:scale-105 ${n.dueDate ? 'border-yellow-400 text-yellow-600 bg-yellow-50' : 'border-gray-200 text-gray-800 bg-white hover:bg-gray-50'}`}
                      onClick={() => setScheduleOpenId(scheduleOpenId === n.id ? null : n.id)}
                      title="Schedule"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                    
                    {/* Labels */}
                    <button 
                      className={`p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border transition-all hover:scale-105 ${n.labelIds.length > 0 ? 'border-indigo-400 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-800 bg-white hover:bg-gray-50'}`}
                      onClick={() => { setLabelPickerOpenId(labelPickerOpenId === n.id ? null : n.id); setSharePickerOpenId(null); setScheduleOpenId(null) }} 
                      title="Manage labels"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    </button>
                    
                    {/* Share */}
                    <button 
                      className={`p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border transition-all hover:scale-105 ${(n.sharedWith || []).length > 0 ? 'border-purple-400 text-purple-600 bg-purple-50' : 'border-gray-200 text-gray-800 bg-white hover:bg-gray-50'}`}
                      onClick={() => { setSharePickerOpenId(sharePickerOpenId === n.id ? null : n.id); setLabelPickerOpenId(null); setScheduleOpenId(null) }} 
                      title="Share"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </button>
                    
                    {/* Link Task */}
                    <button 
                      className={`p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border transition-all hover:scale-105 ${(n.linkedTodoIds || []).length > 0 ? 'border-teal-400 text-teal-600 bg-teal-50' : 'border-gray-200 text-gray-800 bg-white hover:bg-gray-50'}`}
                      title={(n.linkedTodoIds || []).length > 0 ? `Linked to ${n.linkedTodoIds!.length} task(s)` : 'Link task'} 
                      onClick={() => { setLinkTaskOpen(n.id); setSharePickerOpenId(null); setLabelPickerOpenId(null); setScheduleOpenId(null) }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </button>
                    
                    {/* Archive */}
                    <button 
                      className="p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-800 bg-white hover:bg-gray-50 transition-all hover:scale-105" 
                      title={n.archived ? 'Unarchive' : 'Archive'} 
                      onClick={() => toggleArchive(n)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                    </button>
                    
                    {/* Delete */}
                    <button 
                      className="p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-800 bg-white hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all hover:scale-105" 
                      title="Delete" 
                      onClick={() => remove(n.id)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                )}
                
                {/* Expandable panels BELOW the icon row */}
                {scheduleOpenId === n.id && (
                  <NoteSchedule
                    value={n.dueDate || ''}
                    onClose={() => setScheduleOpenId(null)}
                    onChange={async (val) => { await Notes.update(n.id, { dueDate: val || undefined }); await load() }}
                  />
                )}
                {labelPickerOpenId === n.id && (
                  <div className="w-full border rounded p-2 flex flex-wrap gap-1 bg-gray-50">
                    {labels.map(l => {
                      const active = n.labelIds.includes(l.id)
                      return (
                        <button key={l.id} className={`px-2 py-0.5 text-xs rounded border ${active ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 hover:bg-gray-100'}`} onClick={async () => { const next = active ? n.labelIds.filter(x => x !== l.id) : [...n.labelIds, l.id]; await Notes.update(n.id, { labelIds: next }); await load() }}>
                          {l.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                {sharePickerOpenId === n.id && (
                  <div className="w-full border rounded p-2 flex flex-wrap gap-2 bg-gray-50">
                    {users.map(u => {
                      const active = (n.sharedWith || []).includes(u.id)
                      const initials = (u.firstName?.[0] || '') + (u.lastName?.[0] || '') || u.name?.[0] || 'U'
                      return (
                        <button key={u.id} className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-[10px] font-semibold ${active ? 'border-accent bg-accent/10 text-accent' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`} onClick={async () => { const current = n.sharedWith || []; const next = active ? current.filter(id => id !== u.id) : [...current, u.id]; await Notes.update(n.id, { sharedWith: next, shared: next.length > 0 }); await load() }} title={u.name}>
                          {initials}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              )
              })}
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 mt-8">No notes yet</div>
        )}
      </div>

      {/* Link Task Modal */}
      {linkTaskOpen && (
        <LinkTaskModal
          onClose={() => setLinkTaskOpen(null)}
          linkedTodoIds={notes.find(n => n.id === linkTaskOpen)?.linkedTodoIds || []}
          onLink={async (todoId) => {
            const note = notes.find(n => n.id === linkTaskOpen)
            if (!note) return
            const newLinkedIds = [...(note.linkedTodoIds || []), todoId]
            await Notes.update(note.id, { linkedTodoIds: newLinkedIds })
            await load()
          }}
        />
      )}

      {/* Share Modal removed in favor of inline picker */}
    </div>
  )
}

function NoteSchedule({ value, onChange, onClose }: { value: string; onChange: (v: string | null) => void; onClose: () => void }) {
  const [date, setDate] = useState<string>(() => (value ? value.substring(0,10) : ''))
  const setAndClose = (v: string | null) => { onChange(v); onClose() }
  const today = () => new Date()
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d }
  const nextMonday = () => {
    const d = new Date()
    const day = d.getDay() // 0 Sun ... 6 Sat
    const diff = (8 - day) % 7 || 7
    d.setDate(d.getDate() + diff)
    return d
  }
  const fmt = (d: Date) => d.toISOString().substring(0,10)
  return (
    <div className="w-full mt-2 rounded-md border bg-white p-2 shadow-card text-xs">
      <div className="grid grid-cols-3 gap-1 mb-2">
        <button className="btn text-xs" onClick={() => setAndClose(fmt(today()))}>Today</button>
        <button className="btn text-xs" onClick={() => setAndClose(fmt(tomorrow()))}>Tomorrow</button>
        <button className="btn text-xs" onClick={() => setAndClose(fmt(nextMonday()))}>Next Mon</button>
      </div>
      <div className="flex items-center gap-2">
        <input type="date" className="input text-xs py-1" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn text-xs" onClick={() => setAndClose(date || null)}>Set</button>
        <button className="btn text-xs" onClick={() => setAndClose(null)}>Clear</button>
        <button className="btn text-xs" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
