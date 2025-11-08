import { useEffect, useState } from 'react'
import type { Label, List, Workflow } from '../db/schema'
import { Labels, Workflows } from '../db/dexieClient'

interface Props {
  initial?: List | null
  onSave: (data: Omit<List, 'id'>, id?: string) => void
  onCancel: () => void
}

export default function ListEditor({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [labelIds, setLabelIds] = useState<string[]>(initial?.labelIds ?? [])
  const [workflowId, setWorkflowId] = useState<string | undefined>(initial?.workflowId)
  const [visibility, setVisibility] = useState<'public' | 'private'>(initial?.visibility ?? 'private')
  const [labels, setLabels] = useState<Label[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])

  useEffect(() => {
    ;(async () => {
      const [ls, ws] = await Promise.all([Labels.list(), Workflows.list()])
      setLabels(ls)
      setWorkflows(ws)
    })()
  }, [])

  const toggleLabel = (id: string) => {
    setLabelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="card">
      <div className="mb-2">
        <label className="mb-1 block text-xs text-gray-600">List name</label>
        <input className="input" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
      </div>
      <div className="mb-2">
        <label className="mb-1 block text-xs text-gray-600">Description</label>
        <input
          className="input"
          value={description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
        />
      </div>
      <div className="mb-2">
        <label className="mb-1 block text-xs text-gray-600">Default labels</label>
        <div className="flex flex-wrap gap-2">
          {labels.map((l) => (
            <button
              key={l.id}
              className={`chip border-gray-200 ${labelIds.includes(l.id) ? 'ring-1 ring-accent/40' : ''}`}
              style={{ borderColor: l.color }}
              onClick={() => toggleLabel(l.id)}
            >
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-600">Workflow (optional)</label>
        <select className="input" value={workflowId ?? ''} onChange={(e) => setWorkflowId(e.target.value || undefined)}>
          <option value="">None</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-600">Visibility</label>
        <select className="input" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn border-accent text-accent"
          onClick={() => onSave({ name: name.trim(), description: description.trim() || undefined, labelIds, workflowId, visibility })}
          disabled={!name.trim()}
        >
          Save
        </button>
      </div>
    </div>
  )
}
