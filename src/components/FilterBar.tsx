import clsx from 'clsx'
import type { Label } from '../db/schema'

interface Props {
  labels: Label[]
  selected: string[]
  onToggle: (id: string) => void
  onClear: () => void
}

export default function FilterBar({ labels, selected, onToggle, onClear }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-600">Filters:</span>
      {labels.map((l) => (
        <button
          key={l.id}
          onClick={() => onToggle(l.id)}
          className={clsx('chip', selected.includes(l.id) ? 'border-accent bg-accent/10 text-accent' : 'bg-white')}
        >
          <span className="mr-1 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} />
          {l.name}
        </button>
      ))}
      {selected.length > 0 && (
        <button onClick={onClear} className="chip border-gray-300 bg-white text-gray-600">Clear</button>
      )}
    </div>
  )
}
