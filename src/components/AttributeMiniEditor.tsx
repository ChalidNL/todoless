import { useState } from 'react'
import type { AttributeDef, Todo } from '../db/schema'
import { mutateTodo } from '../db/dexieClient'
import CloseButton from './ui/CloseButton'

type Props = {
  todo: Todo
  def: AttributeDef
  onClose: () => void
  onChanged?: (nextAttrs: Record<string, any>) => void | Promise<void>
}

export default function AttributeMiniEditor({ todo, def, onClose, onChanged }: Props) {
  const current = (todo.attributes || {})[def.id] ?? ''
  const [val, setVal] = useState<any>(current)

  const save = async (next: any) => {
    const nextAttrs = { ...(todo.attributes || {}) }
    if (next === '' || next == null) delete nextAttrs[def.id]
    else nextAttrs[def.id] = next

    await mutateTodo(todo.id, { attributes: nextAttrs })
    await onChanged?.(nextAttrs)
    onClose()
  }

  return (
    <div>
      <div className="mb-0.5 text-[10px] text-gray-500">
        {def.icon || '🔖'} {def.name}
      </div>

      {def.type === 'text' && (
        <div className="flex items-center gap-1">
          <input
            className="input text-xs py-0.5"
            placeholder="Value"
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save(val)
            }}
          />
          <button className="btn text-[10px] px-1 py-0.5" onClick={() => save(val)}>💾</button>
          <button className="btn text-[10px] px-1 py-0.5" onClick={() => save('')}>🗑️</button>
          <CloseButton onClick={onClose} className="!w-6 !h-6" />
        </div>
      )}

      {def.type === 'select' && (
        <div className="flex items-center gap-1">
          <select className="input text-xs py-0.5" value={val} onChange={(e) => save(e.target.value)}>
            <option value="">—</option>
            {(def.options && def.options.length > 0
              ? def.options
              : [
                  { value: 'low', label: 'low' },
                  { value: 'medium', label: 'medium' },
                  { value: 'high', label: 'high' },
                ]
            ).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.icon ? `${opt.icon} ` : ''}{opt.label || opt.value}
              </option>
            ))}
          </select>
          <button className="btn text-[10px] px-1 py-0.5" onClick={() => save('')}>🗑️</button>
          <CloseButton onClick={onClose} className="!w-6 !h-6" />
        </div>
      )}

      {def.type === 'number' && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="input text-xs py-0.5"
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' ? save(val) : undefined}
          />
          <button className="btn text-[10px] px-1 py-0.5" onClick={() => save(val)}>💾</button>
          <button className="btn text-[10px] px-1 py-0.5" onClick={() => save('')}>🗑️</button>
          <CloseButton onClick={onClose} className="!w-6 !h-6" />
        </div>
      )}

      {def.type === 'date' && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            className="input text-xs py-0.5"
            autoFocus
            value={val}
            onChange={(e) => save(e.target.value)}
          />
          <button className="btn text-[10px] px-1 py-0.5" onClick={() => save('')}>🗑️</button>
          <CloseButton onClick={onClose} className="!w-6 !h-6" />
        </div>
      )}
    </div>
  )
}
