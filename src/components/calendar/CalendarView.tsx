import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, MapPin, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../AuthProvider';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../i18n/translations';
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
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
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

  const openCreate = (day = selectedDay) => {
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);
    const end = new Date(day);
    end.setHours(10, 0, 0, 0);
    setEditing({ id: '', title: '', startTime: start.getTime(), endTime: end.getTime(), allDay: false, color: MODULE_COLOR, createdAt: Date.now(), source: 'local' });
    setIsFormOpen(true);
  };

  const saveEvent = (event: CalendarEvent) => {
    if (event.id) updateCalendarEvent(event.id, event);
    else addCalendarEvent(event as Omit<CalendarEvent, 'id' | 'createdAt'>);
    setIsFormOpen(false);
    setEditing(null);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-neutral-50">
      <div className="sticky top-0 z-40">
        <AppHeader
          onSearch={setSearchQuery}
          onAddEmpty={() => openCreate()}
          searchPlaceholder={t('calendar.searchPlaceholder', language)}
          type="calendar"
        />
      </div>
      <header className="flex-shrink-0 bg-white border-b border-neutral-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setAnchor(addDays(anchor, mode === 'month' ? -28 : mode === 'agenda' ? -7 : -1))} className="p-2 rounded-xl bg-neutral-100 text-neutral-700"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => { const today = startOfLocalDay(Date.now()); setAnchor(today); setSelectedDay(today); }} className="px-3 py-2 rounded-xl bg-neutral-100 text-xs font-semibold text-neutral-700">{t('calendar.today', language)}</button>
          <button onClick={() => setAnchor(addDays(anchor, mode === 'month' ? 28 : mode === 'agenda' ? 7 : 1))} className="p-2 rounded-xl bg-neutral-100 text-neutral-700"><ChevronRight className="w-4 h-4" /></button>
          <div className="ml-auto grid grid-cols-4 rounded-xl bg-neutral-100 p-1 text-xs font-semibold">
            {views.map((view) => (
              <button key={view} onClick={() => setMode(view)} className={`px-2 py-1.5 rounded-lg ${mode === view ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>
                {t(`calendar.${view}`, language)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-2">
        {mode === 'month' && <MonthGrid anchor={anchor} items={items} selectedDay={selectedDay} onSelect={setSelectedDay} onCreate={openCreate} language={language} />}
        {mode === 'week' && <WeekGrid start={range.start} items={items} onEdit={(event) => { setEditing(event); setIsFormOpen(true); }} language={language} />}
        {mode === 'day' && <AgendaList items={selectedItems} language={language} onEdit={(event) => { setEditing(event); setIsFormOpen(true); }} onCompleteTask={(id) => updateTask(id, { status: 'done' })} />}
        {mode === 'agenda' && <AgendaList items={items} language={language} onEdit={(event) => { setEditing(event); setIsFormOpen(true); }} onCompleteTask={(id) => updateTask(id, { status: 'done' })} />}
        {mode === 'month' && <AgendaList items={selectedItems} language={language} compact onEdit={(event) => { setEditing(event); setIsFormOpen(true); }} onCompleteTask={(id) => updateTask(id, { status: 'done' })} />}
      </main>

      {isFormOpen && editing && (
        <EventForm event={editing} language={language} onCancel={() => setIsFormOpen(false)} onSave={saveEvent} onDelete={(id) => { deleteCalendarEvent(id); setIsFormOpen(false); }} />
      )}
    </div>
  );
}

function MonthGrid({ anchor, items, selectedDay, onSelect, onCreate, language }: { anchor: number; items: CalendarItem[]; selectedDay: number; onSelect: (day: number) => void; onCreate: (day: number) => void; language: string }) {
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
            <button key={day} onDoubleClick={() => onCreate(day)} onClick={() => onSelect(startOfLocalDay(day))} className={`min-h-[58px] border-r border-b border-neutral-100 p-1 text-left ${active ? 'bg-violet-50' : ''}`}>
              <span className={`text-xs font-semibold ${new Date(day).getMonth() === month ? 'text-neutral-800' : 'text-neutral-300'}`}>{new Date(day).getDate()}</span>
              <div className="mt-1 flex flex-wrap gap-0.5">
                {dayItems.slice(0, 4).map((item) => <span key={item.kind + item.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />)}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function WeekGrid({ start, items, onEdit, language }: { start: number; items: CalendarItem[]; onEdit: (event: CalendarEvent) => void; language: string }) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  return <div className="grid grid-cols-7 gap-1 min-h-full">{days.map((day) => <div key={day} className="bg-white rounded-xl border border-neutral-200 p-1"><div className="text-[11px] font-bold text-neutral-700 mb-1">{toDateLabel(day, language)}</div>{items.filter((item) => sameLocalDay(item.startTime, day)).map((item) => <ItemCard key={item.kind + item.id} item={item} language={language} onEdit={onEdit} />)}</div>)}</div>;
}

function AgendaList({ items, language, compact, onEdit, onCompleteTask }: { items: CalendarItem[]; language: string; compact?: boolean; onEdit: (event: CalendarEvent) => void; onCompleteTask: (id: string) => void }) {
  if (!items.length) return <div className="mt-2 bg-white rounded-2xl border border-neutral-200 p-6 text-center text-sm text-neutral-500">{t('calendar.noEvents', language)}</div>;
  return <div className={`space-y-1 ${compact ? 'mt-2' : ''}`}>{items.map((item) => <ItemCard key={item.kind + item.id} item={item} language={language} onEdit={onEdit} onCompleteTask={onCompleteTask} />)}</div>;
}

function ItemCard({ item, language, onEdit, onCompleteTask }: { item: CalendarItem; language: string; onEdit: (event: CalendarEvent) => void; onCompleteTask?: (id: string) => void }) {
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

function EventForm({ event, language, onCancel, onSave, onDelete }: { event: CalendarEvent; language: string; onCancel: () => void; onSave: (event: CalendarEvent) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = useState(event);
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-3">
      <form onSubmit={(e) => { e.preventDefault(); onSave(draft); }} className="w-full max-w-md bg-white rounded-3xl p-4 shadow-xl space-y-3">
        <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={t('calendar.eventTitle', language)} className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-base font-semibold" required />
        <input value={draft.location || ''} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder={t('calendar.location', language)} className="w-full px-3 py-2 rounded-xl border border-neutral-200" />
        <textarea value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder={t('calendar.description', language)} className="w-full px-3 py-2 rounded-xl border border-neutral-200 min-h-20" />
        <label className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" checked={!!draft.allDay} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })} />{t('calendar.allDay', language)}</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-neutral-500">{t('calendar.startTime', language)}<input type="datetime-local" value={formatDateInputValue(draft.startTime)} onChange={(e) => setDraft({ ...draft, startTime: parseDateInputValue(e.target.value) || draft.startTime })} className="mt-1 w-full px-2 py-2 rounded-xl border border-neutral-200 text-neutral-900 font-normal" /></label>
          <label className="text-xs font-semibold text-neutral-500">{t('calendar.endTime', language)}<input type="datetime-local" value={formatDateInputValue(draft.endTime)} onChange={(e) => setDraft({ ...draft, endTime: parseDateInputValue(e.target.value) || draft.endTime })} className="mt-1 w-full px-2 py-2 rounded-xl border border-neutral-200 text-neutral-900 font-normal" /></label>
        </div>
        <input value={draft.rrule || ''} onChange={(e) => setDraft({ ...draft, rrule: e.target.value })} placeholder={t('calendar.repeat', language)} className="w-full px-3 py-2 rounded-xl border border-neutral-200 font-mono text-xs" />
        <div className="flex gap-2 pt-1">
          {draft.id && <button type="button" onClick={() => onDelete(draft.id)} className="p-2 rounded-xl bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>}
          <button type="button" onClick={onCancel} className="ml-auto px-4 py-2 rounded-xl bg-neutral-100 text-neutral-700 font-semibold">{t('common.cancel', language)}</button>
          <button type="submit" className="px-4 py-2 rounded-xl text-white font-semibold" style={{ backgroundColor: MODULE_COLOR }}>{t('common.save', language)}</button>
        </div>
      </form>
    </div>
  );
}
