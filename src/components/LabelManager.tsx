import { useState, useEffect } from 'react'
import type { Label, Todo } from '../db/schema'
import { Labels, mutateTodo, Workflows, db } from '../db/dexieClient'
import CloseButton from './ui/CloseButton'

interface Props {
  todo: Todo
  labels: Label[]
  onClose: () => void
  onLabelsChange?: () => void | Promise<void>
  onLocalAddLabel?: (label: Label) => void
}

export default function LabelManager({ todo, labels, onClose, onLabelsChange, onLocalAddLabel }: Props) {
  const [labelInput, setLabelInput] = useState('')
  const [localLabels, setLocalLabels] = useState<Label[]>(labels)

  // Sync local labels when prop changes
  useEffect(() => {
    setLocalLabels(labels)
  }, [labels])

  function pastel() {
    const hue = Math.floor(Math.random() * 360)
    const s = 70
    const l = 75
    return hslToHex(hue, s, l)
  }
  
  function hslToHex(h: number, s: number, l: number) {
    s /= 100
    l /= 100
    const k = (n: number) => (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0')
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
  }

  const handleAddLabel = async () => {
    const raw = labelInput.trim().replace(/^#/, '')
    if (!raw) return
    const exists = localLabels.find((l) => l.name.toLowerCase() === raw.toLowerCase())
    let newId = exists?.id
    let newLabel: Label | undefined
    if (!exists) {
      // Check globally to prevent duplicates across all labels
      const allLabels = await Labels.list()
      const duplicate = allLabels.find((l) => l.name.toLowerCase() === raw.toLowerCase())
      if (duplicate) {
        alert(`Label "${duplicate.name}" already exists!`)
        setLabelInput('')
        return
      }
      // create new label
      const color = pastel()
      const id = await Labels.add({ name: raw, color, shared: true })
      newId = id
      newLabel = { id, name: raw, color, shared: true }
      // Update local labels immediately so suggestions show the new label
      setLocalLabels((prev) => [...prev, newLabel!])
    }
    if (newId) {
      // fetch latest todo to avoid duplicates from stale props
      const currentTodo = await db.todos.get(todo.id)
      const currentLabels: string[] = (currentTodo && Array.isArray((currentTodo as any).labelIds) ? (currentTodo as any).labelIds : todo.labelIds) || []
      if (!currentLabels.includes(newId)) {
        const next = [...currentLabels, newId]
        let patch: Partial<Todo> = { labelIds: next }
        if (!todo.workflowId) {
          const workflows = await Workflows.list()
          let workflowId: string | undefined
          let workflowStage: string | undefined
          const labelDirect = localLabels.find((x) => x.id === newId && x.workflowId)
          if (labelDirect?.workflowId) {
            workflowId = labelDirect.workflowId
          } else {
            const linked = workflows.find((w) => w.labelIds && w.labelIds.includes(newId!))
            if (linked) workflowId = linked.id
          }
          if (workflowId) {
            const wf = workflows.find((w) => w.id === workflowId)
            if (wf && wf.stages && wf.stages.length > 0) workflowStage = wf.stages[0]
            patch = { ...patch, workflowId, workflowStage }
          }
        }
        await mutateTodo(todo.id, patch)
        // Optimistically update chips in parent with full label data
        if (onLocalAddLabel) onLocalAddLabel(newLabel || (exists as Label))
        // Always notify parent so it can refresh labels collection and wait for completion
        if (onLabelsChange) await onLabelsChange()
      } else {
        // Label already on todo but we still need to notify parent in case label was newly created
        if (onLabelsChange) await onLabelsChange()
      }
    }
    setLabelInput('')
  }

  const handleSuggestionClick = async (l: Label) => {
    // avoid duplicates by reading latest todo
    const currentTodo = await db.todos.get(todo.id)
    const currentLabels: string[] = (currentTodo && Array.isArray((currentTodo as any).labelIds) ? (currentTodo as any).labelIds : todo.labelIds) || []
    if (!currentLabels.includes(l.id)) {
      const next = [...currentLabels, l.id]
      await mutateTodo(todo.id, { labelIds: next })
      if (onLocalAddLabel) onLocalAddLabel(l)
      if (onLabelsChange) await onLabelsChange()
    }
    setLabelInput('')
  }

  const handleRemoveLabel = async (id: string) => {
    const next = todo.labelIds.filter((x) => x !== id)
    await mutateTodo(todo.id, { labelIds: next })
    if (onLabelsChange) await onLabelsChange()
  }

  return (
    <div className="mt-2 w-full max-w-full rounded-md border bg-white p-3 shadow-card overflow-hidden">
      <div className="mb-2 text-xs text-gray-600">Manage labels (type to search, Enter to add)</div>
      <div className="flex items-center gap-2 w-full">
        <input
          className="input text-xs py-1 w-full flex-1"
          placeholder="#work, personal"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              await handleAddLabel()
            }
          }}
        />
        <CloseButton onClick={onClose} />
      </div>
      {/* Input autocomplete suggestions - shown while typing */}
      {labelInput.trim() && (
        <div className="mt-2 max-h-40 overflow-y-auto border-t pt-2 w-full">
          <div className="mb-1 text-xs text-gray-500">Suggestions</div>
          {localLabels
            .filter((l) => !todo.labelIds.includes(l.id))
            .filter((l) => l.name.toLowerCase().includes(labelInput.trim().replace(/^#/, '').toLowerCase()))
            .slice(0, 8)
            .map((l) => (
              <button
                key={l.id}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-50"
                onClick={() => handleSuggestionClick(l)}
              >
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} />
                {l.name}
              </button>
            ))}
          {!localLabels.some((l) => l.name.toLowerCase() === labelInput.trim().replace(/^#/, '').toLowerCase()) && (
            <div className="px-2 py-1 text-xs text-gray-500 italic">Press Enter to create "{labelInput.trim().replace(/^#/, '')}"</div>
          )}
        </div>
      )}
    </div>
  )
}
