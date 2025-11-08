import { useMemo, useState } from 'react'
import type { AttributeDef, Todo } from '../db/schema'
import { Attributes } from '../db/dexieClient'
import AttributeMiniEditor from './AttributeMiniEditor'
import CloseButton from './ui/CloseButton'

interface Props {
  todo: Todo
  defs: AttributeDef[]
  active: Record<string, any>
  onClose: () => void
  onChanged?: (next: Record<string, any>) => void | Promise<void>
  onCreatedDef?: (def: AttributeDef) => void | Promise<void>
}

export default function AttributeManager({ todo, defs, active, onClose, onChanged, onCreatedDef }: Props) {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<AttributeDef | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createType, setCreateType] = useState<AttributeDef['type']>('text')
  const [createOptions, setCreateOptions] = useState('low|medium|high')

  const cleaned = q.trim().replace(/^%/, '')
  const available = useMemo(
    () => defs.filter((d) => active[d.id] == null && d.name.toLowerCase().includes(cleaned.toLowerCase())),
    [defs, active, cleaned]
  )

  const choose = (def: AttributeDef) => {
    setEditing(def)
  }

  const confirm = async () => {
    const raw = cleaned
    if (!raw) return
    // find existing def by name (case-insensitive)
    const found = defs.find((d) => d.name.toLowerCase() === raw.toLowerCase())
    if (found) {
      // If already active: open editor to change its value; if not active: open editor to set it
      choose(found)
      return
    }
    // if creation panel not open yet, open it first to let user pick type/options
    if (!createOpen) {
      setCreateOpen(true)
      return
    }
    // create new attribute def with chosen type (and options when select)
    let created: AttributeDef
    if (createType === 'select') {
      const parts = createOptions
        .split(/[|,]/)
        .map((s) => s.trim())
        .filter(Boolean)
      const options = parts.map((p) => ({ value: p, label: p }))
      const id = await Attributes.add({ name: raw, type: 'select', options })
      created = { id, name: raw, type: 'select', options }
    } else {
      const id = await Attributes.add({ name: raw, type: createType })
      created = { id, name: raw, type: createType }
    }
    await onCreatedDef?.(created)
    choose(created)
  }

  return (
    <div className="mt-2 w-full max-w-full rounded-md border bg-white p-3 shadow-card overflow-hidden">
      <div className="mb-2 text-xs text-gray-600">Manage attributes (type to search, Enter to add) — use % as shortcut</div>
      {!editing && (
        <div className="flex items-center gap-2 w-full">
          <input
            className="input text-xs py-1 w-full flex-1"
            placeholder="%priority, estimate, dueDate"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                if (available.length > 0) choose(available[0])
                else confirm()
              }
            }}
          />
          <CloseButton onClick={onClose} />
        </div>
      )}

      {!editing && cleaned && (
        <div className="mt-2 max-h-40 overflow-y-auto border-t pt-2 w-full">
          <div className="mb-1 text-xs text-gray-500">Suggestions</div>
          {available.slice(0, 8).map((d) => (
            <button
              key={d.id}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-50"
              onClick={() => choose(d)}
            >
              <span className="mr-1">{d.icon || '🔖'}</span>
              {d.name}
            </button>
          ))}
          {available.length === 0 && (
            <div className="px-2 py-1 text-xs text-gray-500">
              <div className="italic mb-1">Press Enter to create "{cleaned}"</div>
              {createOpen && (
                <div className="mt-1 rounded border bg-white p-2">
                  <div className="mb-1 text-xs text-gray-600">Create as</div>
                  <div className="inline-flex items-center rounded-md border bg-white p-0.5 text-xs">
                    {(['text','number','date','select'] as AttributeDef['type'][]).map((t) => (
                      <button
                        key={t}
                        className={`px-2 py-1 rounded ${createType === t ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`}
                        onClick={() => setCreateType(t)}
                        type="button"
                        title={t}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {createType === 'select' && (
                    <div className="mt-2 flex items-center gap-2 w-full">
                      <input
                        className="input text-xs py-1 w-full flex-1"
                        value={createOptions}
                        onChange={(e) => setCreateOptions(e.target.value)}
                        placeholder="low|medium|high"
                        title="Options (use | or , to separate)"
                      />
                      <button className="btn text-xs py-1 px-2" onClick={confirm}>Create</button>
                    </div>
                  )}
                  {createType !== 'select' && (
                    <div className="mt-2">
                      <button className="btn text-xs py-1 px-2" onClick={confirm}>Create</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="mt-1">
          <AttributeMiniEditor
            todo={todo}
            def={editing}
            onClose={() => {
              setEditing(null)
              setQ('')
            }}
            onChanged={async (next) => {
              await onChanged?.(next)
              setEditing(null)
              setQ('')
            }}
          />
        </div>
      )}
    </div>
  )
}
