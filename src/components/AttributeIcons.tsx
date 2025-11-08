import type { AttributeDef, Todo } from '../db/schema'

type Props = {
  todo: Todo
  defs: AttributeDef[]
  onEdit?: (def: AttributeDef) => void
  compactValue?: boolean // show short value next to icon
}

function shortVal(v: any) {
  if (v == null) return ''
  const s = String(v)
  return s.length > 6 ? s.slice(0, 6) + '…' : s
}

export default function AttributeIcons({ todo, defs, onEdit, compactValue = true }: Props) {
  const attrs = (todo.attributes || {}) as Record<string, any>
  const activeDefs = defs.filter((d) => attrs[d.id] != null && attrs[d.id] !== '')

  if (activeDefs.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1">
      {activeDefs.map((def) => {
        const value = attrs[def.id]
        // If this is a select with options, use the option icon if available
        let icon = def.icon || '🔖'
        if (def.type === 'select' && def.options && value != null) {
          const opt = def.options.find((o) => o.value === value)
          if (opt?.icon) icon = opt.icon
        }
        // Compute compact text value (prefer select label when available)
        let textVal: string | null = null
        if (compactValue && value != null && value !== '') {
          if (def.type === 'select' && def.options) {
            const opt = def.options.find((o) => o.value === value)
            textVal = (opt?.label || String(value))
          } else {
            textVal = String(value)
          }
          if (textVal.length > 8) textVal = textVal.slice(0, 8) + '…'
        }
        return (
          <button
            key={def.id}
            className="chip border-gray-300 text-[10px] px-1 py-0.5"
            title={`${def.name}${value ? `: ${textVal ?? value}` : ''}`}
            onClick={() => onEdit?.(def)}
          >
            <span className="mr-1">{icon}</span>
            {textVal && (
              <span className="text-gray-600">{textVal}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
