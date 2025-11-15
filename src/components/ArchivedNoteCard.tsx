import React from 'react'
import { PinIcon } from './IconSet'
import type { Label, Note } from '../db/schema'

interface ArchivedNoteCardProps {
  note: Note
  labels: Label[]
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
  labelPickerOpenId: string | null
  setLabelPickerOpenId: (id: string | null) => void
  restoreNote: (note: Note) => void
  togglePin: (note: Note) => void
  updateLabels: (noteId: string, labelIds: string[]) => void
}

const ArchivedNoteCard: React.FC<ArchivedNoteCardProps> = ({
  note,
  labels,
  openMenuId,
  setOpenMenuId,
  labelPickerOpenId,
  setLabelPickerOpenId,
  restoreNote,
  togglePin,
  updateLabels,
}) => {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate" title={note.title || '(untitled)'}>{note.title || '(untitled)'}</div>
        </div>
        <div className="flex items-center gap-1">
          {note.pinned && (
            <div className="w-6 h-6 flex items-center justify-center text-gray-800" title="Pinned">
              <PinIcon filled size={14} />
            </div>
          )}
          <button className="px-2 py-1 rounded border text-xs hover:bg-gray-50" onClick={() => restoreNote(note)} title="Restore">Restore</button>
          <button
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-100 hover:text-gray-900"
            onClick={() => setOpenMenuId(openMenuId === note.id ? null : note.id)}
            title="Options"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
        </div>
      </div>
      <div className="mt-1 text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap">{note.content}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {note.labelIds.map(id => {
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
      {openMenuId === note.id && (
        <div className="mt-2 w-full max-w-full flex flex-wrap items-center justify-start gap-1.5 p-2 bg-white rounded-lg border border-gray-200">
          {/* Pin toggle */}
          <button
            className={`p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${note.pinned ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-800 bg-white hover:bg-gray-50'}`}
            title={note.pinned ? 'Unpin' : 'Pin'}
            onClick={() => togglePin(note)}
          >
            <PinIcon filled={note.pinned} size={16} />
          </button>
          {/* Labels */}
          <button className="p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50" onClick={() => setLabelPickerOpenId(labelPickerOpenId === note.id ? null : note.id)} title="Manage labels">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
          </button>
          {labelPickerOpenId === note.id && (
            <div className="w-full border rounded p-2 flex flex-wrap gap-1">
              {labels.map(l => {
                const active = note.labelIds.includes(l.id)
                return (
                  <button key={l.id} className={`px-2 py-0.5 text-xs rounded border ${active ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 hover:bg-gray-100'}`} onClick={() => updateLabels(note.id, active ? note.labelIds.filter(x => x !== l.id) : [...note.labelIds, l.id])}>
                    {l.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ArchivedNoteCard
