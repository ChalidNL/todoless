import { ReactNode, useState } from 'react'
import CreateButton from './ui/CreateButton'

interface ManagementHeaderProps {
  title: string
  onCreateClick?: () => void
  createTitle?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  extra?: ReactNode
  showCreate?: boolean
  showSearch?: boolean
  infoText?: string
  compact?: boolean // New: use compact search style (smaller, inline with title)
}

export default function ManagementHeader({
  title,
  onCreateClick,
  createTitle = 'Create',
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  extra,
  showCreate = true,
  showSearch = true,
  infoText,
  compact = false,
}: ManagementHeaderProps) {
  const [infoOpen, setInfoOpen] = useState(false)
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Title */}
        <h1 className="text-xl font-semibold">{title}</h1>
        {/* Info button */}
        {infoText && (
          <div className="relative">
            <button
              className="w-5 h-5 flex items-center justify-center rounded-full border border-gray-300 text-gray-700 text-xs hover:bg-gray-50"
              title="Info"
              onClick={() => setInfoOpen((v) => !v)}
            >
              ?
            </button>
            {infoOpen && (
              <div className="absolute z-20 mt-2 w-64 rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-card">
                {infoText}
              </div>
            )}
          </div>
        )}
        {/* Compact search inline with title */}
        {showSearch && onSearchChange && (
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="min-w-[160px] flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        )}
        {/* Square blue + button */}
        {showCreate && onCreateClick && (
          <button
            className="w-9 h-9 flex items-center justify-center rounded bg-accent text-white hover:opacity-90 transition-opacity flex-shrink-0"
            onClick={onCreateClick}
            title={createTitle}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>
      {extra && (
        <div className="mt-2">{extra}</div>
      )}
    </div>
  )
}
