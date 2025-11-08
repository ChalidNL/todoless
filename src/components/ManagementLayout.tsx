import { ReactNode, useState } from 'react'

interface Props {
  title: string
  children: ReactNode
  searchQuery: string
  onSearchChange: (query: string) => void
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSortChange: (key: string, order: 'asc' | 'desc') => void
  viewMode: 'list' | 'board'
  onViewModeChange: (mode: 'list' | 'board') => void
  sortOptions: Array<{ key: string; label: string }>
  actionButton?: ReactNode
  activeFilters?: ReactNode
  compactHeader?: boolean
}

export default function ManagementLayout({
  title,
  children,
  searchQuery,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortChange,
  viewMode,
  onViewModeChange,
  sortOptions,
  actionButton,
  activeFilters,
  compactHeader = false
}: Props) {
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)

  return (
    <div className="manage-page h-full overflow-auto bg-gray-50">
      {/* Header */}
      <div className="mb-4">
        <div className="manage-header">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {actionButton}
        </div>

        {/* Local controls hidden when compactHeader is true */}
        {!compactHeader && (
  <div className="mb-3 flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search..."
              className="input w-full"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              className="btn flex items-center gap-2"
              onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
              title="Sort options"
            >
              <span className="text-lg">⇅</span>
              <span className="text-sm">Sort</span>
            </button>
            {sortDropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg">
                {sortOptions.map((opt) => (
                  <div key={opt.key}>
                    <button
                      className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                        sortBy === opt.key ? 'bg-accent/10 text-accent' : 'text-gray-700'
                      }`}
                      onClick={() => {
                        onSortChange(opt.key, 'asc')
                        setSortDropdownOpen(false)
                      }}
                    >
                      <span>{opt.label} (A–Z)</span>
                      {sortBy === opt.key && sortOrder === 'asc' && <span>✓</span>}
                    </button>
                    <button
                      className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                        sortBy === opt.key && sortOrder === 'desc' ? 'bg-accent/10 text-accent' : 'text-gray-700'
                      }`}
                      onClick={() => {
                        onSortChange(opt.key, 'desc')
                        setSortDropdownOpen(false)
                      }}
                    >
                      <span>{opt.label} (Z–A)</span>
                      {sortBy === opt.key && sortOrder === 'desc' && <span>✓</span>}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex rounded-md border border-gray-300 bg-white">
            <button
              className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              onClick={() => onViewModeChange('list')}
              title="List view"
            >
              ☰
            </button>
            <button
              className={`px-3 py-2 text-sm ${viewMode === 'board' ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              onClick={() => onViewModeChange('board')}
              title="Board view"
            >
              ▦
            </button>
          </div>
        </div>
        )}

        {/* Active Filters Chips */}
        {activeFilters && <div className="mb-3">{activeFilters}</div>}
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  )
}
