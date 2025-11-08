import { useEffect, useState } from 'react'
import { Users } from '../db/dexieClient'
import type { User } from '../db/schema'
import CloseButton from './ui/CloseButton'

interface ShareNoteModalProps {
  onClose: () => void
  sharedWith: string[]
  onShare: (userId: string) => void
  onUnshare: (userId: string) => void
}

export default function ShareNoteModal({ onClose, sharedWith, onShare, onUnshare }: ShareNoteModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    Users.list().then(setUsers)
  }, [])

  const filtered = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border-2 border-gray-300 bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Share Note</h3>
          <CloseButton onClick={onClose} />
        </div>

        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm mb-3"
          autoFocus
        />

        <div className="max-h-96 space-y-1 overflow-y-auto">
          {filtered.map((user) => {
            const isShared = sharedWith.includes(user.id)
            return (
              <button
                key={user.id}
                onClick={() => isShared ? onUnshare(user.id) : onShare(user.id)}
                className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                  isShared
                    ? 'bg-indigo-50 border-2 border-indigo-200'
                    : 'hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div
                  className="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: user.themeColor || '#6366f1' }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                  {user.email && (
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  )}
                </div>
                {isShared && (
                  <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            No users found
          </div>
        )}
      </div>
    </div>
  )
}
