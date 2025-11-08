import { useEffect, useState } from 'react'
import { Notes } from '../db/dexieClient'
import type { Note } from '../db/schema'
import CloseButton from './ui/CloseButton'

interface Props {
  onClose: () => void
  onLink: (noteId: string) => void
  linkedNoteIds: string[]
}

export default function LinkNoteModal({ onClose, onLink, linkedNoteIds }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    Notes.list().then((ns) => {
      setNotes(ns.filter(n => !n.archived))
    })
  }, [])

  const filtered = notes.filter(n => {
    const s = search.toLowerCase()
    return (n.title || '').toLowerCase().includes(s) || (n.content || '').toLowerCase().includes(s)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border-2 border-gray-300 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Link Note</h3>
          <CloseButton onClick={onClose} />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes..."
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-3"
          autoFocus
        />
        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-4">No notes found</div>
          ) : (
            filtered.map((n) => {
              const isLinked = linkedNoteIds.includes(n.id)
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    onLink(n.id)
                    onClose()
                  }}
                  disabled={isLinked}
                  className={`w-full text-left p-3 rounded border-2 transition-colors ${
                    isLinked
                      ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                      : 'border-gray-300 hover:border-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-sm">{n.title || '(untitled)'}</div>
                  {n.content && (
                    <div className="text-xs text-gray-600 mt-1 line-clamp-2">{n.content}</div>
                  )}
                  {isLinked && (
                    <div className="text-xs text-gray-500 mt-1">Already linked</div>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
