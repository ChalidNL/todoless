import { useEffect, useState } from 'react'
import { Workflows } from '../db/dexieClient'

type ViewValue = 'list' | 'tiles' | 'calendar' | 'kanban'

interface Props {
  value: ViewValue
  onChange: (v: ViewValue) => void
}

export default function ViewModeControl({ value, onChange }: Props) {
  const [hasEligibleKanban, setHasEligibleKanban] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
  const ws = await Workflows.list()
  const eligible = ws.some((w) => Array.isArray(w.stages) && w.stages.length >= 3 && w.checkboxOnly !== true)
  if (active) setHasEligibleKanban(eligible)
      } catch {
        if (active) setHasEligibleKanban(false)
      }
    })()
    return () => { active = false }
  }, [])
  return (
    <div className="inline-flex items-center rounded-md border bg-white p-0.5 text-xs">
      <button
        className={`px-2 py-1 rounded ${value === 'list' ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`}
        onClick={() => onChange('list')}
        title="List view"
      >
        <svg className="icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <button
        className={`px-2 py-1 rounded ${value === 'tiles' ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`}
        onClick={() => onChange('tiles')}
        title="Tiles view"
      >
        <svg className="icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      </button>
      <button
        className={`px-2 py-1 rounded ${value === 'calendar' ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`}
        onClick={() => onChange('calendar')}
        title="Calendar view"
      >
        <svg className="icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      <button
        className={`px-2 py-1 rounded ${value === 'kanban' ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'} ${hasEligibleKanban ? '' : 'opacity-60'}`}
        onClick={() => onChange('kanban')}
        title="Workflow Kanban"
      >
        <svg className="icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h5v10H3zM10 7h4v10h-4zM16 7h5v10h-5z" />
        </svg>
      </button>
    </div>
  )
}
