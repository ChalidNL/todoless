import { useEffect, useState } from 'react'
import { Attributes } from '../db/dexieClient'
import type { AttributeDef } from '../db/schema'

export default function AttributesManager() {
  const [attributes, setAttributes] = useState<AttributeDef[]>([])
  const [editing, setEditing] = useState<AttributeDef | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'text' | 'number' | 'select' | 'date'>('text')
  const [defaultValue, setDefaultValue] = useState('')

  const reload = async () => {
    setAttributes(await Attributes.list())
  }

  useEffect(() => {
    reload()
  }, [])

  const handleSave = async () => {
    const data: Omit<AttributeDef, 'id'> = {
      name: name.trim(),
      type,
      defaultValue: defaultValue || undefined,
    }
    if (editing) {
      await Attributes.update(editing.id, data)
      setEditing(null)
    } else {
      await Attributes.add(data)
      setShowNew(false)
    }
    setName('')
    setType('text')
    setDefaultValue('')
    await reload()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Custom Attributes</h3>
        <button className="btn border-accent text-accent text-xs" onClick={() => setShowNew((v) => !v)}>
          + New Attribute
        </button>
      </div>
      {showNew && (
        <div className="card">
          <div className="mb-2 text-xs font-medium">New Attribute</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-600">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Priority" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Type</label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="select">Select</option>
                <option value="date">Date</option>
              </select>
            </div>
          </div>
          <div className="mt-2">
            <label className="mb-1 block text-xs text-gray-600">Default Value (optional)</label>
            <input className="input" value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn" onClick={() => setShowNew(false)}>
              Cancel
            </button>
            <button className="btn border-accent text-accent" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      )}
      {attributes.length === 0 ? (
        <p className="text-sm text-gray-500">No custom attributes yet. Create one to get started!</p>
      ) : (
        <div className="space-y-2">
          {attributes.map((a) => (
            <div key={a.id} className="card flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{a.name}</div>
                <div className="text-xs text-gray-500">
                  Type: {a.type} {a.defaultValue && `• Default: ${a.defaultValue}`}
                </div>
              </div>
              <button
                className="btn text-xs text-red-600"
                onClick={async () => {
                  if (confirm(`Delete attribute "${a.name}"?`)) {
                    await Attributes.remove(a.id)
                    await reload()
                  }
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
