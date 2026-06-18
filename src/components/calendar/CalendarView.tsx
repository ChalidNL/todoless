import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flag, RotateCcw, Save, Tag, Target, Trash2, User, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../AuthProvider';
import { useLanguage } from '../../context/LanguageContext';
import { t, type Language } from '../../i18n/translations';
import { AppHeader } from '../shared/NewGlobalHeader';
import { SharedSelect } from '../shared/SharedSelect';
import { AttributeChip } from '../shared/AttributeChip';
import { entityColor } from '../../lib/entity-colors';
import { getCompactUserName } from '../../lib/member-role-utils';
import { getRepeatChipLabel } from '../../lib/repeat-options';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/priority';
import type { Task } from '../../types';
import {
  addDays,
  buildCalendarItems,
  endOfLocalDay,
  formatDateInputValue,
  getDefaultCalendarView,
  getStoredCalendarView,
  parseDateInputValue,
  sameLocalDay,
  startOfLocalDay,
  startOfMonthGrid,
  storeCalendarView,
  toDateLabel,
  toTimeLabel,
  type CalendarItem,
  type CalendarView as CalendarViewMode,
} from '../../lib/calendar-utils';

export function CalendarView() {
  const { tasks, addTask, updateTask, deleteTask } = useApp();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [anchor, setAnchor] = useState(() => startOfLocalDay(Date.now()));
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay(Date.now()));
  const [mode, setMode] = useState<CalendarViewMode>(() => getStoredCalendarView((user as any)?.id, getDefaultCalendarView()));
  const [quickAdd, setQuickAdd] = useState<Task | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const draftTitleRef = useRef('');
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    storeCalendarView((user as any)?.id, mode);
  }, [mode, user]);

  const range = useMemo(() => {
    if (mode === 'day') return { start: startOfLocalDay(anchor), end: endOfLocalDay(anchor) };
    if (mode === 'week') return { start: startOfLocalDay(addDays(anchor, -((new Date(anchor).getDay() + 6) % 7))), end: endOfLocalDay(addDays(anchor, 6 - ((new Date(anchor).getDay() + 6) % 7))) };
    if (mode === 'month') return { start: startOfMonthGrid(anchor), end: endOfLocalDay(addDays(startOfMonthGrid(anchor), 41)) };
    return { start: startOfLocalDay(Date.now()), end: endOfLocalDay(addDays(Date.now(), 28)) };
  }, [anchor, mode]);

  const effectiveTasks = useMemo(() => {
    const contextIds = new Set(tasks.map((t) => t.id));
    return [...tasks, ...localTasks.filter((t) => !contextIds.has(t.id))];
  }, [tasks, localTasks]);

  const allItems = useMemo(() => buildCalendarItems({ tasks: effectiveTasks, rangeStart: range.start, rangeEnd: range.end }), [effectiveTasks, range]);
  const items = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allItems;
    return allItems.filter((item) => item.title.toLowerCase().includes(query));
  }, [allItems, searchQuery]);
  const selectedItems = items.filter((item) => sameLocalDay(item.startTime, selectedDay));
  const views: CalendarViewMode[] = ['month', 'week', 'day', 'agenda'];

  const periodTitle = getPeriodTitle(mode, anchor, range.start, range.end, language);
  const isTodayAnchor = sameLocalDay(anchor, Date.now());

  const getCurrentWeekStart = () => {
    const now = new Date();
    const day = now.getDay() || 7; // Make Sunday 7
    now.setHours(0, 0, 0, 0);
    now.setDate(now.getDate() - day + 1); // Monday
    return now.getTime();
  };
  const getCurrentWeekEnd = () => getCurrentWeekStart() + 7 * 24 * 60 * 60 * 1000 - 1;

  const draftTask = (startTime: number): Task => ({
    id: '',
    title: '',
    status: 'todo',
    blocked: false,
    flag: false,
    labels: [],
    dueDate: startTime,
    startTime,
    endTime: startTime + 60 * 60 * 1000,
    allDay: false,
    showInCalendar: true,
    createdAt: Date.now(),
  });

  const openCreate = (day = selectedDay, hour = 9, title = searchQuery) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    const startMs = start.getTime();
    setSelectedDay(startOfLocalDay(startMs));
    const nextTitle = title.trim();
    draftTitleRef.current = nextTitle;
    setDraftTitle(nextTitle);
    setQuickAdd({ ...draftTask(startMs), title: nextTitle });
    setFormError('');
    setEditing(null);
  };

  const saveTask = async (task: Task) => {
    const cleaned = { ...task, title: task.title.trim() };
    if (!cleaned.title) {
      setFormError(t('calendar.titleRequired', language));
      return;
    }
    if (!cleaned.startTime || !cleaned.endTime || cleaned.endTime <= cleaned.startTime) {
      setFormError(t('calendar.timeRequired', language));
      return;
    }
    setIsSaving(true);
    setFormError('');
    try {
      if (cleaned.id) {
        setLocalTasks((prev) => prev.map((existing) => existing.id === cleaned.id ? cleaned : existing));
        setQuickAdd(null);
        setEditing(null);
        setSearchQuery('');
        updateTask(cleaned.id, cleaned);
      } else {
        const weekStart = getCurrentWeekStart();
        const weekEnd = getCurrentWeekEnd();
        const taskStatus = cleaned.dueDate && cleaned.dueDate >= weekStart && cleaned.dueDate <= weekEnd ? 'todo' : 'backlog';
        const optimistic: Task = { ...cleaned, status: taskStatus, id: `local-${Date.now()}`, createdAt: cleaned.createdAt || Date.now() };
        setLocalTasks((prev) => [...prev, optimistic]);
        setQuickAdd(null);
        setEditing(null);
        setSearchQuery('');
        addTask({ ...cleaned, status: taskStatus } as Omit<Task, 'id' | 'createdAt' | 'completedAt'>);
      }
    } catch {
      setFormError(t('calendar.saveFailed', language));
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (task: Task) => {
    draftTitleRef.current = task.title;
    setDraftTitle(task.title);
    setEditing(task);
    setFormError('');
  };

  const activeDraft = quickAdd ?? editing;
  const updateActiveDraft = (task: Task) => {
    draftTitleRef.current = task.title;
    setDraftTitle(task.title);
    if (quickAdd) setQuickAdd(task);
    else setEditing(task);
  };
  const closeActiveDraft = () => {
    if (quickAdd) setQuickAdd(null);
    else setEditing(null);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-neutral-50">
      <div className="sticky top-0 z-40">
        <AppHeader
          onSearch={activeDraft ? undefined : setSearchQuery}
          onAddEmpty={(value) => openCreate(selectedDay, 9, value || searchQuery)}
          onInputValueChange={activeDraft ? (title) => updateActiveDraft({ ...activeDraft, title }) : undefined}
          onSubmitInput={activeDraft ? (title) => { void saveTask({ ...activeDraft, title }); } : undefined}
          onCancelInput={activeDraft ? closeActiveDraft : undefined}
          inputValue={activeDraft ? draftTitle : undefined}
          submitAriaLabel={t('calendar.saveEvent', language)}
          searchPlaceholder={activeDraft ? t('calendar.newEvent', language) : t('calendar.searchPlaceholder', language)}
          type="calendar"
          showAdd={!activeDraft}
          showInputActions={false}
        />
      </div>
      <header className="flex-shrink-0 bg-white border-b border-neutral-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { const today = startOfLocalDay(Date.now()); setAnchor(today); setSelectedDay(today); }} aria-label={t('calendar.today', language)} className={`p-2 rounded-xl ${isTodayAnchor ? 'bg-violet-600 text-white' : 'bg-neutral-100 text-neutral-700'}`}><Target className="w-4 h-4" /></button>
          <button type="button" aria-label={t('calendar.previous', language)} onClick={() => setAnchor(addDays(anchor, mode === 'month' ? -28 : mode === 'agenda' ? -7 : -1))} className="p-2 rounded-xl bg-neutral-100 text-neutral-700"><ChevronLeft className="w-4 h-4" /></button>
          <p data-testid="calendar-period-title" className="min-w-0 flex-1 text-center text-sm font-bold text-neutral-900">{periodTitle}</p>
          <button type="button" aria-label={t('calendar.next', language)} onClick={() => setAnchor(addDays(anchor, mode === 'month' ? 28 : mode === 'agenda' ? 7 : 1))} className="p-2 rounded-xl bg-neutral-100 text-neutral-700"><ChevronRight className="w-4 h-4" /></button>
          <SharedSelect
            id="calendar-view-select"
            ariaLabel={t('calendar.viewLabel', language)}
            value={mode}
            onChange={(value) => setMode(value as CalendarViewMode)}
            options={views.map((view) => ({ value: view, label: t(`calendar.${view}`, language) }))}
            className="py-2 font-semibold text-neutral-800 shadow-sm focus:ring-violet-300"
          />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-2">
        {quickAdd && <InlineEventEditor event={{ ...quickAdd, title: draftTitle }} language={language} onCancel={() => setQuickAdd(null)} onChange={setQuickAdd} error={formError} onSave={() => { void saveTask({ ...quickAdd, title: draftTitleRef.current }); }} isSaving={isSaving} />}
        {editing && <InlineEventEditor event={{ ...editing, title: draftTitle }} language={language} onCancel={() => setEditing(null)} onChange={setEditing} onSave={() => { void saveTask({ ...editing, title: draftTitleRef.current }); }} onDelete={(id) => { deleteTask(id); setEditing(null); }} error={formError} isSaving={isSaving} expandedDefault />}
        {mode === 'month' && <MonthGrid anchor={anchor} items={items} selectedDay={selectedDay} onSelect={setSelectedDay} onCreate={openCreate} language={language} />}
        {mode === 'week' && <TimeGrid mode="week" start={range.start} items={items} onEdit={openEdit} onCreate={openCreate} language={language} />}
        {mode === 'day' && <TimeGrid mode="day" start={startOfLocalDay(anchor)} items={items} onEdit={openEdit} onCreate={openCreate} language={language} onCompleteTask={(id) => updateTask(id, { status: 'done' })} />}
        {mode === 'agenda' && <AgendaList items={items} language={language} onEdit={openEdit} onCompleteTask={(id) => updateTask(id, { status: 'done' })} />}
        {mode === 'month' && <AgendaList items={selectedItems} language={language} compact onEdit={openEdit} onCompleteTask={(id) => updateTask(id, { status: 'done' })} />}
      </main>
    </div>
  );
}

function MonthGrid({ anchor, items, selectedDay, onSelect, onCreate, language }: { anchor: number; items: CalendarItem[]; selectedDay: number; onSelect: (day: number) => void; onCreate: (day: number) => void; language: Language }) {
  const start = startOfMonthGrid(anchor);
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const month = new Date(anchor).getMonth();
  return (
    <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
      <div className="grid grid-cols-7 text-[10px] font-semibold text-neutral-500 border-b border-neutral-100">
        {days.slice(0, 7).map((day) => <div key={day} className="p-1 text-center">{new Intl.DateTimeFormat(language, { weekday: 'short' }).format(new Date(day))}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayItems = items.filter((item) => sameLocalDay(item.startTime, day));
          const active = sameLocalDay(day, selectedDay);
          return (
            <button key={day} onDoubleClick={() => onCreate(day)} onClick={() => onSelect(startOfLocalDay(day))} className={`min-h-[clamp(64px,11vh,112px)] border-r border-b border-neutral-100 p-1 text-left ${active ? 'bg-violet-50' : ''}`}>
              <span data-testid={sameLocalDay(day, Date.now()) ? 'calendar-today' : undefined} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1 text-xs font-semibold ${sameLocalDay(day, Date.now()) ? 'border-2 border-black bg-white text-black ring-2 ring-black' : new Date(day).getMonth() === month ? 'border-transparent text-neutral-800' : 'border-transparent text-neutral-300'}`}>{new Date(day).getDate()}</span>
              <div className="mt-1 space-y-0.5 overflow-hidden">
                {dayItems.slice(0, 3).map((item) => <span key={item.kind + item.id} className="block h-1.5 rounded-full" style={{ backgroundColor: item.color }} />)}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const HOUR_HEIGHT = 56;

function TimeGrid({ mode, start, items, onEdit, onCreate, onCompleteTask, language }: { mode: 'week' | 'day'; start: number; items: CalendarItem[]; onEdit: (task: Task) => void; onCreate: (day: number, hour?: number) => void; onCompleteTask?: (id: string) => void; language: Language }) {
  const containerRef = useRef<HTMLElement>(null);
  const scrolledRef = useRef(false);
  const { addTask } = useApp();
  const [inlineSlot, setInlineSlot] = useState<{ day: number; hour: number } | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const days = Array.from({ length: mode === 'week' ? 7 : 1 }, (_, index) => addDays(start, index));
  const allDayItems = items.filter((item) => item.allDay);
  const timedItems = items.filter((item) => !item.allDay);
  const now = Date.now();
  const nowDate = new Date(now);
  const nowHours = nowDate.getHours() + nowDate.getMinutes() / 60;
  const showNowLine = nowHours >= 0 && nowHours <= 24;
  const nowTop = Math.min(Math.max(nowHours * HOUR_HEIGHT, 0), 24 * HOUR_HEIGHT);

  const handleInlineCreate = (day: number, hour: number) => {
    const title = inlineTitle.trim();
    if (!title) return;
    const startMs = new Date(day);
    startMs.setHours(hour, 0, 0, 0);
    const task: Omit<Task, 'id' | 'createdAt' | 'completedAt'> = {
      title,
      status: 'todo',
      blocked: false,
      flag: false,
      labels: [],
      dueDate: startMs.getTime(),
      startTime: startMs.getTime(),
      endTime: startMs.getTime() + 60 * 60 * 1000,
      allDay: false,
      showInCalendar: true,
    };
    addTask(task);
    setInlineSlot(null);
    setInlineTitle('');
  };

  const clearInline = () => {
    setInlineSlot(null);
    setInlineTitle('');
  };

  useEffect(() => {
    const el = containerRef.current;
    if (el && typeof el.scrollTo === 'function' && !scrolledRef.current) {
      scrolledRef.current = true;
      const scrollTo = Math.max(0, nowTop - el.clientHeight / 2);
      el.scrollTo({ top: scrollTo, behavior: 'smooth' });
    }
  }, [nowTop]);

  return (
    <section ref={containerRef} data-testid={mode === 'week' ? 'calendar-week-time-grid' : 'calendar-day-time-grid'} className="h-full min-h-[70vh] overflow-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="sticky top-0 z-10 grid bg-white/95 backdrop-blur border-b border-neutral-100" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(${mode === 'week' ? '48px' : '180px'}, 1fr))` }}>
        <div className="border-r border-neutral-100" />
        {days.map((day) => {
          const today = sameLocalDay(day, now);
          return (
            <div key={day} className={`px-1 py-2 text-center text-[11px] font-bold ${today ? 'bg-violet-50 text-violet-700' : 'text-neutral-700'}`}>
              {mode === 'week' && (
                <span className={`inline-flex items-center justify-center rounded-full border px-2 py-1 ${today ? 'border-black bg-white text-black' : 'border-transparent'}`}>
                  {new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric' }).format(new Date(day))}
                </span>
              )}
            </div>
          );
        })}
        <div className="col-start-2 col-end-[-1] grid border-t border-neutral-100" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(${mode === 'week' ? '48px' : '180px'}, 1fr))` }}>
          {days.map((day) => (
            <div key={day} className="min-h-7 border-r border-neutral-100 px-1 py-1">
              {allDayItems.filter((item) => sameLocalDay(item.startTime, day)).slice(0, 2).map((item) => <CompactEvent key={item.kind + item.id} item={item} onEdit={onEdit} onCompleteTask={onCompleteTask} />)}
            </div>
          ))}
        </div>
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(${mode === 'week' ? '48px' : '180px'}, 1fr))`, minHeight: HOURS.length * HOUR_HEIGHT }}>
        <div className="border-r border-neutral-100 bg-neutral-50">
          {HOURS.map((hour) => <div key={hour} className="h-14 pr-1 text-right text-[10px] font-medium text-neutral-400">{String(hour).padStart(2, '0')}:00</div>)}
        </div>
        {days.map((day) => (
          <div key={day} className={`relative border-r border-neutral-100 ${sameLocalDay(day, now) ? 'bg-violet-50/30' : ''}`}>
            {HOURS.map((hour) => {
              const isActive = inlineSlot?.day === day && inlineSlot?.hour === hour;
              if (isActive) {
                return (
                  <div key={hour} className="absolute left-1 right-1 z-10" style={{ top: hour * HOUR_HEIGHT }}>
                    <input
                      autoFocus
                      type="text"
                      value={inlineTitle}
                      onChange={(e) => setInlineTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleInlineCreate(day, hour);
                        if (e.key === 'Escape') clearInline();
                      }}
                      onBlur={() => {
                        if (!inlineTitle.trim()) clearInline();
                      }}
                      placeholder={t('calendar.newEvent', language)}
                      className="w-full rounded-lg border border-violet-400 bg-white px-2 py-1.5 text-xs font-semibold text-neutral-900 shadow-lg outline-none ring-2 ring-violet-300 placeholder:text-neutral-400"
                    />
                  </div>
                );
              }
              return (
                <button
                  key={hour}
                  type="button"
                  data-testid={`calendar-slot-${String(hour).padStart(2, '0')}`}
                  onClick={() => { setInlineSlot({ day, hour }); setInlineTitle(''); }}
                  className="block h-14 w-full border-b border-neutral-100 text-left focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              );
            })}
            {timedItems.filter((item) => sameLocalDay(item.startTime, day)).map((item) => <TimedEvent key={item.kind + item.id} item={item} onEdit={onEdit} onCompleteTask={onCompleteTask} />)}
          </div>
        ))}
        {showNowLine && <div data-testid="calendar-now-line" className="pointer-events-none absolute left-11 right-0 z-30 h-0.5 bg-red-500" style={{ top: nowTop }} />}
      </div>
    </section>
  );
}

function CompactEvent({ item, onEdit, onCompleteTask }: { item: CalendarItem; onEdit: (task: Task) => void; onCompleteTask?: (id: string) => void }) {
  const handleClick = () => {
    if (item.completed) {
      onCompleteTask?.(item.id);
    } else {
      onEdit(item.source);
    }
  };
  return (
    <button type="button" onClick={handleClick} className="mb-0.5 w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold text-neutral-800 bg-neutral-100 border border-neutral-200 flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#8B5CF6' }} />
      {item.title}
    </button>
  );
}

function TimedEvent({ item, onEdit, onCompleteTask }: { item: CalendarItem; onEdit: (task: Task) => void; onCompleteTask?: (id: string) => void }) {
  const start = new Date(item.startTime);
  const end = new Date(item.endTime || item.startTime + 60 * 60 * 1000);
  const startMinutes = Math.max(0, start.getHours() * 60 + start.getMinutes());
  const durationMinutes = Math.max(30, (end.getTime() - start.getTime()) / 60000);

  const handleClick = () => {
    if (item.completed) {
      onCompleteTask?.(item.id);
    } else {
      onEdit(item.source);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="absolute left-1 right-1 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] font-semibold text-neutral-900 bg-white border-l-2 border-neutral-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
      style={{ top: (startMinutes / 60) * HOUR_HEIGHT, minHeight: 28, height: (durationMinutes / 60) * HOUR_HEIGHT }}
    >
      <span className="block truncate">{item.title}</span>
    </button>
  );
}

function AgendaList({ items, language, compact, onEdit, onCompleteTask }: { items: CalendarItem[]; language: Language; compact?: boolean; onEdit: (task: Task) => void; onCompleteTask: (id: string) => void }) {
  if (!items.length) return <div data-testid="calendar-agenda-list" className="mt-2 rounded-2xl border border-dashed border-neutral-200 bg-white/70 p-3 text-center text-xs text-neutral-400">{t('calendar.noEvents', language)}</div>;
  return <div data-testid="calendar-agenda-list" className={`space-y-1 ${compact ? 'mt-2' : ''}`}>{items.map((item) => <ItemCard key={item.kind + item.id} item={item} language={language} onEdit={onEdit} onCompleteTask={onCompleteTask} />)}</div>;
}

const SubtaskIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="8" cy="8" r="2.5" fill="currentColor" />
  </svg>
);

function ItemCard({ item, language, onEdit, onCompleteTask }: { item: CalendarItem; language: Language; onEdit: (task: Task) => void; onCompleteTask?: (id: string) => void }) {
  const { labels, users, tasks: allTasks } = useApp();
  const [showExpanded, setShowExpanded] = useState(false);
  const task = item.source;
  const assignedUser = task.assignedTo ? users.find((u) => u.id === task.assignedTo) : null;
  const assigneeColor = assignedUser ? entityColor(assignedUser.id) : undefined;
  const subtasks = (task.subtaskIds || [])
    .map((id) => allTasks.find((t) => t.id === id))
    .filter(Boolean) as Task[];
  const subtaskCount = subtasks.length;
  const completedSubtaskCount = subtasks.filter((s) => s.status === 'done').length;
  const hasLabels = task.labels.length > 0;
  const hasAssignee = !!task.assignedTo;
  const dateLabel = item.allDay
    ? toDateLabel(item.startTime, language)
    : `${toDateLabel(item.startTime, language)} ${toTimeLabel(item.startTime, language)}`;
  const repeatChipLabel = task.repeatInterval ? getRepeatChipLabel(task.repeatInterval, task.dueDate) : null;
  const hasPriority = !!task.priority && !!PRIORITY_COLORS[task.priority];

  return (
    <article className="mb-1 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm">
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={item.completed} onChange={() => onCompleteTask?.(item.id)} className="mt-1" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1">
            <h3 className={`text-sm font-semibold text-neutral-900 truncate flex-1 min-w-0 ${item.completed ? 'line-through text-neutral-400' : ''}`}>{item.title}</h3>
            <button type="button" onClick={(e) => { e.stopPropagation(); setShowExpanded(!showExpanded); }} className="flex-shrink-0 p-1 rounded-md hover:bg-neutral-100 text-neutral-500" aria-label={showExpanded ? 'Collapse' : 'Expand'}>
              {showExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {task.labels.map((labelId) => {
              const label = labels.find((l) => l.id === labelId);
              return label ? (
                <AttributeChip key={label.id} icon={<Tag className="w-3.5 h-3.5" />} label={label.name} color={label.color} />
              ) : null;
            })}
            {assignedUser && (
              <AttributeChip icon={<User className="w-3.5 h-3.5" />} label={getCompactUserName(assignedUser)} color={assigneeColor} />
            )}
            <span data-testid="calendar-date-chip"><AttributeChip icon={<CalendarDays className="w-3.5 h-3.5" />} label={dateLabel} color="#ea580c" /></span>
            {task.repeatInterval && repeatChipLabel && (
              <AttributeChip icon={<RotateCcw className="w-3.5 h-3.5" />} label={repeatChipLabel} color="#0f766e" maxWidthClassName="max-w-[92px]" />
            )}
            {hasPriority && (
              <AttributeChip icon={<Flag className="w-3.5 h-3.5" />} label={PRIORITY_LABELS[task.priority!] || task.priority!} color={PRIORITY_COLORS[task.priority!]} />
            )}
            {subtaskCount > 0 && (
              <AttributeChip icon={<SubtaskIcon className="w-3.5 h-3.5" />} label={`${completedSubtaskCount}/${subtaskCount}`} color="#8b5cf6" />
            )}
          </div>
        </div>
      </div>
      {showExpanded && (
        <div className="mt-2 pt-2 border-t border-neutral-100" onClick={(e) => e.stopPropagation()}>
          <InlineEventEditor event={task} language={language} onCancel={() => setShowExpanded(false)} onSave={() => { onEdit(task); setShowExpanded(false); }} onChange={(updated) => onEdit(updated)} onDelete={task.id ? (id) => { onEdit({ ...task, id }); setShowExpanded(false); } : undefined} expandedDefault />
        </div>
      )}
    </article>
  );
}

function getPeriodTitle(mode: CalendarViewMode, anchor: number, rangeStart: number, rangeEnd: number, language: Language) {
  if (mode === 'month') return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(anchor));
  if (mode === 'week') {
    const start = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(rangeStart));
    const end = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(rangeEnd));
    return `${start}–${end}`;
  }
  if (mode === 'day') return new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(anchor));
  return `${new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(rangeStart))}–${new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(rangeEnd))}`;
}

function InlineEventEditor({ event, language, onCancel, onChange, onSave, onDelete, error, isSaving, expandedDefault = false }: { event: Task; language: Language; onCancel: () => void; onChange?: (task: Task) => void; onSave: () => void; onDelete?: (id: string) => void; error?: string; isSaving?: boolean; expandedDefault?: boolean }) {
  const [draft, setDraft] = useState(event);
  const [expanded, setExpanded] = useState(expandedDefault);
  const updateDraft = (next: Task) => {
    setDraft(next);
    onChange?.(next);
  };

  return (
    <form data-testid="calendar-quick-add" className="mb-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm space-y-2">
      {error && <p role="alert" className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">{error}</p>}
      <div data-testid="calendar-time-row" className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold text-neutral-500">{t('calendar.startTime', language)}<input type="datetime-local" value={formatDateInputValue(draft.startTime)} onChange={(e) => updateDraft({ ...draft, startTime: parseDateInputValue(e.target.value) || draft.startTime })} className="mt-1 w-full rounded-xl border border-neutral-200 px-2 py-1.5 text-xs font-normal text-neutral-900" /></label>
        <label className="text-[11px] font-semibold text-neutral-500">{t('calendar.endTime', language)}<input type="datetime-local" value={formatDateInputValue(draft.endTime)} onChange={(e) => updateDraft({ ...draft, endTime: parseDateInputValue(e.target.value) || draft.endTime })} className="mt-1 w-full rounded-xl border border-neutral-200 px-2 py-1.5 text-xs font-normal text-neutral-900" /></label>
      </div>
      <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs font-semibold text-violet-700">{expanded ? t('calendar.fewerDetails', language) : t('calendar.moreDetails', language)}</button>
      {expanded && (
        <div className="space-y-2 border-t border-neutral-100 pt-2">
          <label className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" checked={!!draft.allDay} onChange={(e) => updateDraft({ ...draft, allDay: e.target.checked })} />{t('calendar.allDay', language)}</label>
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        {draft.id && onDelete && <button type="button" aria-label={t('common.delete', language)} onClick={() => onDelete(draft.id)} className="mr-auto rounded-xl bg-red-50 p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>}
        <button type="button" onClick={onSave} disabled={isSaving} aria-label={t('calendar.saveEvent', language)} className="rounded-xl bg-neutral-900 p-2 text-white hover:bg-neutral-700 disabled:opacity-50"><Save className="h-4 w-4" /></button>
        <button type="button" aria-label={t('common.cancel', language)} onClick={onCancel} className="rounded-xl bg-neutral-100 p-2 text-neutral-700"><X className="h-4 w-4" /></button>
      </div>
    </form>
  );
}
