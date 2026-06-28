import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function SearchBar({ value, onChange, onSubmit, placeholder = 'Search…', autoFocus, className = '' }: SearchBarProps) {
  const trimmed = value.trim();

  return (
    <form
      className={`app-search-card flex min-h-[var(--app-touch-target)] items-center gap-2 ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed && onSubmit) onSubmit(trimmed);
      }}
      role="search"
    >
      <Search className="h-5 w-5 flex-shrink-0 text-[var(--app-text-soft)]" strokeWidth={2.2} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (trimmed && onSubmit) onSubmit(trimmed);
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="min-h-[36px] flex-1 bg-transparent text-base font-semibold text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-soft)]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="grid h-9 w-9 place-items-center rounded-full text-[var(--app-text-muted)] transition active:scale-[0.97] hover:bg-[var(--app-surface-2)]"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
