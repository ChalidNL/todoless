import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, MapPin, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../AuthProvider';
import { useLanguage } from '../../context/LanguageContext';
import { t, type Language } from '../../i18n/translations';
import { AppHeader } from '../shared/NewGlobalHeader';
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

  useEffect(() => {
    storeCalendarView((user as any)?.id, mode);
  }, [mode, user]);

  const range = useMemo(() => {
    if (mode === 'day') return { start: startOfLocalDay(anchor), end: endOfLocalDay(anchor) };
    if (mode === 'week') return { start: startOfLocalDay(addDays(anchor, -((new Date(anchor).getDay() + 6) % 7))), end: endOfLocalDay(addDays(anchor, 6 - ((new Date(anchor).getDay() + 6) % 7))) };
    if (mode === 'month') return { start: startOfMonthGrid(anchor), end: endOfLocalDay(addDays(startOfMonthGrid(anchor), 41)) };
    return { start: startOfLocalDay(Date.now()), end: endOfLocalDay(addDays(Date.now(), 60)) };
  }, [anchor, mode]);

  const allItems = useMemo(() => buildCalendarItems({ events: calendarEvents, tasks, rangeStart: range.start, rangeEnd: range.end }), [calendarEvents, tasks, range]);
  const items = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allItems;
    return allItems.filter((item) => {
      const event = item.kind === 'event' ? (item.source as CalendarEvent) : null;
      return item.title.toLowerCase().includes(query) || (event?.location || '').toLowerCase().includes(query);
    });
  }, [allItems, searchQuery]);
  const selectedItems = items.filter((item) => sameLocalDay(item.startTime, selectedDay));
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

  const openCreate = (day = selectedDay, hour = 9) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    setSelectedDay(startOfLocalDay(start.getTime()));
    setQuickAdd(draftEvent(start.getTime()));
    setEditing(null);
  };

  const saveEvent = (event: CalendarEvent) => {
    const cleaned = { ...event, title: event.title.trim() };
    if (!cleaned.title) return;
    if (cleaned.id) updateCalendarEvent(cleaned.id, cleaned);
    else addCalendarEvent(cleaned as Omit<CalendarEvent, 'id' | 'createdAt'>);
    setQuickAdd(null);
    setEditing(null);
  };

  const activeDraft = quickAdd ?? editing;
  const updateActiveDraft = (event: CalendarEvent) => {
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
          onAddEmpty={() => openCreate()}
          onInputValueChange={activeDraft ? (title) => updateActiveDraft({ ...activeDraft, title }) : undefined}
          onSubmitInput={activeDraft ? (title) => saveEvent({ ...activeDraft, title }) : undefined}
          onCancelInput={activeDraft ? closeActiveDraft : undefined}
          inputValue={activeDraft ? activeDraft.title : undefined}
          submitAriaLabel={t('calendar.saveEvent', language)}
          searchPlaceholder={activeDraft ? t('calendar.newEvent', language) : t('calendar.searchPlaceholder', language)}
          type="calendar"
          showAdd={!activeDraft}
        />
      </div>
      <header className="flex-shrink-0 bg-white border-b border-neutral-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <button type="button" aria-label={t('calendar.previous', language)} onClick={() => setAnchor(addDays(anchor, mode === 'month' ? -28 : mode === 'agenda' ? -7 : -1))} className="p-2 rounded-xl bg-neutral-100 text-neutral-700"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" onClick={() => { const today = startOfLocalDay(Date.now()); setAnchor(today); setSelectedDay(today); }} className="px-3 py-2 rounded-xl bg-neutral-100 text-xs font-semibold text-neutral-700">{t('calendar.today', language)}</button>
          <button type="button" aria-label={t('calendar.next', language)} onClick={() => setAnchor(addDays(anchor, mode === 'month' ? 28 : mode === 'agenda' ? 7 : 1))} className="p-2 rounded-xl bg-neutral-100 text-neutral-700"><ChevronRight className="w-4 h-4" /></button>
          <p data-testid="calendar-period-title" className="min-w-0 flex-1 truncate text-sm font-bold text-neutral-900">{periodTitle}</p>
          <select
            aria-label={t('calendar.viewLabel', language)}
            id="calendar-view-select"
            value={mode}
            onChange={(event) => setMode(event.target.value as CalendarViewMode)}
            className="rounded-xl border border-neutral-200 bg-white px-2 py-2 text-xs font-semibold text-neutral-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            {views.map((view) => <option key={view} value={view}>{t(`calendar.${view}`, language)}</option>)}
          </select>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-2">
        {quickAdd && <InlineEventEditor event={quickAdd} language={language} onCancel={() => setQuickAdd(null)} onChange={setQuickAdd} />}
        {editing && <InlineEventEditor event={editing} language={language} onCancel={() => setEditing(null)} onChange={setEditing} onDelete={(id) => { deleteCalendarEvent(id); setEditing(null); }} expandedDefault />}
        {mode === 'month' && <MonthGrid anchor={anchor} items={items} selectedDay={selectedDay} onSelect={setSelectedDay} onCreate={openCreate} language={language} />}
        {mode === 'week' && <TimeGrid mode="week" start={range.start} items={items} onEdit={setEditing} onCreate={openCreate} language={language} />}
        {mode === 'day' && <TimeGrid mode="day" start={startOfLocalDay(anchor)} items={selectedItems} onEdit={setEditing} onCreate={openCreate} language={language} onCompleteTask={(id) => updateTask(id, { status: 'done' })} />}
        {mode === 'agenda' && <AgendaList items={items} language={language} onEdit={setEditing} onCompleteTask={(id) => updateTask(id, { status: 'done' })} />}
        {mode === 'month' && <AgendaList items={selectedItems} language={language} compact onEdit={setEditing} onCompleteTask={(id) => updateTask(id, { status: 'done' })} />}
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
              <span data-testid={sameLocalDay(day, Date.now()) ? 'calendar-today' : undefined} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${sameLocalDay(day, Date.now()) ? 'bg-violet-600 text-white' : new Date(day).getMonth() === month ? 'text-neutral-800' : 'text-neutral-300'}`}>{new Date(day).getDate()}</span>
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
  const nowTop = ((nowDate.getHours() - 7) * 60 + nowDate.getMinutes()) / 60 * HOUR_HEIGHT;
  const showNowLine = days.some((day) => sameLocalDay(day, now)) && nowTop >= 0 && nowTop <= HOURS.length * HOUR_HEIGHT;

  return (
    <section data-testid={mode === 'week' ? 'calendar-week-time-grid' : 'calendar-day-time-grid'} className="h-full min-h-[70vh] overflow-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="sticky top-0 z-10 grid bg-white/95 backdrop-blur border-b border-neutral-100" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(${mode === 'week' ? '48px' : '180px'}, 1fr))` }}>
        <div className="border-r border-neutral-100" />
        {days.map((day) => {
          const today = sameLocalDay(day, now);
          return (
            <div key={day} className={`px-1 py-2 text-center text-[11px] font-bold ${today ? 'bg-violet-50 text-violet-700' : 'text-neutral-700'}`}>
              <span className={`inline-flex items-center justify-center rounded-full px-2 py-1 ${today ? 'bg-violet-600 text-white' : ''}`}>
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
  return (
    <article onClick={() => item.kind === 'event' && onEdit(item.source as CalendarEvent)} className="mb-1 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm active:scale-[0.99] transition-transform">
      <div className="flex items-start gap-2">
        {item.kind === 'task' ? <input type="checkbox" checked={item.completed} onChange={() => onCompleteTask?.(item.id)} className="mt-1" /> : <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[11px] text-neutral-500"><Clock className="w-3 h-3" />{item.allDay ? t('calendar.allDay', language) : toTimeLabel(item.startTime, language)}</div>
          <h3 className={`text-sm font-semibold text-neutral-900 truncate ${item.completed ? 'line-through text-neutral-400' : ''}`}>{item.title}</h3>
          {item.kind === 'task' && <p className="text-[11px] text-sky-600">{t('calendar.datedTask', language)}</p>}
          {item.kind === 'event' && (item.source as CalendarEvent).location && <p className="text-[11px] text-neutral-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{(item.source as CalendarEvent).location}</p>}
        </div>
      </div>
    </article>
  );
}

function getPeriodTitle(mode: CalendarViewMode, anchor: number, rangeStart: number, rangeEnd: number, language: Language) {
  const monthYear = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' });
  if (mode === 'month') return monthYear.format(new Date(anchor));
  if (mode === 'week') {
    const start = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(rangeStart));
    const end = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(rangeEnd));
    return `${start}–${end}`;
  }
  if (mode === 'day') return new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(anchor));
  return `${new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(rangeStart))}–${new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(rangeEnd))}`;
}

function InlineEventEditor({ event, language, onCancel, onChange, onDelete, expandedDefault = false }: { event: CalendarEvent; language: Language; onCancel: () => void; onChange?: (event: CalendarEvent) => void; onDelete?: (id: string) => void; expandedDefault?: boolean }) {
  const [draft, setDraft] = useState(event);
  const [expanded, setExpanded] = useState(expandedDefault);
  const updateDraft = (next: CalendarEvent) => {
    setDraft(next);
    onChange?.(next);
  };

  return (
    <form data-testid="calendar-quick-add" className="mb-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm space-y-2">
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
      <div className="flex gap-2">
        {draft.id && onDelete && <button type="button" aria-label={t('common.delete', language)} onClick={() => onDelete(draft.id)} className="rounded-xl bg-red-50 p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>}
        <button type="button" onClick={onCancel} className="ml-auto rounded-xl bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-700">{t('common.cancel', language)}</button>
      </div>
    </form>
  );
}
