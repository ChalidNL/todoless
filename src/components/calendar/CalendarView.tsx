import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, RotateCcw, Save, Trash2, User, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../AuthProvider';
import { useLanguage } from '../../context/LanguageContext';
import { t, type Language } from '../../i18n/translations';
import { AppHeader } from '../shared/NewGlobalHeader';
import { SharedSelect } from '../shared/SharedSelect';
import { AttributeChip } from '../shared/AttributeChip';
import type { CalendarEvent } from '../../types';
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

const MODULE_COLOR = '#8B5CF6';

export function CalendarView() {
  const { calendarEvents, tasks, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, updateTask } = useApp();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [anchor, setAnchor] = useState(() => startOfLocalDay(Date.now()));
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay(Date.now()));
  const [mode, setMode] = useState<CalendarViewMode>(() => getStoredCalendarView((user as any)?.id, getDefaultCalendarView()));
  const [quickAdd, setQuickAdd] = useState<CalendarEvent | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const draftTitleRef = useRef('');
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    storeCalendarView((user as any)?.id, mode);
  }, [mode, user]);

  const range = useMemo(() => {
    if (mode === 'day') return { start: startOfLocalDay(anchor), end: endOfLocalDay(anchor) };
    if (mode === 'week') return { start: startOfLocalDay(addDays(anchor, -((new Date(anchor).getDay() + 6) % 7))), end: endOfLocalDay(addDays(anchor, 6 - ((new Date(anchor).getDay() + 6) % 7))) };
    if (mode === 'month') return { start: startOfMonthGrid(anchor), end: endOfLocalDay(addDays(startOfMonthGrid(anchor), 41)) };
    return { start: startOfLocalDay(Date.now()), end: endOfLocalDay(addDays(Date.now(), 60)) };
  }, [anchor, mode]);

  const combinedEvents = useMemo(() => {
    const remoteIds = new Set(calendarEvents.map((event) => event.id));
    return [...calendarEvents, ...localEvents.filter((event) => !remoteIds.has(event.id))];
  }, [calendarEvents, localEvents]);
  const allItems = useMemo(() => buildCalendarItems({ events: combinedEvents, tasks, rangeStart: range.start, rangeEnd: range.end }), [combinedEvents, tasks, range]);
  const items = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allItems;
    return allItems.filter((item) => {
      const event = item.kind === 'event' ? (item.source as CalendarEvent) : null;
      return item.title.toLowerCase().includes(query) || (event?.location || '').toLowerCase().includes(query);
    });
  }, [allItems, searchQuery]);
  const selectedItems = items.filter((item) => sameLocalDay(item.startTime, selectedDay));
  const visibleItemIds = new Set(items.map((item) => item.id));
  const pendingVisibleEvents = localEvents.filter((event) => !visibleItemIds.has(event.id));
  const views: CalendarViewMode[] = ['month', 'week', 'day', 'agenda'];

  const periodTitle = getPeriodTitle(mode, anchor, range.start, range.end, language);

  const draftEvent = (startTime: number): CalendarEvent => ({
    id: '',
    title: '',
    startTime,
    endTime: startTime + 60 * 60 * 1000,
    allDay: false,
    color: MODULE_COLOR,
    createdAt: Date.now(),
    source: 'local',
  });

  const openCreate = (day = selectedDay, hour = 9, title = searchQuery) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    setSelectedDay(startOfLocalDay(start.getTime()));
    const nextTitle = title.trim();
    draftTitleRef.current = nextTitle;
    setDraftTitle(nextTitle);
    setQuickAdd({ ...draftEvent(start.getTime()), title: nextTitle });
    setFormError('');
    setEditing(null);
  };

  const saveEvent = async (event: CalendarEvent) => {
    const cleaned = { ...event, title: event.title.trim() };
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
        setLocalEvents((prev) => prev.map((existing) => existing.id === cleaned.id ? cleaned : existing));
        setQuickAdd(null);
        setEditing(null);
        setSearchQuery('');
        await Promise.resolve(updateCalendarEvent(cleaned.id, cleaned));
      } else {
        const optimistic: CalendarEvent = { ...cleaned, id: `local-${Date.now()}`, createdAt: cleaned.createdAt || Date.now() };
        setLocalEvents((prev) => [...prev, optimistic]);
        setQuickAdd(null);
        setEditing(null);
        setSearchQuery('');
        void Promise.resolve(addCalendarEvent(cleaned as Omit<CalendarEvent, 'id' | 'createdAt'>))
          .catch(() => setFormError(t('calendar.saveFailed', language)));
      }
    } catch {
      setFormError(t('calendar.saveFailed', language));
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (event: CalendarEvent) => {
    draftTitleRef.current = event.title;
    setDraftTitle(event.title);
    setEditing(event);
    setFormError('');
  };

  const activeDraft = quickAdd ?? editing;
  const updateActiveDraft = (event: CalendarEvent) => {
    draftTitleRef.current = event.title;
    setDraftTitle(event.title);
    if (quickAdd) setQuickAdd(event);
    else setEditing(event);
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
          onSubmitInput={activeDraft ? (title) => { void saveEvent({ ...activeDraft, title }); } : undefined}
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
          <button type="button" aria-label={t('calendar.previous', language)} onClick={() => setAnchor(addDays(anchor, mode === 'month' ? -28 : mode === 'agenda' ? -7 : -1))} className="p-2 rounded-xl bg-neutral-100 text-neutral-700"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" onClick={() => { const today = startOfLocalDay(Date.now()); setAnchor(today); setSelectedDay(today); }} className="px-3 py-2 rounded-xl bg-neutral-100 text-xs font-semibold text-neutral-700">{t('calendar.today', language)}</button>
          <button type="button" aria-label={t('calendar.next', language)} onClick={() => setAnchor(addDays(anchor, mode === 'month' ? 28 : mode === 'agenda' ? 7 : 1))} className="p-2 rounded-xl bg-neutral-100 text-neutral-700"><ChevronRight className="w-4 h-4" /></button>
          <p data-testid="calendar-period-title" className="min-w-0 flex-1 truncate text-sm font-bold text-neutral-900">{periodTitle}</p>
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
        {!quickAdd && pendingVisibleEvents.map((event) => (
          <article key={`pending-${event.id}`} className="mb-1 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-900 truncate">{event.title}</h3>
          </article>
        ))}
        {quickAdd && <InlineEventEditor event={{ ...quickAdd, title: draftTitle }} language={language} onCancel={() => setQuickAdd(null)} onChange={setQuickAdd} error={formError} onSave={() => { void saveEvent({ ...quickAdd, title: draftTitleRef.current }); }} isSaving={isSaving} />}
        {editing && <InlineEventEditor event={{ ...editing, title: draftTitle }} language={language} onCancel={() => setEditing(null)} onChange={setEditing} onSave={() => { void saveEvent({ ...editing, title: draftTitleRef.current }); }} onDelete={(id) => { deleteCalendarEvent(id); setEditing(null); }} error={formError} isSaving={isSaving} expandedDefault />}
        {mode === 'month' && <MonthGrid anchor={anchor} items={items} selectedDay={selectedDay} onSelect={setSelectedDay} onCreate={openCreate} language={language} />}
        {mode === 'week' && <TimeGrid mode="week" start={range.start} items={items} onEdit={openEdit} onCreate={openCreate} language={language} />}
        {mode === 'day' && <TimeGrid mode="day" start={startOfLocalDay(anchor)} items={selectedItems} onEdit={openEdit} onCreate={openCreate} language={language} onCompleteTask={(id) => updateTask(id, { status: 'done' })} />}
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
              <span data-testid={sameLocalDay(day, Date.now()) ? 'calendar-today' : undefined} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1 text-xs font-semibold ${sameLocalDay(day, Date.now()) ? 'border-black bg-white text-black' : new Date(day).getMonth() === month ? 'border-transparent text-neutral-800' : 'border-transparent text-neutral-300'}`}>{new Date(day).getDate()}</span>
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

const HOURS = Array.from({ length: 16 }, (_, index) => index + 7);
const HOUR_HEIGHT = 56;

function TimeGrid({ mode, start, items, onEdit, onCreate, onCompleteTask, language }: { mode: 'week' | 'day'; start: number; items: CalendarItem[]; onEdit: (event: CalendarEvent) => void; onCreate: (day: number, hour?: number) => void; onCompleteTask?: (id: string) => void; language: Language }) {
  const days = Array.from({ length: mode === 'week' ? 7 : 1 }, (_, index) => addDays(start, index));
  const allDayItems = items.filter((item) => item.allDay);
  const timedItems = items.filter((item) => !item.allDay);
  const now = Date.now();
  const nowDate = new Date(now);
  const showNowLine = days.some((day) => sameLocalDay(day, now));
  const nowTop = Math.min(Math.max(((new Date(now).getHours() - HOURS[0]) + new Date(now).getMinutes() / 60) * HOUR_HEIGHT, 0), HOURS.length * HOUR_HEIGHT);

  return (
    <section data-testid={mode === 'week' ? 'calendar-week-time-grid' : 'calendar-day-time-grid'} className="h-full min-h-[70vh] overflow-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="sticky top-0 z-10 grid bg-white/95 backdrop-blur border-b border-neutral-100" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(${mode === 'week' ? '48px' : '180px'}, 1fr))` }}>
        <div className="border-r border-neutral-100" />
        {days.map((day) => {
          const today = sameLocalDay(day, now);
          return (
            <div key={day} className={`px-1 py-2 text-center text-[11px] font-bold ${today ? 'bg-violet-50 text-violet-700' : 'text-neutral-700'}`}>
              <span className={`inline-flex items-center justify-center rounded-full border px-2 py-1 ${today ? 'border-black bg-white text-black' : 'border-transparent'}`}>
                {new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric' }).format(new Date(day))}
              </span>
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
            {HOURS.map((hour) => <button key={hour} type="button" data-testid={`calendar-slot-${String(hour).padStart(2, '0')}`} onClick={() => onCreate(day, hour)} className="block h-14 w-full border-b border-neutral-100 text-left focus:outline-none focus:ring-2 focus:ring-violet-300" />)}
            {timedItems.filter((item) => sameLocalDay(item.startTime, day)).map((item) => <TimedEvent key={item.kind + item.id} item={item} onEdit={onEdit} onCompleteTask={onCompleteTask} />)}
          </div>
        ))}
        {showNowLine && <div data-testid="calendar-now-line" className="pointer-events-none absolute left-11 right-0 z-20 h-0.5 bg-violet-600" style={{ top: nowTop }} />}
      </div>
    </section>
  );
}

function CompactEvent({ item, onEdit, onCompleteTask }: { item: CalendarItem; onEdit: (event: CalendarEvent) => void; onCompleteTask?: (id: string) => void }) {
  return (
    <button type="button" onClick={() => item.kind === 'event' ? onEdit(item.source as CalendarEvent) : onCompleteTask?.(item.id)} className="mb-0.5 w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold text-white" style={{ backgroundColor: item.color }}>
      {item.title}
    </button>
  );
}

function TimedEvent({ item, onEdit, onCompleteTask }: { item: CalendarItem; onEdit: (event: CalendarEvent) => void; onCompleteTask?: (id: string) => void }) {
  const start = new Date(item.startTime);
  const end = new Date(item.endTime || item.startTime + 60 * 60 * 1000);
  const startMinutes = Math.max(0, (start.getHours() - 7) * 60 + start.getMinutes());
  const durationMinutes = Math.max(30, (end.getTime() - start.getTime()) / 60000);
  return (
    <button
      type="button"
      onClick={() => item.kind === 'event' ? onEdit(item.source as CalendarEvent) : onCompleteTask?.(item.id)}
      className="absolute left-1 right-1 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
      style={{ top: (startMinutes / 60) * HOUR_HEIGHT, minHeight: 28, height: (durationMinutes / 60) * HOUR_HEIGHT, backgroundColor: item.color }}
    >
      <span className="block truncate">{item.title}</span>
    </button>
  );
}

function AgendaList({ items, language, compact, onEdit, onCompleteTask }: { items: CalendarItem[]; language: Language; compact?: boolean; onEdit: (event: CalendarEvent) => void; onCompleteTask: (id: string) => void }) {
  if (!items.length) return <div data-testid="calendar-agenda-list" className="mt-2 rounded-2xl border border-dashed border-neutral-200 bg-white/70 p-3 text-center text-xs text-neutral-400">{t('calendar.noEvents', language)}</div>;
  return <div data-testid="calendar-agenda-list" className={`space-y-1 ${compact ? 'mt-2' : ''}`}>{items.map((item) => <ItemCard key={item.kind + item.id} item={item} language={language} onEdit={onEdit} onCompleteTask={onCompleteTask} />)}</div>;
}

function ItemCard({ item, language, onEdit, onCompleteTask }: { item: CalendarItem; language: Language; onEdit: (event: CalendarEvent) => void; onCompleteTask?: (id: string) => void }) {
  const event = item.kind === 'event' ? (item.source as CalendarEvent) : null;
  return (
    <article onClick={() => event && onEdit(event)} className="mb-1 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm active:scale-[0.99] transition-transform">
      <div className="flex items-start gap-2">
        {item.kind === 'task' ? <input type="checkbox" checked={item.completed} onChange={() => onCompleteTask?.(item.id)} className="mt-1" /> : <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />}
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className={`text-sm font-semibold text-neutral-900 truncate ${item.completed ? 'line-through text-neutral-400' : ''}`}>{item.title}</h3>
          <div className="flex flex-wrap gap-1">
            <span data-testid="calendar-date-chip"><AttributeChip compact={false} icon={<CalendarDays className="w-3.5 h-3.5" />} label={`${toDateLabel(item.startTime, language)}${item.allDay ? '' : ` ${toTimeLabel(item.startTime, language)}`}`} color="#0ea5e9" /></span>
            {event?.createdBy && <AttributeChip icon={<User className="w-3.5 h-3.5" />} label={event.createdBy} color="#64748b" />}
            {event?.location && <AttributeChip icon={<MapPin className="w-3.5 h-3.5" />} label={event.location} color="#16a34a" />}
            {event?.rrule && <AttributeChip icon={<RotateCcw className="w-3.5 h-3.5" />} label={t('calendar.repeat', language)} color="#f97316" />}
            {item.kind === 'task' && <AttributeChip icon={<Clock className="w-3.5 h-3.5" />} label={t('calendar.datedTask', language)} color="#0ea5e9" />}
          </div>
        </div>
      </div>
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

function InlineEventEditor({ event, language, onCancel, onChange, onSave, onDelete, error, isSaving, expandedDefault = false }: { event: CalendarEvent; language: Language; onCancel: () => void; onChange?: (event: CalendarEvent) => void; onSave: () => void; onDelete?: (id: string) => void; error?: string; isSaving?: boolean; expandedDefault?: boolean }) {
  const [draft, setDraft] = useState(event);
  const [expanded, setExpanded] = useState(expandedDefault);
  const updateDraft = (next: CalendarEvent) => {
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
          <input value={draft.location || ''} onChange={(e) => updateDraft({ ...draft, location: e.target.value })} placeholder={t('calendar.location', language)} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          <textarea value={draft.description || ''} onChange={(e) => updateDraft({ ...draft, description: e.target.value })} placeholder={t('calendar.description', language)} className="min-h-16 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" checked={!!draft.allDay} onChange={(e) => updateDraft({ ...draft, allDay: e.target.checked })} />{t('calendar.allDay', language)}</label>
          <input value={draft.rrule || ''} onChange={(e) => updateDraft({ ...draft, rrule: e.target.value })} placeholder={t('calendar.repeat', language)} className="w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs" />
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
