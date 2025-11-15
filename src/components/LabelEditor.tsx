import { useEffect, useState } from 'react'
import type { Label, Workflow } from '../db/schema'
import { Workflows } from '../db/dexieClient'
import PrivacyToggle from './ui/PrivacyToggle'
import { useAuth } from '../store/auth'

interface Props {
  initial?: Label | null
  onSave: (data: Omit<Label, 'id'>, id?: string) => Promise<void> | void
  onCancel?: () => void
}

export default function LabelEditor({ initial, onSave, onCancel }: Props) {
  const { user } = useAuth()
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? '#0ea5e9')
  const [shared, setShared] = useState(initial?.shared ?? true)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [defaultWorkflowId, setDefaultWorkflowId] = useState<string | undefined>(initial?.workflowId)

  useEffect(() => {
    setName(initial?.name ?? '')
    setColor(initial?.color ?? '#0ea5e9')
    setShared(initial?.shared ?? true)
    setDefaultWorkflowId(initial?.workflowId)
  }, [initial])

  useEffect(() => {
    ;(async () => {
      setWorkflows(await Workflows.list())
    })()
  }, [])

  return (
    <div className="card">
      <div className="mb-2 text-sm font-medium">{initial ? 'Edit label' : 'New label'}</div>
      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Name</label>
          <input
            className="input"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            placeholder="Label name"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Color</label>
          <input
            className="input"
            type="color"
            value={color}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
          />
        </div>
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-600">Privacy</label>
        <PrivacyToggle
          shared={shared}
          onChange={(newShared) => setShared(newShared)}
          ownerId={initial?.ownerId}
          currentUserId={user?.id?.toString()}
          showLabel={true}
          size="sm"
        />
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-600">Default Workflow (optional)</label>
        <select
          className="input"
          value={defaultWorkflowId ?? ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const v = e.target.value
            setDefaultWorkflowId(v ? v : undefined)
          }}
        >
          <option value="">None</option>
          {workflows.map((wf) => (
            <option key={wf.id} value={wf.id}>
              {wf.name} {wf.checkboxOnly ? '(simple)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          className="btn border-accent text-accent"
          onClick={async () => {
            if (!name.trim()) return
            await onSave({ name: name.trim(), color, shared, workflowId: defaultWorkflowId }, initial?.id)
            if (!initial) {
              setName('')
            }
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
