import { useState, useEffect, useRef } from 'react'
import type { User } from '../db/schema'
import clsx from 'clsx'

interface Props {
  users: User[]
  assignedIds: string[]
  onAssign: (userId: string) => Promise<void>
  onUnassign: (userId: string) => Promise<void>
  onClearAll: () => Promise<void>
  onClose: () => void
  isShared?: boolean
}

export default function AssigneeSelector({
  users,
  assignedIds,
  onAssign,
  onUnassign,
  onClearAll,
  onClose,
  isShared = true,
}: Props) {
  const [searchInput, setSearchInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debug: log users
  useEffect(() => {
    console.log('[AssigneeSelector] users:', users.length, users)
    console.log('[AssigneeSelector] assignedIds:', assignedIds)
  }, [users, assignedIds])

  // Filter users based on search - only show when @ is typed
  const showUsers = searchInput.startsWith('@')
  const filteredUsers = users.filter((u) => {
    if (!showUsers) return false
    const query = searchInput.slice(1).toLowerCase() // Remove @ from query
    if (!query) return true // Show all users when just "@" is typed
    return u.name?.toLowerCase().includes(query)
  })

  const handleToggleUser = async (userId: string) => {
    const isAssigned = assignedIds.includes(userId)
    if (isAssigned) {
      await onUnassign(userId)
    } else {
      await onAssign(userId)
    }
  }


  return (
    <div className="mt-2 w-full max-w-full rounded-md border bg-white p-2.5 shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-700">Assign Users</div>
        <div className="flex items-center gap-1">
          {assignedIds.length > 0 && (
            <button
              className={clsx(
                "p-1 w-6 h-6 flex items-center justify-center rounded border transition-all",
                "border-gray-200 text-gray-600 bg-white hover:bg-red-50 hover:border-red-400 hover:text-red-600"
              )}
              title="Clear all assignees"
              onClick={onClearAll}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button
            className="p-1 w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-green-600 bg-white hover:bg-green-50 hover:border-green-400 transition-all"
            title="Done"
            onClick={onClose}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-2">
        <input
          ref={inputRef}
          className="input text-xs py-1.5 px-2 w-full"
          placeholder="Type @ to search users..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {/* User List - Only shown when @ is typed */}
      {showUsers && (
        <div className="max-h-56 overflow-y-auto border-t pt-1">
          <div className="space-y-0.5">
            {filteredUsers.map((u) => {
              const isAssigned = assignedIds.includes(u.id)
              const initials = (u.name?.[0] || 'U').toUpperCase()

              return (
                <button
                  key={u.id}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-all",
                    isAssigned
                      ? "bg-blue-50 hover:bg-blue-100 border border-blue-200"
                      : "hover:bg-gray-50 border border-transparent"
                  )}
                  onClick={() => handleToggleUser(u.id)}
                  onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                >
                  {/* Avatar */}
                  <div
                    className={clsx(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0",
                      isAssigned ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"
                    )}
                  >
                    {initials}
                  </div>

                  {/* Username */}
                  <span className={clsx(
                    "flex-1 truncate",
                    isAssigned ? "font-medium text-blue-900" : "text-gray-700"
                  )}>
                    {u.name || 'User'}
                  </span>

                  {/* Checkmark for selected */}
                  {isAssigned && (
                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )
            })}
            {filteredUsers.length === 0 && (
              <div className="text-xs text-gray-500 italic py-2 px-2">No users found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
