import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { parseDueToDate } from '../utils/date'
import type { Label, Todo, User, AttributeDef } from '../db/schema'
import { Users, mutateTodo, db, Attributes, Todos, labelBus } from '../db/dexieClient'
import { useNavigate } from 'react-router-dom'
import { useFilterContext } from '../contexts/FilterContext'
import LabelManager from './LabelManager'
import AttributeIcons from './AttributeIcons'
import AttributeMiniEditor from './AttributeMiniEditor'
import AttributeManager from './AttributeManager'
import CloseButton from './ui/CloseButton'
import LinkNoteModal from './LinkNoteModal'
import clsx from 'clsx'

interface Props {
  todo: Todo
  labels: Label[]
  onToggle: (id: string, completed: boolean) => void
  onUpdate: (id: string, title: string) => void
  onDelete?: (id: string) => void
  onLabelsChange?: () => void | Promise<void>
}

export default function TodoCard({ todo, labels, onToggle, onUpdate, onDelete, onLabelsChange }: Props) {
  // Fix missing state initializations
  const [liveAttributes, setLiveAttributes] = useState<Record<string, any>>({ ...(todo.attributes || {}) })
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false)
  const [attributePickerOpen, setAttributePickerOpen] = useState(false)
  const [linkNoteOpen, setLinkNoteOpen] = useState(false)
  const [assigneeInput, setAssigneeInput] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>(todo.linkedNoteIds || [])
  const [attributeDefs, setAttributeDefs] = useState<AttributeDef[]>([])
  const [attributeEditorDef, setAttributeEditorDef] = useState<AttributeDef | null>(null)
  const [dateInput, setDateInput] = useState<string>(() => {
    const raw = (todo as any).dueDate || (todo as any).attributes?.dueDate || ''
    return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.substring(0, 10) : ''
  })
  const [timeInput, setTimeInput] = useState(todo.dueTime || '')
  const [repeatInput, setRepeatInput] = useState(todo.repeat || '')
  const [weeklyDays, setWeeklyDays] = useState<string[]>(() => {
    const days = (todo.attributes as any)?.repeatDays
    return Array.isArray(days) ? days : []
  })
  const navigate = useNavigate()
  const { setSelectedLabelIds, setSelectedAssigneeIds, clear } = useFilterContext()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(todo.title)
  const [hover, setHover] = useState(false)
  const [selected, setSelected] = useState(false)
  const [isCoarse, setIsCoarse] = useState(false)
  const [labelPickerOpen, setLabelPickerOpen] = useState(false)
  // Keep a live copy of labelIds so new labels appear instantly
  const [liveLabelIds, setLiveLabelIds] = useState<string[]>([...todo.labelIds])
  // Keep a live copy of blocked status for instant flag color
  const [liveBlocked, setLiveBlocked] = useState(todo.blocked || false)
  // Keep a live copy of labels list for instant updates when creating new labels
  const [liveLabels, setLiveLabels] = useState<Label[]>(labels)
  // Map labelIds to label objects for instant lookup
  const [localLabelsById, setLocalLabelsById] = useState<Record<string, Label>>(() => {
    const map: Record<string, Label> = {}
    labels.forEach(l => { map[l.id] = l })
    return map
  })
  // ...existing code...
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    Users.list().then(setUsers)
    Attributes.list().then(setAttributeDefs).catch(() => setAttributeDefs([]))
    try {
      const mq = window.matchMedia('(pointer: coarse)')
      setIsCoarse(mq.matches)
      const onChange = () => setIsCoarse(mq.matches)
      // @ts-ignore legacy support
      mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange)
      return () => {
        // @ts-ignore legacy support
        mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange)
      }
    } catch {}
  }, [])

  // Deduplicate users by id
  const uniqueUsers = useMemo(() => {
    const seen = new Set<string>()
    return users.filter(u => {
      if (seen.has(u.id)) return false
      seen.add(u.id)
      return true
    })
  }, [users])

  // Sync live labels if todo prop changes externally
  useEffect(() => {
    setLiveLabelIds([...todo.labelIds])
  }, [todo.labelIds])

  useEffect(() => {
    setLiveAttributes({ ...(todo.attributes || {}) })
  }, [todo.attributes])

  // Sync live blocked state
  useEffect(() => {
    setLiveBlocked(todo.blocked || false)
  }, [todo.blocked])

  // Sync live labels list and mapping when prop changes
  useEffect(() => {
    setLiveLabels(labels)
    const map: Record<string, Label> = {}
    labels.forEach(l => { map[l.id] = l })
    setLocalLabelsById(map)
  }, [labels])

  // Listen for label:added events to update liveLabels instantly
  useEffect(() => {
    const onLabelAdded = (e: Event) => {
      const added = (e as CustomEvent).detail as Label
      if (added) {
        setLiveLabels(prev => {
          if (prev.some(l => l.id === added.id)) return prev
          return [...prev, added]
        })
      }
    }
    labelBus.addEventListener('label:added', onLabelAdded)
    return () => labelBus.removeEventListener('label:added', onLabelAdded)
  }, [])

  const showActions = (hover || isCoarse || scheduleOpen || labelPickerOpen || assigneePickerOpen || attributePickerOpen) && !editing

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        'task-card relative p-4 min-h-[80px] border-2 rounded-xl transition-all duration-150',
        'flex flex-col gap-2',
        {
          'bg-red-50 border-red-300 ring-0': liveBlocked,
          'border-gray-200': !liveBlocked,
          'bg-gray-50': (hover || selected) && !liveBlocked,
        }
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!editing && (e.key === 'Delete' || e.key === 'Backspace') && onDelete) {
          if (confirm('Delete this todo?')) onDelete(todo.id)
        }
      }}
    >
      {/* Title row - checkbox and text on same line */}
        <div className="flex items-center gap-2 min-w-0 w-full">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            onToggle(todo.id, e.target.checked)
            setSelected(e.target.checked)
          }}
          className="task-checkbox accent-indigo-600 shrink-0"
        />
        {editing ? (
          <input
            autoFocus
            className="input flex-1"
            value={text}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
            onBlur={() => {
              setEditing(false)
              if (text.trim() && text.trim() !== todo.title) onUpdate(todo.id, text.trim())
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur()
              }
            }}
          />
        ) : (
          <button
            className={`flex-1 min-w-0 truncate text-left leading-5 text-sm ${todo.completed ? 'text-gray-400 line-through' : ''}`}
            onClick={() => setEditing(true)}
            title="Click to edit"
          >
            {todo.title}
          </button>
        )}
        
        {/* Options toggle button (three dots) */}
        <button
          className="ml-2 p-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-100 hover:text-gray-900 transition-all"
          onClick={() => setShowOptions(!showOptions)}
          title="Show options"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
      </div>

      {/* Action icons row - shown when options toggle is active with smooth animation */}
      {showOptions && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-full flex flex-wrap items-center justify-start gap-1.5 p-2 bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden"
        >
          {/* Schedule Icon - Yellow when active */}
          <button
            className={clsx(
              "p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border transition-all hover:scale-105",
              (todo.dueDate || (todo.attributes as any)?.dueDate || todo.dueTime || todo.repeat)
                ? "border-yellow-400 text-yellow-600 bg-yellow-50"
                : "border-gray-200 text-gray-800 bg-white hover:bg-gray-50"
            )}
            onClick={() => {
              setLabelPickerOpen(false)
              setAssigneePickerOpen(false)
              setAttributePickerOpen(false)
              setScheduleOpen((v) => !v)
            }}
            title="Schedule (date, time, repeat)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Labels Icon - Indigo when active */}
          <button
            className={clsx(
              "p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border transition-all hover:scale-105",
              liveLabelIds.length > 0
                ? "border-indigo-400 text-indigo-600 bg-indigo-50"
                : "border-gray-200 text-gray-800 bg-white hover:bg-gray-50"
            )}
            onClick={() => {
              setScheduleOpen(false)
              setAssigneePickerOpen(false)
              setAttributePickerOpen(false)
              setLabelPickerOpen((v) => !v)
            }}
            title="Manage labels"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </button>

          {/* Assignee Icon - Purple when active */}
          <button
            className={clsx(
              "p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border transition-all hover:scale-105",
              (todo.assigneeIds || []).length > 0
                ? "border-purple-400 text-purple-600 bg-purple-50"
                : "border-gray-200 text-gray-800 bg-white hover:bg-gray-50"
            )}
            onClick={() => {
              setScheduleOpen(false)
              setLabelPickerOpen(false)
              setAttributePickerOpen(false)
              setAssigneePickerOpen((v) => !v)
            }}
            title="Assign user"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>

          {/* Attributes Icon - Lime when active */}
          <button
            className={clsx(
              "p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border transition-all hover:scale-105",
              Object.keys(liveAttributes).length > 0
                ? "border-lime-400 text-lime-600 bg-lime-50"
                : "border-gray-200 text-gray-800 bg-white hover:bg-gray-50"
            )}
            onClick={() => {
              setScheduleOpen(false)
              setLabelPickerOpen(false)
              setAssigneePickerOpen(false)
              setAttributeEditorDef(null)
              setAttributePickerOpen((v) => !v)
            }}
            title="Attributes"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
          </button>

          {/* Link Note Icon - Teal when active */}
          <button
            className={clsx(
              "p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border transition-all hover:scale-105",
              linkedNoteIds.length > 0
                ? "border-teal-400 text-teal-600 bg-teal-50"
                : "border-gray-200 text-gray-800 bg-white hover:bg-gray-50"
            )}
            onClick={() => {
              setScheduleOpen(false)
              setLabelPickerOpen(false)
              setAssigneePickerOpen(false)
              setAttributePickerOpen(false)
              setLinkNoteOpen(true)
            }}
            title={linkedNoteIds.length > 0 ? `Linked to ${linkedNoteIds.length} note(s)` : 'Link to note'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>

          {/* Flag Icon - Red when blocked */}
          <button
            className={clsx(
              "p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border transition-all hover:scale-105",
              liveBlocked
                ? "border-red-400 text-red-600 bg-red-50"
                : "border-gray-200 text-gray-800 bg-white hover:bg-gray-50"
            )}
            onClick={async () => {
              const newBlocked = !liveBlocked
              setLiveBlocked(newBlocked) // Instant visual feedback
              await mutateTodo(todo.id, { blocked: newBlocked })
              if (onLabelsChange) await onLabelsChange()
            }}
            title={liveBlocked ? 'Unblock' : 'Block task'}
          >
            <svg className="w-4 h-4" fill={liveBlocked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </button>

          {/* Delete Icon - Gray with red hover */}
          <button
            className={clsx(
              "p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border transition-all hover:scale-105",
              "border-gray-200 text-gray-800 bg-white hover:bg-red-50 hover:border-red-400 hover:text-red-600"
            )}
            onClick={async () => {
              if (confirm('Delete this todo?')) {
                if (onDelete) {
                  onDelete(todo.id)
                } else {
                  await Todos.remove(todo.id)
                  window.dispatchEvent(new CustomEvent('todo:deleted', { detail: todo.id }))
                }
              }
            }}
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </motion.div>
      )}

      {/* Chips row (labels, assignees, due, attributes) placed above editors */}
      <div
        className="subitem flex flex-wrap items-center gap-1.5 w-full overflow-x-auto"
        style={{ WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}
      >
        {liveLabelIds.map((id) => {
          const l = localLabelsById[id] || liveLabels.find((x) => x.id === id)
          if (!l) return null
          return (
            <button
              key={id}
              className="chip border-gray-200 text-[11px] px-1.5 py-0.5 hover:bg-red-50 hover:border-red-300"
              style={{ borderColor: l.color }}
              title={labelPickerOpen ? `Remove ${l.name}` : `Filter by ${l.name}`}
              onClick={async () => {
                if (labelPickerOpen) {
                  const currentLabels = [...liveLabelIds]
                  const nextLabels = currentLabels.filter((x) => x !== id)
                  setLiveLabelIds(nextLabels)
                  await mutateTodo(todo.id, { labelIds: nextLabels })
                  if (onLabelsChange) await onLabelsChange()
                } else {
                  try { clear() } catch {}
                  setSelectedLabelIds([id])
                  navigate('/saved/all')
                }
              }}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name}
            </button>
          )
        })}
          {/* Priority chip */}
          {todo.priority && (
            <span
              className={clsx(
                'chip text-[11px] px-2 py-0.5 border font-semibold',
                todo.priority === 'high' ? 'border-red-400 text-red-600 bg-red-50' :
                todo.priority === 'medium' ? 'border-yellow-400 text-yellow-700 bg-yellow-50' :
                'border-gray-300 text-gray-600 bg-gray-50'
              )}
              title={`Priority: ${todo.priority}`}
            >
              {todo.priority === 'high' ? 'High' : todo.priority === 'medium' ? 'Medium' : 'Low'}
            </span>
          )}
        {(todo.assigneeIds || []).map((uid) => {
          const u = uniqueUsers.find((x) => x.id === uid)
          if (!u) return null
          const initials = (u.firstName?.[0] || '') + (u.lastName?.[0] || '') || u.name?.[0] || 'U'
          return (
            <button
              key={uid}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-accent bg-accent/10 text-accent text-[10px] font-semibold leading-none hover:bg-red-50 hover:text-red-600 align-middle"
              style={{ verticalAlign: 'middle' }}
              title={assigneePickerOpen ? `Remove ${u.name || 'user'}` : `Filter by ${u.name || 'user'}`}
              onClick={async () => {
                if (assigneePickerOpen) {
                  await mutateTodo(todo.id, { assigneeIds: [] })
                  if (onLabelsChange) await onLabelsChange()
                } else {
                  try { clear() } catch {}
                  setSelectedAssigneeIds([uid])
                  navigate('/saved/all')
                }
              }}
            >
              {initials.toUpperCase()}
            </button>
          )
        })}
        {(() => {
          const raw = (todo as any).dueDate || (todo as any).attributes?.dueDate
          const hasTime = !!todo.dueTime
          const hasRepeat = !!todo.repeat
          const hasAny = raw || hasTime || hasRepeat
          if (!hasAny) return null

          const d = raw ? parseDueToDate(raw) : null
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const overdue = !todo.completed && d && d < today
          const fmt = d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null

          const parts: string[] = []
          if (fmt) parts.push(fmt)
          if (hasTime) parts.push(todo.dueTime!)
          if (hasRepeat) {
            const days = (todo.attributes as any)?.repeatDays
            const suffix = Array.isArray(days) && days.length > 0 ? ` (${days.map((d: string) => d.slice(0,2)).join(' ')})` : ''
            parts.push(`↻ ${todo.repeat}${suffix}`)
          }

          return (
            <span
              className={`chip text-[11px] px-2 py-0.5 ${overdue ? 'border-red-400 text-red-600 bg-red-50' : 'border-gray-300 text-gray-600 bg-gray-50'}`}
              title={`Due ${d?.toDateString() || 'not set'}${hasTime ? ` at ${todo.dueTime}` : ''}${hasRepeat ? ` • repeats ${todo.repeat}` : ''}`}
            >
              ⏰ {parts.join(' · ')}
            </span>
          )
        })()}
        {attributeDefs.length > 0 && (
          <AttributeIcons
            todo={{ ...todo, attributes: liveAttributes }}
            defs={attributeDefs}
            compactValue={true}
            onEdit={async (def) => {
              if (attributePickerOpen) {
                const next = { ...liveAttributes }
                delete (next as any)[def.id]
                setLiveAttributes(next)
                await mutateTodo(todo.id, { attributes: next })
                if (onLabelsChange) await onLabelsChange()
              } else {
                setAttributeEditorDef(def)
                setAttributePickerOpen(true)
              }
            }}
          />
        )}
      </div>

      {scheduleOpen && (
        <div className="mt-2 w-full max-w-full rounded-md border bg-white p-3 shadow-card overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gray-700">Schedule</div>
            <div className="flex items-center gap-1">
              <button
                className={clsx(
                  "p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border transition-all hover:scale-105",
                  "border-gray-200 text-gray-800 bg-white hover:bg-green-50 hover:border-green-400 hover:text-green-600"
                )}
                onClick={async () => {
                  const nextAttrs = { ...((todo as any).attributes || {}) }
                  if (dateInput) (nextAttrs as any).dueDate = dateInput
                  else delete (nextAttrs as any).dueDate
                  await mutateTodo(todo.id, {
                    dueDate: dateInput || undefined,
                    dueTime: timeInput || undefined,
                    repeat: (repeatInput as 'daily' | 'weekly' | 'monthly' | 'yearly') || undefined,
                    attributes: { ...(nextAttrs as any), repeatDays: repeatInput === 'weekly' ? weeklyDays : undefined },
                  })
                  setScheduleOpen(false)
                  if (onLabelsChange) await onLabelsChange()
                }}
                title="Save"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <CloseButton onClick={() => setScheduleOpen(false)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs w-full">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-gray-600 uppercase">Date</label>
              <input
                type="date"
                className="input text-xs py-1 px-2"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-gray-600 uppercase">Time</label>
              <input
                type="time"
                className="input text-xs py-1 px-2"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-gray-600 uppercase">Repeat</label>
              <select
                className="input text-xs py-1 px-2"
                value={repeatInput}
                onChange={(e) => setRepeatInput(e.target.value)}
              >
                <option value="">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          {repeatInput === 'weekly' && (
            <div className="mt-1 flex gap-1">
              {['mon','tue','wed','thu','fri','sat','sun'].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`btn text-[10px] w-7 h-7 px-0 py-0 rounded-full ${weeklyDays.includes(d) ? 'border-accent text-accent' : ''}`}
                  onClick={() => setWeeklyDays((prev) => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                  title={d}
                >
                  {d.slice(0,2).toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      

      

      {labelPickerOpen && (
        <LabelManager
          todo={todo}
          labels={liveLabels}
          onClose={() => setLabelPickerOpen(false)}
          onLabelsChange={onLabelsChange}
          onLocalAddLabel={(label) => {
            // Add to local label map for chip display
            setLocalLabelsById((prev) => ({ ...prev, [label.id]: label }))
            // Add to live label IDs for instant chip appearance
            setLiveLabelIds((prev) => (prev.includes(label.id) ? prev : [...prev, label.id]))
            // Add to live labels list for instant picker update
            setLiveLabels((prev) => {
              const exists = prev.find((l) => l.id === label.id)
              return exists ? prev : [...prev, label]
            })
          }}
        />
      )}

      {attributePickerOpen && (
        <AttributeManager
          todo={{ ...todo, attributes: liveAttributes }}
          defs={attributeDefs}
          active={liveAttributes}
          onClose={() => setAttributePickerOpen(false)}
          onChanged={async (next) => {
            setLiveAttributes({ ...next })
            if (onLabelsChange) await onLabelsChange()
          }}
          onCreatedDef={async (def) => {
            setAttributeDefs((prev) => [...prev, def])
          }}
        />
      )}

      {assigneePickerOpen && (
        <div className="mt-2 w-full max-w-full rounded-md border bg-white p-3 shadow-card overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gray-700">Assign User</div>
            <div className="flex items-center gap-1">
              {(todo.assigneeIds || []).length > 0 && (
                <button
                  className={clsx(
                    "p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border transition-all hover:scale-105",
                    "border-gray-200 text-gray-800 bg-white hover:bg-red-50 hover:border-red-400 hover:text-red-600"
                  )}
                  title="Clear assignee"
                  onClick={async () => {
                    await mutateTodo(todo.id, { assigneeIds: [] })
                    if (onLabelsChange) await onLabelsChange()
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <CloseButton onClick={() => setAssigneePickerOpen(false)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input text-xs py-1 flex-1"
              placeholder="@username"
              value={assigneeInput}
              onChange={(e) => setAssigneeInput(e.target.value)}
              disabled={(todo.assigneeIds || []).length > 0}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const raw = assigneeInput.trim().replace(/^@/, '')
                  if (!raw) return
                  const u = uniqueUsers.find((x) => x.name?.toLowerCase().includes(raw.toLowerCase()))
                  if (!u) return
                  const next = [u.id]
                  await mutateTodo(todo.id, { assigneeIds: next })
                  setAssigneeInput('')
                  if (onLabelsChange) await onLabelsChange()
                }
              }}
            />
          </div>
          {/* Assignee suggestions - shown while typing */}
          {assigneeInput.trim() && (
            <div className="mt-2 max-h-40 overflow-y-auto border-t pt-2">
              <div className="mb-1 text-xs text-gray-500">Available users</div>
              {uniqueUsers
                .filter((u) => !(todo.assigneeIds || []).includes(u.id))
                .filter((u) => u.name?.toLowerCase().includes(assigneeInput.trim().replace(/^@/, '').toLowerCase()))
                .slice(0, 8)
                .map((u) => (
                  <button
                    key={u.id}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-50"
                    onClick={async () => {
                      const next = [u.id]
                      await mutateTodo(todo.id, { assigneeIds: next })
                      setAssigneeInput('')
                      if (onLabelsChange) await onLabelsChange()
                    }}
                  >
                    {u.name || 'User'}
                  </button>
                ))}
            </div>
          )}
          {/* Current assignee section removed; use clear button above for compactness */}
        </div>
      )}

      {/* Old separate time picker removed; merged into scheduleOpen */}

      {/* Link Note Modal */}
      {linkNoteOpen && (
        <LinkNoteModal
          onClose={() => setLinkNoteOpen(false)}
          linkedNoteIds={linkedNoteIds}
          onLink={async (noteId) => {
            const newLinkedIds = [...linkedNoteIds, noteId]
            setLinkedNoteIds(newLinkedIds)
            await mutateTodo(todo.id, { linkedNoteIds: newLinkedIds })
            if (onLabelsChange) await onLabelsChange()
          }}
        />
      )}

      {/* utils for new label color */}
      
    </motion.div>
  )
}
