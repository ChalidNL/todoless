import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Todo, Label } from '../db/schema'
import { Labels, mutateTodo } from '../db/dexieClient'
import useFilteredTodos from '../hooks/useFilteredTodos'
import { parseDueToDate } from '../utils/date'
import { useViewMode } from '../contexts/ViewModeContext'

function isoDate(d: Date) {
  return d.toISOString().substring(0, 10)
}

export default function Today() {
  const { todos } = useFilteredTodos()
  const [labels, setLabels] = useState<Label[]>([])
  const { mode } = useViewMode()

  const reload = async () => {
    const ls = await Labels.list()
    setLabels(ls)
  }

  useEffect(() => {
    reload()
  }, [])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const items = todos.filter((t: Todo) => {
    if (t.completed) return false
    const raw = t.dueDate || t.attributes?.dueDate
    if (!raw) return false
    const d = parseDueToDate(raw)
    if (!d) return false
    d.setHours(0, 0, 0, 0)
    return d.getTime() === today.getTime()
  })

  const handlePostpone = async (t: Todo) => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const iso = isoDate(d)
    await mutateTodo(t.id, { dueDate: iso, attributes: { ...(t.attributes || {}), dueDate: iso } })
  }

  const handleComplete = async (t: Todo) => {
    await mutateTodo(t.id, { completed: true })
  }

  const handleBlock = async (t: Todo) => {
    await mutateTodo(t.id, { blocked: true })
  }

  return (
    <div className="space-y-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Today's Tasks</h2>
          <div className="text-xs text-gray-600">Swipe: Right=Done • Left=Postpone • Up=Block</div>
        </div>
      </div>
      <div className={mode === 'tiles' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>
        {items.length === 0 ? (
          <div className="text-sm text-gray-500">No tasks due today.</div>
        ) : (
          items.map((t) => (
            <motion.div
              key={t.id}
              className={`card ${t.blocked ? 'ring-1 ring-red-400' : ''}`}
              drag
              dragElastic={0.2}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragEnd={(_, info) => {
                const { offset } = info
                if (offset.x > 120) return handleComplete(t)
                if (offset.x < -120) return handlePostpone(t)
                if (offset.y < -100) return handleBlock(t)
              }}
            >
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={t.completed} onChange={(e) => mutateTodo(t.id, { completed: e.target.checked })} />
                <div className="flex-1 truncate text-sm">{t.title}</div>
                <button className="btn text-xs" onClick={() => handleBlock(t)} title="Block">
                  ⛔
                </button>
                <button className="btn text-xs" onClick={() => handlePostpone(t)} title="Postpone">
                  ⏭
                </button>
                <button className="btn text-xs" onClick={() => handleComplete(t)} title="Done">
                  ✅
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.labelIds.map((id) => {
                  const l = labels.find((x) => x.id === id)
                  if (!l) return null
                  return (
                    <span key={id} className="chip border-gray-200 text-[11px] px-1.5 py-0.5" style={{ borderColor: l.color }}>
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                      {l.name}
                    </span>
                  )
                })}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
