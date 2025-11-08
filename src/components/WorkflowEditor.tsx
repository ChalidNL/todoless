import { useEffect, useState } from 'react'
import type { Workflow, Label } from '../db/schema'
import { Labels } from '../db/dexieClient'

interface Props {
  initial?: Workflow | null
  onSave: (data: Omit<Workflow, 'id'>, id?: string) => Promise<void> | void
  onCancel?: () => void
}

export default function WorkflowEditor({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [stages, setStages] = useState<string[]>(initial?.stages ?? ['To Do', 'In Progress', 'Done'])
  const [stageInput, setStageInput] = useState('')
  const [labels, setLabels] = useState<Label[]>([])
  const [labelIds, setLabelIds] = useState<string[]>(initial?.labelIds ?? [])
  const [checkboxOnly, setCheckboxOnly] = useState<boolean>(initial?.checkboxOnly ?? false)
  const [hideBacklog, setHideBacklog] = useState<boolean>(initial?.hideBacklog ?? false)

  useEffect(() => {
    setName(initial?.name ?? '')
    setStages(initial?.stages ?? ['To Do', 'In Progress', 'Done'])
    setLabelIds(initial?.labelIds ?? [])
    setCheckboxOnly(initial?.checkboxOnly ?? false)
    setHideBacklog(initial?.hideBacklog ?? false)
  }, [initial])

  useEffect(() => {
    ;(async () => {
      setLabels(await Labels.list())
    })()
  }, [])

  const addStage = () => {
    if (stageInput.trim() && !stages.includes(stageInput.trim())) {
      setStages([...stages, stageInput.trim()])
      setStageInput('')
    }
  }

  const removeStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index))
  }

  const hasBacklogStage = stages.some(s => s.toLowerCase() === 'backlog')

  return (
    <div className="card">
      <div className="mb-2 text-sm font-medium">
        {initial ? 'Edit Workflow' : 'New Workflow'}
        {initial?.isDefault && <span className="ml-2 text-yellow-500">⭐</span>}
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-600">Workflow Name</label>
        <input
          className="input"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          placeholder="e.g., Shopping Process"
          disabled={initial?.isDefault}
        />
      </div>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={checkboxOnly}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const checked = e.target.checked
            setCheckboxOnly(checked)
            if (checked) {
              // For checkbox-only, constrain stages to a single terminal stage
              setStages(['Done'])
            } else if (stages.length === 1) {
              // Restore a sensible default if we only had the single stage
              setStages(['To Do', 'In Progress', 'Done'])
            }
          }}
        />
        Simple workflow (single "Done" stage)
      </label>
      {hasBacklogStage && !checkboxOnly && (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hideBacklog}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHideBacklog(e.target.checked)}
          />
          Hide Backlog column in Kanban view
        </label>
      )}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-600">Linked Labels (optional)</label>
        <div className="flex flex-wrap gap-2">
          {labels.map((l) => (
            <button
              key={l.id}
              className={`chip border-gray-200 ${labelIds.includes(l.id) ? 'ring-1 ring-accent/40' : ''}`}
              style={{ borderColor: l.color }}
              onClick={() => setLabelIds((prev) => (prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id]))}
            >
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-600">Stages (in order)</label>
        <div className="mb-2 flex flex-wrap gap-2">
          {stages.map((stage, idx) => (
            <div key={idx} className="chip border-accent bg-accent/10 text-accent">
              {stage}
              <button className="ml-1 text-xs" onClick={() => removeStage(idx)} disabled={checkboxOnly || initial?.isDefault}>
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={stageInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStageInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addStage()
              }
            }}
            placeholder="Add stage and press Enter"
            disabled={checkboxOnly || initial?.isDefault}
          />
          <button className="btn border-accent text-accent" onClick={addStage} disabled={checkboxOnly || initial?.isDefault}>
            Add
          </button>
        </div>
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
            if (!name.trim() || stages.length === 0) return
            await onSave({ name: name.trim(), stages, basedOn: 'label', labelIds, checkboxOnly, hideBacklog, isDefault: initial?.isDefault }, initial?.id)
            if (!initial) {
              setName('')
              setStages(['To Do', 'In Progress', 'Done'])
              setLabelIds([])
              setCheckboxOnly(false)
              setHideBacklog(false)
            }
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
