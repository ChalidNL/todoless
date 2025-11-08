import { useMemo, useState, useEffect } from 'react'
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar'
// @ts-ignore - types may be missing for dragAndDrop addon
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { format, parse, startOfWeek, getDay, startOfYear, endOfYear, eachMonthOfInterval, addDays, addWeeks, addMonths, addYears, subDays, subWeeks, subMonths, subYears, isSameDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { mutateTodo, Users, Workflows } from '../db/dexieClient'
import { parseDueToDate } from '../utils/date'
import type { Todo, User, Workflow } from '../db/schema'
import CloseButton from './ui/CloseButton'

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

interface CalendarViewProps {
  todos: Todo[]
}

export default function CalendarView({ todos }: CalendarViewProps) {
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
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
    Workflows.list().then(setWorkflows)
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

  // Custom header with navigation + segmented control
  function Header() {
    const stepBack = () => {
      if (view === Views.DAY) setCurrentDate((d) => subDays(d, 1))
      else if (view === Views.WEEK) setCurrentDate((d) => subWeeks(d, 1))
      else if (view === Views.MONTH) setCurrentDate((d) => subMonths(d, 1))
      else if (view === 'year') setCurrentDate((d) => subYears(d, 1))
    }
    const stepForward = () => {
      if (view === Views.DAY) setCurrentDate((d) => addDays(d, 1))
      else if (view === Views.WEEK) setCurrentDate((d) => addWeeks(d, 1))
      else if (view === Views.MONTH) setCurrentDate((d) => addMonths(d, 1))
      else if (view === 'year') setCurrentDate((d) => addYears(d, 1))
    }
    const goToday = () => setCurrentDate(new Date())
    return (
      <div className="flex items-center justify-between gap-3 p-3 border-b bg-white/80">
        <div className="flex items-center gap-2">
          <button className="h-8 w-8 rounded hover:bg-gray-100 flex items-center justify-center" onClick={stepBack} title="Previous">
            ‹
          </button>
          <button className="h-8 rounded border px-2 text-xs hover:bg-gray-50" onClick={goToday}>Today</button>
          <button className="h-8 w-8 rounded hover:bg-gray-100 flex items-center justify-center" onClick={stepForward} title="Next">
            ›
          </button>
        </div>
        <div className="inline-flex items-center rounded-md border bg-white p-0.5 text-xs">
          <button className={`px-2 py-1 rounded ${view === Views.DAY ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`} onClick={() => setView(Views.DAY)}>
            Day
          </button>
          <button className={`px-2 py-1 rounded ${view === Views.WEEK ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`} onClick={() => setView(Views.WEEK)}>
            Week
          </button>
          <button className={`px-2 py-1 rounded ${view === Views.MONTH ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`} onClick={() => setView(Views.MONTH)}>
            Month
          </button>
          <button className={`px-2 py-1 rounded ${view === 'year' ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'}`} onClick={() => setView('year')}>
            Year
          </button>
        </div>
        <div className="text-sm font-semibold text-gray-700">
          {view === 'year' ? format(currentDate, 'yyyy') :
           view === Views.MONTH ? format(currentDate, 'MMMM yyyy') :
           view === Views.WEEK ? `${format(currentDate, 'MMM d')} – ${format(addDays(currentDate, 6), 'MMM d, yyyy')}` :
           format(currentDate, 'EEEE, MMM d, yyyy')}
        </div>
      </div>
    )
  }

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
      <div className="p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{format(date, 'yyyy')}</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 max-w-4xl mx-auto">
          {months.map((m) => {
            const monthIdx = m.getMonth()
            const count = eventsByMonth[monthIdx] || 0
            return (
              <button
                key={monthIdx}
                onClick={() => {
                  setCurrentDate(m)
                  setView(Views.MONTH)
                }}
                className="group p-5 border-2 border-gray-200 rounded-xl hover:border-gray-900 hover:shadow-lg transition-all text-center bg-white"
              >
                <div className="text-base font-bold text-gray-900 mb-2">
                  {format(m, 'MMMM')}
                </div>
                <div className={`text-sm font-medium ${count > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {count > 0 ? `${count} task${count !== 1 ? 's' : ''}` : 'No tasks'}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const handleEventDrop = async ({ event, start }: any) => {
    const todo = event.resource as Todo
    const newDate = format(start, 'yyyy-MM-dd')
    await mutateTodo(todo.id, { dueDate: newDate })
  }

  const handleEventClick = (event: any) => {
    const todo = event.resource as Todo
    setSelectedTodo(todo)
    const raw = todo.dueDate || todo.attributes?.dueDate
    if (raw) {
      const dt = parseDueToDate(raw)
      if (dt) {
        setEditDate(format(dt, 'yyyy-MM-dd'))
        setEditTime(format(dt, 'HH:mm'))
      }
    }
  }

  // Custom event component to show workflow arrows on week view
  const EventComponent = (props: any) => {
    const todo: Todo = props.event?.resource
    const wf = workflows.find((w) => w.id === todo?.workflowId)
    const stages = wf?.stages || []
    const showArrows = view === Views.WEEK && stages.length >= 3 && todo?.workflowStage
    const currentIdx = stages.findIndex((s) => s === todo?.workflowStage)
    const atFirst = currentIdx <= 0
    const atLast = currentIdx === stages.length - 1

    const move = async (dir: -1 | 1, e: React.MouseEvent) => {
      e.stopPropagation()
      if (currentIdx < 0) return
      const nextIdx = currentIdx + dir
      if (nextIdx < 0 || nextIdx >= stages.length) return
      const nextStage = stages[nextIdx]
      const isLast = nextIdx === stages.length - 1
      await mutateTodo(todo.id, { workflowStage: nextStage, completed: isLast })
    }

    return (
      <div className="flex items-center gap-1">
        {showArrows && !atFirst && (
          <button className="h-5 w-5 rounded bg-gray-100 hover:bg-gray-200 text-xs" onClick={(e) => move(-1, e)} title="Move left">←</button>
        )}
        <span className="truncate">{props.title}</span>
        {showArrows && !atLast && (
          <button className="h-5 w-5 rounded bg-gray-100 hover:bg-gray-200 text-xs ml-auto" onClick={(e) => move(1, e)} title="Move right">→</button>
        )}
      </div>
    )
  }

  const saveEventEdit = async () => {
    if (!selectedTodo || !editDate) return
    const newDate = editTime ? `${editDate}T${editTime}:00` : editDate
    await mutateTodo(selectedTodo.id, { dueDate: newDate })
    setSelectedTodo(null)
  }

  return (
    <div className="calendar-wrapper rounded-lg border border-gray-200 bg-white" style={{ minHeight: '600px' }}>
      <Header />
      {view === 'year' ? (
        <div className="min-h-[600px]">
          <YearView date={currentDate} events={events} />
        </div>
      ) : (
        <div className="h-[600px] p-4" style={{ opacity: 1, transition: 'opacity 0.2s' }}>
          <DnDCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={view as any}
            onView={(v: any) => setView(v)}
            date={currentDate}
            onNavigate={setCurrentDate}
            onEventDrop={handleEventDrop}
            onSelectEvent={handleEventClick}
            views={[Views.DAY, Views.WEEK, Views.MONTH, 'year']}
            toolbar={false}
            step={30}
            timeslots={2}
            min={new Date(2024, 0, 1, 7, 0, 0)}
            max={new Date(2024, 0, 1, 22, 0, 0)}
            formats={{
              timeGutterFormat: 'HH:mm',
              eventTimeRangeFormat: () => '',
              dayHeaderFormat: (date: Date) => format(date, 'EEE d'),
            }}
            components={{
              event: EventComponent as any,
              year: YearView as any
            }}
            style={{ height: '100%' }}
          />
        </div>
      )}

      {/* Event Editor Modal */}
      {selectedTodo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border-2 border-gray-300 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Event</h3>
              <CloseButton onClick={() => setSelectedTodo(null)} />
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <div className="rounded border border-gray-300 px-3 py-2 text-sm bg-gray-50">
                  {selectedTodo.title}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Time (optional)</label>
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveEventEdit}
                  className="flex-1 rounded border-2 border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Save
                </button>
                <button
                  onClick={() => setSelectedTodo(null)}
                  className="flex-1 rounded border-2 border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
