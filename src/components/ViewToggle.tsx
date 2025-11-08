import { useViewMode } from '../contexts/ViewModeContext'

export default function ViewToggle() {
  const { mode, setMode } = useViewMode()
  return (
    <div className="inline-flex items-center rounded-md border bg-white p-0.5">
      <button
        className={`px-2 py-1 rounded text-xs ${mode === 'list' ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`}
        onClick={() => setMode('list')}
        title="List view"
      >
        ☰
      </button>
      <button
        className={`px-2 py-1 rounded text-xs ${mode === 'tiles' ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`}
        onClick={() => setMode('tiles')}
        title="Tiles view"
      >
        ⊞
      </button>
    </div>
  )
}
