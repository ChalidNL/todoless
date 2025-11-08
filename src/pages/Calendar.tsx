import { useMemo, useState, useEffect } from 'react'
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { format, parse, startOfWeek, getDay, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns'
import { enUS } from 'date-fns/locale'
import useFilteredTodos from '../hooks/useFilteredTodos'
import { useFilterContext } from '../contexts/FilterContext'
import { mutateTodo, Users } from '../db/dexieClient'
import { parseDueToDate } from '../utils/date'
import type { Todo, User } from '../db/schema'
import CloseButton from '../components/ui/CloseButton'

// @ts-ignore - types may be missing for dragAndDrop addon
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'

const locales = {
  'en-US': enUS,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
})

export default function CalendarPage() {
  // Centralized, realtime-filtered todos
  const { todos } = useFilteredTodos()
  const {
    selectedLabelIds,
    selectedAssigneeIds,
    selectedWorkflowIds,
    blockedOnly,
    dueStart,
    dueEnd,
  } = useFilterContext()
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editRepeat, setEditRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none')
  const [view, setView] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('calendar:view')
      return (stored === 'day' || stored === 'week' || stored === 'month' || stored === 'year') ? stored : Views.MONTH
    } catch {
      return Views.MONTH
    }
  })
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    Users.list().then(setUsers)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('calendar:view', view)
    } catch {}
  }, [view])

  const events = useMemo(() => {
    const items = todos.filter((t) => (t.dueDate || t.attributes?.dueDate) && !t.completed)
    return items
      .map((t) => {
        const raw = t.dueDate || t.attributes?.dueDate
        if (!raw) return null
        const dt = parseDueToDate(raw)
        if (!dt) return null
        return {
          id: t.id,
          title: t.title,
          start: dt,
          end: dt,
          allDay: true,
          resource: t,
          draggable: true,
        }
      })
      .filter(Boolean) as Array<any>
  }, [todos])

  const DnDCalendar = withDragAndDrop(BigCalendar)

  // Custom Year view component
  const YearView = ({ date, events }: { date: Date; events: any[] }) => {
    const months = eachMonthOfInterval({ start: startOfYear(date), end: endOfYear(date) })
    const eventsByMonth = useMemo(() => {
      const map: Record<number, number> = {}
      events.forEach((e) => {
        const m = new Date(e.start).getMonth()
        map[m] = (map[m] || 0) + 1
      })
      return map
    }, [events])

    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-4">
        {months.map((m, idx) => (
          <div
            key={idx}
            className="border border-gray-200 rounded p-3 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => {
              setCurrentDate(m)
              setView(Views.MONTH)
            }}
          >
            <div className="text-sm font-semibold mb-1">{format(m, 'MMMM')}</div>
            <div className="text-xs text-gray-600">
              {eventsByMonth[idx] || 0} task{eventsByMonth[idx] !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="card">
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Calendar</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex gap-1 border border-gray-300 rounded overflow-hidden">
            <button
              onClick={() => setView(Views.DAY)}
              className={`px-3 py-1 text-xs font-medium ${view === Views.DAY ? 'bg-accent text-white' : 'bg-white hover:bg-gray-50'}`}
              title="Day view with time slots"
            >
              Day
            </button>
            <button
              onClick={() => setView(Views.WEEK)}
              className={`px-3 py-1 text-xs font-medium ${view === Views.WEEK ? 'bg-accent text-white' : 'bg-white hover:bg-gray-50'}`}
              title="Week view with time slots"
            >
              Week
            </button>
            <button
              onClick={() => setView(Views.MONTH)}
              className={`px-3 py-1 text-xs font-medium ${view === Views.MONTH ? 'bg-accent text-white' : 'bg-white hover:bg-gray-50'}`}
              title="Month view with days"
            >
              Month
            </button>
            <button
              onClick={() => setView('year')}
              className={`px-3 py-1 text-xs font-medium ${view === 'year' ? 'bg-accent text-white' : 'bg-white hover:bg-gray-50'}`}
              title="Year overview"
            >
              Year
            </button>
          </div>
          {(blockedOnly || selectedLabelIds.length || selectedAssigneeIds.length || selectedWorkflowIds.length || dueStart || dueEnd) && (
            <span className="chip border-accent bg-accent/10 text-accent text-xs">Filters active</span>
          )}
        </div>
      </div>
      <div style={{ height: view === 'year' ? 'auto' : 600 }} className="calendar-wrapper">
        {view === 'year' ? (
          <YearView date={currentDate} events={events} />
        ) : (
          <DnDCalendar
            localizer={localizer}
            events={events}
            views={[Views.DAY, Views.WEEK, Views.MONTH]}
            view={view === 'year' ? Views.MONTH : view}
            date={currentDate}
            onNavigate={(date: Date) => setCurrentDate(date)}
            onView={(newView: any) => setView(newView)}
            startAccessor="start"
            endAccessor="end"
            popup
            onSelectEvent={(e: any) => {
              const t: Todo = e.resource
              setSelectedTodo(t)
              setEditDate(t.dueDate || t.attributes?.dueDate || '')
              setEditTime(t.dueTime || '')
              setEditRepeat((t.repeat as any) || 'none')
            }}
            tooltipAccessor={(e: any) => e.title}
            onEventDrop={async ({ event, start }: any) => {
              const newDate = new Date(start)
              const iso = newDate.toISOString().substring(0, 10)
              const t: Todo = event.resource
              await mutateTodo(t.id, { dueDate: iso, attributes: { ...(t.attributes || {}), dueDate: iso } })
            }}
            step={30}
            timeslots={2}
            min={new Date(2024, 0, 1, 7, 0, 0)}
            max={new Date(2024, 0, 1, 22, 0, 0)}
            formats={{
              dayFormat: (date: Date) => format(date, 'EEE d'),
              dayHeaderFormat: (date: Date) => format(date, 'EEEE, MMMM d'),
              monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy'),
              agendaHeaderFormat: ({ start, end }: { start: Date; end: Date }) => 
                `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
            }}
          />
        )}
      </div>

      {/* Inline Event Editor Modal */}
      {selectedTodo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelectedTodo(null)}
        >
          <div
            className="card w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Edit Event</h3>
              <CloseButton onClick={() => setSelectedTodo(null)} />
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs text-gray-600">Title</div>
                <div className="text-sm font-medium">{selectedTodo.title}</div>
              </div>

              <div>
                <div className="mb-1 text-xs text-gray-600">Due Date</div>
                <input
                  type="date"
                  className="input w-full"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-gray-600">Time</div>
                <input
                  type="time"
                  className="input w-full"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-gray-600">Repeat</div>
                <select
                  className="input w-full"
                  value={editRepeat}
                  onChange={(e) => setEditRepeat(e.target.value as any)}
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs text-gray-600">Assignees</div>
                <div className="flex flex-wrap gap-1">
                  {(selectedTodo.assigneeIds || []).map((uid) => {
                    const u = users.find((x) => x.id === uid)
                    if (!u) return null
                    const initials = (u.firstName?.[0] || '') + (u.lastName?.[0] || '') || u.name?.[0] || 'U'
                    return (
                      <span
                        key={uid}
                        className="chip border-accent bg-accent/10 text-accent text-[11px] px-2 py-1 font-semibold"
                        title={u.email || u.name}
                      >
                        {initials.toUpperCase()}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTodo.blocked || false}
                    onChange={(e) => {
                      const updated = { ...selectedTodo, blocked: e.target.checked }
                      setSelectedTodo(updated)
                    }}
                  />
                  <span>🚩 Blocked</span>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  className="btn flex-1"
                  onClick={async () => {
                    await mutateTodo(selectedTodo.id, {
                      dueDate: editDate || undefined,
                      dueTime: editTime || undefined,
                      repeat: editRepeat === 'none' ? undefined : editRepeat,
                      blocked: selectedTodo.blocked,
                      attributes: { ...(selectedTodo.attributes || {}), dueDate: editDate || undefined }
                    })
                    setSelectedTodo(null)
                  }}
                >
                  Save
                </button>
                <button className="btn" onClick={() => setSelectedTodo(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
