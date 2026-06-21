import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../AuthProvider';
import { useLanguage } from '../../context/LanguageContext';
import { t, type Language } from '../../i18n/translations';
import { AppHeader } from '../shared/NewGlobalHeader';
import { SharedSelect } from '../shared/SharedSelect';
import { CompactTaskCard } from '../shared/CompactTaskCard';
import type { Task } from '../../types';
import {
  addDays,
  buildCalendarItems,
  endOfLocalDay,
  getDefaultCalendarView,
  getStoredCalendarView,
  sameLocalDay,
  startOfLocalDay,
  startOfMonthGrid,
  startOfWeek,
  storeCalendarView,
  toTimeLabel,
  type CalendarItem,
  type CalendarView as CalendarViewMode,
} from '../../lib/calendar-utils';

export function CalendarView() {
  const { tasks, addTask, appSettings, showCompletionMessage } = useApp();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [anchor, setAnchor] = useState(() => startOfLocalDay(Date.now()));
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay(Date.now()));
  const [mode, setMode] = useState<CalendarViewMode>(() => getStoredCalendarView((user as any)?.id, getDefaultCalendarView()));
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCalendarTaskId, setExpandedCalendarTaskId] = useState<string | null>(null);
  const creatingRef = useRef(false);
  const firstDayOfWeek = (appSettings?.sprintStartDay ?? 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  useEffect(() => {
    storeCalendarView((user as any)?.id, mode);
  }, [mode, user]);

  const range = useMemo(() => {
    if (mode === 'day') return { start: startOfLocalDay(anchor), end: endOfLocalDay(anchor) };
    if (mode === '3days') return { start: startOfLocalDay(anchor), end: endOfLocalDay(addDays(anchor, 2)) };
    if (mode === 'week') {
      const start = startOfWeek(anchor, firstDayOfWeek);
      return { start, end: endOfLocalDay(addDays(start, 6)) };
    }
    if (mode === 'month') {
      const start = startOfMonthGrid(anchor, firstDayOfWeek);
      return { start, end: endOfLocalDay(addDays(start, 41)) };
    }
    if (mode === 'workweek') {
      const weekStart = startOfWeek(anchor, firstDayOfWeek);
      const start = firstDayOfWeek === 0 ? addDays(weekStart, 1) : weekStart;
      return { start: startOfLocalDay(start), end: endOfLocalDay(addDays(start, 4)) };
    }
    return { start: startOfLocalDay(anchor), end: endOfLocalDay(addDays(anchor, 27)) };
  }, [anchor, firstDayOfWeek, mode]);

  const allItems = useMemo(() => buildCalendarItems({ tasks, rangeStart: range.start, rangeEnd: range.end }), [tasks, range]);
  const items = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allItems;
    return allItems.filter((item) => item.title.toLowerCase().includes(query));
  }, [allItems, searchQuery]);
  const selectedDayItems = useMemo(() => items.filter((item) => sameLocalDay(item.startTime, selectedDay)), [items, selectedDay]);
  const views: CalendarViewMode[] = ['schedule', 'day', '3days', 'week', 'workweek', 'month'];

  const periodTitle = getPeriodTitle(mode, anchor, range.start, range.end, language);
  const isTodayAnchor = sameLocalDay(anchor, Date.now());

  const openCreate = (day = selectedDay, hour?: number, titleOverride?: string) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    window.setTimeout(() => { creatingRef.current = false; }, 600);

    const title = (titleOverride ?? searchQuery).trim() || t('calendar.newEvent', language);
    const hasTimeContext = typeof hour === 'number';
    const start = hasTimeContext
      ? new Date(day)
      : titleOverride
        ? new Date(roundToNextQuarterHour(Date.now()))
        : new Date(day);
    if (hasTimeContext) {
      start.setHours(hour, 0, 0, 0);
    }
    const startMs = start.getTime();
    setSelectedDay(startOfLocalDay(startMs));
    addTask({
      title,
      status: 'todo',
      blocked: false,
      flag: false,
      labels: [],
      dueDate: startMs,
      startTime: hasTimeContext || titleOverride ? startMs : undefined,
      endTime: hasTimeContext || titleOverride ? startMs + 60 * 60 * 1000 : undefined,
      allDay: !hasTimeContext && !titleOverride,
      showInCalendar: true,
    } as Omit<Task, 'id' | 'createdAt' | 'completedAt'>);
    setSearchQuery('');
    showCompletionMessage?.(t('inbox.taskAdded'));
  };

  const jump = (delta: number) => {
    if (mode === 'month') return setAnchor(addDays(anchor, delta * 28));
    if (mode === 'schedule') return setAnchor(addDays(anchor, delta * 7));
    if (mode === 'week' || mode === 'workweek') return setAnchor(addDays(anchor, delta * 7));
    if (mode === '3days') return setAnchor(addDays(anchor, delta * 3));
    setAnchor(addDays(anchor, delta));
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-neutral-50">
      <div className="sticky top-0 z-40">
        <AppHeader
          onSearch={setSearchQuery}
          inputValue={searchQuery}
          onInputValueChange={setSearchQuery}
          onSubmitInput={(value) => openCreate(undefined, undefined, value)}
          onAddEmpty={(value) => value ? openCreate(undefined, undefined, value) : openCreate(selectedDay)}
          showInputActions={false}
          showAdd={true}
          searchPlaceholder={t('calendar.searchPlaceholder', language)}
          type="calendar"
        />
      </div>
      <header className="flex-shrink-0 bg-white border-b border-neutral-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { const today = startOfLocalDay(Date.now()); setAnchor(today); setSelectedDay(today); }} aria-label={t('calendar.today', language)} className={`p-2 rounded-xl ${isTodayAnchor ? 'bg-violet-600 text-white' : 'bg-neutral-100 text-neutral-700'}`}><CalendarDays className="w-4 h-4" /></button>
          <button type="button" aria-label={t('calendar.previous', language)} onClick={() => jump(-1)} className="p-2 rounded-xl bg-neutral-100 text-neutral-700"><ChevronLeft className="w-4 h-4" /></button>
          <p data-testid="calendar-period-title" className="min-w-0 flex-1 text-center text-sm font-bold text-neutral-900">{periodTitle}</p>
          <button type="button" aria-label={t('calendar.next', language)} onClick={() => jump(1)} className="p-2 rounded-xl bg-neutral-100 text-neutral-700"><ChevronRight className="w-4 h-4" /></button>
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
        {mode === 'month' && <MonthGrid anchor={anchor} items={items} selectedDay={selectedDay} expandedTaskId={expandedCalendarTaskId} onExpandTask={setExpandedCalendarTaskId} onSelect={setSelectedDay} onCreate={openCreate} language={language} firstDayOfWeek={firstDayOfWeek} />}
        {mode === 'week' && <TimeGrid mode="week" start={range.start} items={items} onCreate={openCreate} language={language} />}
        {mode === 'day' && <TimeGrid mode="day" start={startOfLocalDay(anchor)} items={items} onCreate={openCreate} language={language} />}
        {mode === '3days' && <TimeGrid mode="3days" start={startOfLocalDay(anchor)} items={items} onCreate={openCreate} language={language} />}
        {mode === 'workweek' && <TimeGrid mode="workweek" start={range.start} items={items} onCreate={openCreate} language={language} />}
        {mode === 'schedule' && <AgendaList items={items} language={language} />}
        {mode === 'month' && <AgendaList items={selectedDayItems} language={language} compact expandedTaskId={expandedCalendarTaskId} />}
      </main>
    </div>
  );
}

function MonthGrid({ anchor, items, selectedDay, expandedTaskId, onExpandTask, onSelect, onCreate, language, firstDayOfWeek }: { anchor: number; items: CalendarItem[]; selectedDay: number; expandedTaskId: string | null; onExpandTask: (id: string) => void; onSelect: (day: number) => void; onCreate: (day: number) => void; language: Language; firstDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 }) {
  const start = startOfMonthGrid(anchor, firstDayOfWeek);
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const month = new Date(anchor).getMonth();
  return (
    <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
      <div className="grid grid-cols-7 text-[10px] font-semibold text-neutral-500 border-b border-neutral-100 bg-neutral-50">
        {days.slice(0, 7).map((day) => <div data-testid="calendar-month-weekday" key={day} className="p-1.5 text-center uppercase tracking-wide">{new Intl.DateTimeFormat(language, { weekday: 'short' }).format(new Date(day))}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayItems = items.filter((item) => sameLocalDay(item.startTime, day));
          const active = sameLocalDay(day, selectedDay);
          return (
            <div key={day} onDoubleClick={() => onCreate(day)} className={`min-h-[clamp(78px,12vh,120px)] border-r border-b border-neutral-100 p-1 text-left align-top ${active ? 'bg-violet-50' : 'bg-white'} ${new Date(day).getMonth() === month ? '' : 'bg-neutral-50/70'}`}>
              <button type="button" onClick={() => onSelect(startOfLocalDay(day))} className="block text-left">
                <span data-testid={sameLocalDay(day, Date.now()) ? 'calendar-today' : undefined} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${sameLocalDay(day, Date.now()) ? 'border border-black bg-black text-white' : new Date(day).getMonth() === month ? 'text-neutral-800' : 'text-neutral-300'}`}>{new Date(day).getDate()}</span>
              </button>
              <div className="mt-1 space-y-0.5 overflow-hidden">
                {dayItems.slice(0, 3).map((item) => (
                  <button
                    key={item.kind + item.id}
                    type="button"
                    onClick={() => { onSelect(startOfLocalDay(day)); onExpandTask(item.id); }}
                    className={`block w-full truncate rounded-sm px-1.5 py-0.5 text-left text-[9px] font-semibold leading-tight ${expandedTaskId === item.id ? 'bg-violet-700 text-white' : 'bg-violet-100 text-violet-800'}`}
                  >
                    {item.title}
                  </button>
                ))}
                {dayItems.length > 3 && <span className="block text-[9px] font-semibold text-neutral-500">+{dayItems.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const HOUR_HEIGHT = 56;

type TimedLayout = CalendarItem & { column: number; columns: number };

function TimeGrid({ mode, start, items, onCreate, language }: { mode: 'week' | 'workweek' | 'day' | '3days'; start: number; items: CalendarItem[]; onCreate: (day: number, hour?: number) => void; language: Language }) {
  const containerRef = useRef<HTMLElement>(null);
  const scrolledRef = useRef(false);
  const { addTask } = useApp();
  const [inlineSlot, setInlineSlot] = useState<{ day: number; hour: number } | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const inlineCreatingRef = useRef(false);
  const days = Array.from({ length: mode === 'day' ? 1 : mode === 'workweek' ? 5 : mode === '3days' ? 3 : 7 }, (_, index) => addDays(start, index));
  const allDayItems = items.filter((item) => item.allDay);
  const timedItems = items.filter((item) => !item.allDay);
  const now = Date.now();
  const nowDate = new Date(now);
  const nowHours = nowDate.getHours() + nowDate.getMinutes() / 60;
  const showNowLine = days.some((day) => sameLocalDay(day, now));
  const nowTop = Math.min(Math.max(nowHours * HOUR_HEIGHT, 0), 24 * HOUR_HEIGHT);
  const dayMinWidth = mode === 'week' || mode === 'workweek' ? '112px' : '160px';

  const handleInlineCreate = (day: number, hour: number) => {
    const title = inlineTitle.trim();
    if (!title || inlineCreatingRef.current) return;
    inlineCreatingRef.current = true;
    window.setTimeout(() => { inlineCreatingRef.current = false; }, 600);
    const startMs = new Date(day);
    startMs.setHours(hour, 0, 0, 0);
    addTask({
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
    } as Omit<Task, 'id' | 'createdAt' | 'completedAt'>);
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
    <section ref={containerRef} data-testid={mode === 'week' ? 'calendar-week-time-grid' : mode === 'workweek' ? 'calendar-workweek-time-grid' : mode === '3days' ? 'calendar-3days-time-grid' : 'calendar-day-time-grid'} className="h-full min-h-[70vh] overflow-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="sticky top-0 z-30 grid bg-white/95 backdrop-blur border-b border-neutral-100" style={{ gridTemplateColumns: `42px repeat(${days.length}, minmax(${dayMinWidth}, 1fr))` }}>
        <div className="border-r border-neutral-100" />
        {days.map((day) => {
          const today = sameLocalDay(day, now);
          return (
            <div key={day} className={`px-1 py-2 text-center text-[11px] font-bold ${today ? 'bg-violet-50 text-violet-700' : 'text-neutral-700'}`}>
              <span className={`inline-flex items-center justify-center rounded-full border px-2 py-1 ${today ? 'border-black bg-white text-black' : 'border-transparent'}`}>
                {new Intl.DateTimeFormat(language, { day: 'numeric', weekday: 'short' }).format(new Date(day))}
              </span>
            </div>
          );
        })}
        <div className="col-start-2 col-end-[-1] grid border-t border-neutral-100" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(${dayMinWidth}, 1fr))` }}>
          {days.map((day) => (
            <div key={day} className="min-h-7 border-r border-neutral-100 px-1 py-1">
              {allDayItems
                .filter((item) => sameLocalDay(item.startTime, day))
                .slice(0, 2)
                .map((item) => <CompactTaskCard key={item.kind + item.id} task={item.source} showCheckbox={false} compact />)}
            </div>
          ))}
        </div>
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: `42px repeat(${days.length}, minmax(${dayMinWidth}, 1fr))`, minHeight: HOURS.length * HOUR_HEIGHT }}>
        <div className="border-r border-neutral-100 bg-neutral-50">
          {HOURS.map((hour) => <div key={hour} className="h-14 pr-1 text-right text-[10px] font-medium text-neutral-400">{String(hour).padStart(2, '0')}:00</div>)}
        </div>
        {days.map((day) => {
          const dayTimedItems = layoutOverlappingItems(timedItems.filter((item) => sameLocalDay(item.startTime, day)));
          return (
            <div key={day} className={`relative border-r border-neutral-100 ${sameLocalDay(day, now) ? 'bg-violet-50/30' : ''}`}>
              {HOURS.map((hour) => {
                const isActive = inlineSlot?.day === day && inlineSlot?.hour === hour;
                if (isActive) {
                  return (
                    <div key={hour} className="absolute left-1 right-1 z-20" style={{ top: hour * HOUR_HEIGHT }}>
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
              {dayTimedItems.map((item) => <CalendarTaskSlot key={item.kind + item.id} item={item} language={language} />)}
            </div>
          );
        })}
        {showNowLine && (
          <div data-testid="calendar-now-line" className="pointer-events-none absolute left-0 right-0 z-40 h-0.5 bg-red-500" style={{ top: nowTop }}>
            <span data-testid="calendar-now-dot" className="absolute left-[36px] -top-1.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
          </div>
        )}
      </div>
    </section>
  );
}

function CalendarTaskSlot({ item, language }: { item: TimedLayout; language: Language }) {
  const start = new Date(item.startTime);
  const end = new Date(item.endTime || item.startTime + 60 * 60 * 1000);
  const startMinutes = Math.max(0, start.getHours() * 60 + start.getMinutes());
  const durationMinutes = Math.max(30, (end.getTime() - start.getTime()) / 60000);
  const width = `${100 / item.columns}%`;
  const left = `${(100 / item.columns) * item.column}%`;
  const height = Math.max(42, (durationMinutes / 60) * HOUR_HEIGHT);

  return (
    <div
      data-testid={`calendar-timed-task-${item.id}`}
      className="absolute z-10 pr-1"
      style={{ top: (startMinutes / 60) * HOUR_HEIGHT, left, width, height: `${height}px` }}
    >
      <div className="h-full min-h-0 overflow-visible rounded-sm text-left">
        <p className="mb-0.5 truncate rounded-sm bg-violet-700 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white">{toTimeLabel(item.startTime, language)}–{toTimeLabel(item.endTime, language)}</p>
        <CompactTaskCard task={item.source} showCheckbox={false} compact className="!rounded-sm border-violet-300 bg-violet-100 shadow-sm ring-1 ring-white/70" />
      </div>
    </div>
  );
}

function layoutOverlappingItems(items: CalendarItem[]): TimedLayout[] {
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime || a.title.localeCompare(b.title));
  const groups: CalendarItem[][] = [];
  let activeGroup: CalendarItem[] = [];
  let groupEnd = 0;

  for (const item of sorted) {
    if (!activeGroup.length || item.startTime < groupEnd) {
      activeGroup.push(item);
      groupEnd = Math.max(groupEnd, item.endTime);
    } else {
      groups.push(activeGroup);
      activeGroup = [item];
      groupEnd = item.endTime;
    }
  }
  if (activeGroup.length) groups.push(activeGroup);

  return groups.flatMap((group) => {
    const columnsEnd: number[] = [];
    const placed = group.map((item) => {
      const column = columnsEnd.findIndex((end) => end <= item.startTime);
      const useColumn = column === -1 ? columnsEnd.length : column;
      columnsEnd[useColumn] = item.endTime;
      return { ...item, column: useColumn, columns: 1 };
    });
    const columns = Math.max(1, columnsEnd.length);
    return placed.map((item) => ({ ...item, columns }));
  });
}

function AgendaList({ items, language, compact, expandedTaskId }: { items: CalendarItem[]; language: Language; compact?: boolean; expandedTaskId?: string | null }) {
  if (!items.length) return <div data-testid="calendar-agenda-list" className="mt-2 rounded-2xl border border-dashed border-neutral-200 bg-white/70 p-3 text-center text-xs text-neutral-400">{t('calendar.noEvents', language)}</div>;
  return <div data-testid="calendar-agenda-list" className={`space-y-1 ${compact ? 'mt-2' : ''}`}>{items.map((item) => <CompactTaskCard key={`${item.kind}-${item.id}-${expandedTaskId === item.id ? 'expanded' : 'compact'}`} task={item.source} showCheckbox={false} startExpanded={expandedTaskId === item.id} />)}</div>;
}

function roundToNextQuarterHour(timestamp: number) {
  const d = new Date(timestamp);
  const minutes = d.getMinutes();
  const nextQuarter = Math.ceil(minutes / 15) * 15;
  d.setMinutes(nextQuarter, 0, 0);
  if (nextQuarter === 60) {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  }
  return d.getTime();
}

function getPeriodTitle(mode: CalendarViewMode, anchor: number, rangeStart: number, rangeEnd: number, language: Language) {
  if (mode === 'month') return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(anchor));
  if (mode === 'week' || mode === 'workweek' || mode === '3days') {
    const start = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(rangeStart));
    const end = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(rangeEnd));
    return `${start}–${end}`;
  }
  if (mode === 'day') return new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(anchor));
  return `${new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(rangeStart))}–${new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(rangeEnd))}`;
}
