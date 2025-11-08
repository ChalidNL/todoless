import { ReactNode, useState } from 'react'

export interface Column<T> {
  key: string
  label: string
  render: (item: T) => ReactNode
  sortable?: boolean
  width?: string
}

interface Props<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T) => string
  onRowClick?: (item: T) => void
  emptyMessage?: string
  searchQuery?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSortChange?: (key: string) => void
}

export default function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No items found',
  searchQuery = '',
  sortBy = '',
  sortOrder = 'asc',
  onSortChange
}: Props<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-6 py-3 ${col.width || ''} ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                onClick={() => col.sortable && onSortChange?.(col.key)}
              >
                <div className="flex items-center gap-2">
                  {col.label}
                  {col.sortable && sortBy === col.key && (
                    <span className="text-accent">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4 text-sm text-gray-900">
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
