interface Props {
  query: string
  onChange: (value: string) => void
  placeholder?: string
  variant?: 'card' | 'inline'
  onSubmit?: (value: string) => void
  isDuplicate?: boolean
}

export default function SearchBar({ query, onChange, placeholder = 'Search todos...', variant = 'card', onSubmit, isDuplicate = false }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('SearchBar submit with query:', query)
    if (query.trim()) {
      console.log('Calling onSubmit')
      onSubmit?.(query)
    } else {
      console.log('Query is empty, not calling onSubmit')
    }
  }

  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className={`flex items-center gap-2 flex-1 relative ${isDuplicate ? 'animate-shake' : ''}`}>
        {isDuplicate ? (
          <svg className="icon-standard text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ) : (
          <svg className="icon-standard text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
        <input
          type="text"
          className={`input w-full text-sm ${isDuplicate ? 'border-red-500 bg-red-50 text-red-900' : ''}`}
          placeholder={isDuplicate ? 'Duplicate task already exists!' : placeholder}
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
        {query && (
          <button type="button" className="btn text-xs px-2 py-1" onClick={() => onChange('')}>
            ✖
          </button>
        )}
        {isDuplicate && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-red-600 font-medium whitespace-nowrap">
            This task already exists
          </div>
        )}
      </form>
    )
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <svg className="icon-standard text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          className="input flex-1"
          placeholder={placeholder}
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
        {query && (
          <button type="button" className="btn text-sm" onClick={() => onChange('')}>
            ✖
          </button>
        )}
      </form>
    </div>
  )
}
