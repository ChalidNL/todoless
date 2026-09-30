import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../AuthProvider';
import { useLanguage } from '../../context/LanguageContext';
import { t, formatDate, type Language } from '../../i18n/translations';
import { AppHeader } from '../shared/NewGlobalHeader';

import { TaskCard } from '../shared/TaskCard';
import type { Task } from '../../types';
import {
  addDays,
  addMonths,
  buildCalendarItems,
  calendarItemContinuesOnDay,
  calendarItemCoversDay,
  endOfLocalDay,
  getDefaultCalendarView,
  getStoredCalendarView,
  sameLocalDay,
  startOfLocalDay,
  startOfMonthGrid,
  startOfWeek,
  storeCalendarView,
  type CalendarItem,
  type CalendarView as CalendarViewMode,
} from '../../lib/calendar-utils';

/** Focus semantics shared with TasksView: explicit flag OR (due <24h AND high priority). */
const isDueWithin24h = (dueDate?: number): boolean => {
  if (!dueDate) return false;
  const now = Date.now();
  const diff = dueDate - now;
  return diff > 0 && diff <= 24 * 60 * 60 * 1000;
};

export function CalendarView() {
  const { tasks, addTask, appSettings, activeChipFilters, showCompletionMessage } = useApp();
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
  // Chip filters share Tasks semantics (filter = visible set). Status 'done'
  // yields no items because buildCalendarItems already excludes done tasks.
  const items = useMemo(() => {
    let result = allItems;
    for (const f of activeChipFilters) {
      switch (f.type) {
        case 'status':
          if (f.id === 'focus') result = result.filter((item) => !!item.source.focus || (isDueWithin24h(item.source.dueDate) && item.source.priority === 'high'));
          if (f.id === 'blocked') result = result.filter((item) => !!item.source.blocked);
          if (f.id === 'todo') result = result.filter((item) => item.source.status === 'todo' && !item.source.blocked);
          if (f.id === 'done') result = result.filter((item) => item.source.status === 'done');
          break;
        case 'label':
          result = result.filter((item) => item.source.labels.includes(f.id));
          break;
        case 'assignee':
          result = result.filter((item) => item.source.assignedTo === f.id);
          break;
        case 'priority':
          result = result.filter((item) => item.source.priority === f.id);
          break;
        case 'date':
          result = result.filter((item) => {
            if (!item.source.dueDate) return false;
            const ds = formatDate(item.source.dueDate, { month: 'short', day: 'numeric' });
            return ds === f.id;
          });
          break;
        case 'repeat':
          result = result.filter((item) => item.source.repeatInterval === f.id);
          break;
      }
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) result = result.filter((item) => item.title.toLowerCase().includes(query));
    return result;
  }, [allItems, searchQuery, activeChipFilters]);
  const selectedDayItems = useMemo(() => items.filter((item) => calendarItemCoversDay(item, selectedDay)), [items, selectedDay]);
  const views: CalendarViewMode[] = ['schedule', 'day', '3days', 'week', 'workweek', 'month'];

  const isTimeGridMode = mode === 'week' || mode === 'workweek' || mode === 'day' || mode === '3days';
  const periodTitle = getPeriodTitle(mode, anchor, range.start, range.end, language);
  const isTodayAnchor = sameLocalDay(anchor, Date.now());

  const openCreate = (day = selectedDay, hour?: number, titleOverride?: string) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    window.setTimeout(() => { creatingRef.current = false; }, 600);

    const title = (titleOverride ?? searchQuery).trim() || t('calendar.newEvent', language);
    const hasTimeContext = typeof hour === 'number';
    const start = new Date(day);
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
      startTime: hasTimeContext ? startMs : undefined,
      endTime: hasTimeContext ? startMs + 60 * 60 * 1000 : undefined,
      allDay: !hasTimeContext,
      showInCalendar: true,
    } as Omit<Task, 'id' | 'createdAt' | 'completedAt'>);
    setSearchQuery('');
    showCompletionMessage?.(t('inbox.taskAdded'));
  };

  const jump = (delta: number) => {
    if (mode === 'month') return setAnchor(addMonths(anchor, delta));
    if (mode === 'schedule') return setAnchor(addDays(anchor, delta * 7));
    if (mode === 'week' || mode === 'workweek') return setAnchor(addDays(anchor, delta * 7));
    if (mode === '3days') return setAnchor(addDays(anchor, delta * 3));
    setAnchor(addDays(anchor, delta));
  };

  return (
    <div className="app-shell-bg h-full min-h-0 flex flex-col">
      <div className="sticky top-0 z-40">
        <AppHeader
          screen="agenda"
          onAdd={(value) => openCreate(undefined, undefined, value)}
          onSearch={setSearchQuery}
          onAddEmpty={(value) => value ? openCreate(undefined, undefined, value) : openCreate(selectedDay)}
          showInputActions={false}
          showAdd={true}
          hideDateRepeatSections
          searchPlaceholder={t('calendar.searchPlaceholder', language)}
          type="calendar"
          count={items.length}
          sortValue={mode}
          onSortChange={(value) => { setMode(value as CalendarViewMode); setAnchor(startOfLocalDay(Date.now())); }}
          sortOptions={views.map((v) => ({ value: v, label: t(`calendar.${v}`, language) }))}
          sortAriaLabel={t('calendar.viewLabel', language)}
        />
      </div>
      <DateNavigator
        periodTitle={periodTitle}
        isTodayAnchor={isTodayAnchor}
        mode={mode}
        language={language}
        onToday={() => { const today = startOfLocalDay(Date.now()); setAnchor(today); setSelectedDay(today); }}
        onPrevious={() => jump(-1)}
        onNext={() => jump(1)}
      />

      {/* Only one scroll surface per view: time grids scroll inside their own
          surface (sticky day header), list/month views scroll this container. */}
      <div className={`flex-1 min-h-0 p-3 ${isTimeGridMode ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
        {mode === 'month' && <MonthGrid anchor={anchor} items={items} selectedDay={selectedDay} expandedTaskId={expandedCalendarTaskId} onExpandTask={setExpandedCalendarTaskId} onSelect={setSelectedDay} onCreate={openCreate} language={language} firstDayOfWeek={firstDayOfWeek} />}
        {mode === 'week' && <TimeGrid mode="week" start={range.start} items={items} onCreate={openCreate} language={language} />}
        {mode === 'day' && <TimeGrid mode="day" start={startOfLocalDay(anchor)} items={items} onCreate={openCreate} language={language} />}
        {mode === '3days' && <TimeGrid mode="3days" start={startOfLocalDay(anchor)} items={items} onCreate={openCreate} language={language} />}
        {mode === 'workweek' && <TimeGrid mode="workweek" start={range.start} items={items} onCreate={openCreate} language={language} />}
        {mode === 'schedule' && <AgendaList items={items} language={language} />}
        {mode === 'month' && <AgendaList items={selectedDayItems} language={language} compact expandedTaskId={expandedCalendarTaskId} />}
      </div>
    </div>
  );
}

function DateNavigator({ periodTitle, isTodayAnchor, language, onToday, onPrevious, onNext }: { periodTitle: string; isTodayAnchor: boolean; mode: CalendarViewMode; language: Language; onToday: () => void; onPrevious: () => void; onNext: () => void }) {
  return (
    <header className="flex-shrink-0 px-3 py-2">
      <div className="app-surface flex items-center gap-1.5 rounded-full px-2 py-1.5">
        <button type="button" onClick={onToday} aria-label={t('calendar.today', language)} className={`app-icon-button h-[var(--app-touch-target)] w-[var(--app-touch-target)] rounded-full ${isTodayAnchor ? 'bg-[var(--app-primary)] text-white shadow-sm' : 'bg-[var(--app-surface-2)]'}`}><CalendarDays className="w-3.5 h-3.5" /></button>
        <button type="button" aria-label={t('calendar.previous', language)} onClick={onPrevious} className="app-icon-button h-[var(--app-touch-target)] w-[var(--app-touch-target)] rounded-full bg-[var(--app-surface-2)]"><ChevronLeft className="w-3.5 h-3.5" /></button>
        <p data-testid="calendar-period-title" className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-[var(--app-text)]">{periodTitle}</p>
        <button type="button" aria-label={t('calendar.next', language)} onClick={onNext} className="app-icon-button h-[var(--app-touch-target)] w-[var(--app-touch-target)] rounded-full bg-[var(--app-surface-2)]"><ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
    </header>
  );
}

function MonthGrid({ anchor, items, selectedDay, expandedTaskId, onExpandTask, onSelect, onCreate, language, firstDayOfWeek }: { anchor: number; items: CalendarItem[]; selectedDay: number; expandedTaskId: string | null; onExpandTask: (id: string) => void; onSelect: (day: number) => void; onCreate: (day: number) => void; language: Language; firstDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 }) {
  const start = startOfMonthGrid(anchor, firstDayOfWeek);
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const month = new Date(anchor).getMonth();
  return (
    <section data-testid="calendar-month-grid" data-calendar-bounds className="app-surface overflow-hidden">
      <div className="grid grid-cols-7 text-[10px] font-semibold text-neutral-500 border-b border-neutral-100 bg-neutral-50">
        {days.slice(0, 7).map((day) => <div data-testid="calendar-month-weekday" key={day} className="p-1.5 text-center uppercase tracking-wide">{new Intl.DateTimeFormat(language, { weekday: 'short' }).format(new Date(day))}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayItems = items.filter((item) => calendarItemCoversDay(item, day));
          const active = sameLocalDay(day, selectedDay);
          return (
            <div key={day} onDoubleClick={() => onCreate(day)} className={`min-h-[clamp(78px,12vh,120px)] border-r border-b border-neutral-100/70 p-1 text-left align-top ${active ? 'bg-[var(--app-primary)]/10' : 'bg-[var(--app-surface)]'} ${new Date(day).getMonth() === month ? '' : 'opacity-60'}`}>
              <button type="button" onClick={() => onSelect(startOfLocalDay(day))} className="block text-left">
                <span data-testid={sameLocalDay(day, Date.now()) ? 'calendar-today' : undefined} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${sameLocalDay(day, Date.now()) ? 'border border-black bg-black text-white' : new Date(day).getMonth() === month ? 'text-neutral-800' : 'text-neutral-300'}`}>{new Date(day).getDate()}</span>
              </button>
              <div className="mt-1 space-y-1 overflow-visible">
                {dayItems.slice(0, 2).map((item) => (
                  <div
                    key={item.kind + item.id}
                    onClick={() => { onSelect(startOfLocalDay(day)); onExpandTask(item.id); }}
                  >
                    <AgendaTaskCard item={item} startExpanded={expandedTaskId === item.id} continued={calendarItemContinuesOnDay(item, day)} language={language} />
                  </div>
                ))}
                {dayItems.length > 2 && <span className="block text-[9px] font-semibold text-neutral-500">{t('calendar.moreCount').replace('{n}', String(dayItems.length - 2))}</span>}
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

function TimeGrid({ mode, start, items, onCreate, language }: { mode: 'week' | 'workweek' | 'day' | '3days'; start: number; items: CalendarItem[]; onCreate: (day: number, hour?: number, titleOverride?: string) => void; language: Language }) {
  const containerRef = useRef<HTMLElement>(null);
  const scrolledRef = useRef(false);
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

  const handleInlineCreate = (day: number, hour: number) => {
    const title = inlineTitle.trim();
    if (!title || inlineCreatingRef.current) return;
    inlineCreatingRef.current = true;
    window.setTimeout(() => { inlineCreatingRef.current = false; }, 600);
    onCreate(day, hour, title);
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
    <section ref={containerRef} data-testid={mode === 'week' ? 'calendar-week-time-grid' : mode === 'workweek' ? 'calendar-workweek-time-grid' : mode === '3days' ? 'calendar-3days-time-grid' : 'calendar-day-time-grid'} data-calendar-bounds className="app-surface min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
      <div className="sticky top-0 z-30 grid bg-white/95 backdrop-blur border-b border-neutral-100" style={{ gridTemplateColumns: `42px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="border-r border-neutral-100" />
        {days.map((day) => {
          const today = sameLocalDay(day, now);
          return (
            <div key={day} className={`min-w-0 px-0.5 py-1.5 text-center text-[11px] font-bold ${today ? 'bg-violet-50 text-violet-700' : 'text-neutral-700'}`}>
              <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{new Intl.DateTimeFormat(language, { weekday: 'short' }).format(new Date(day))}</span>
              <span className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1 text-xs ${today ? 'border-black bg-black text-white' : 'border-transparent'}`}>
                {new Date(day).getDate()}
              </span>
            </div>
          );
        })}
        <div className="col-start-2 col-end-[-1] grid border-t border-neutral-100" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day) => (
            <div key={day} className="min-h-7 min-w-0 border-r border-neutral-100 px-0.5 py-1">
              {allDayItems
                .filter((item) => calendarItemCoversDay(item, day))
                .slice(0, 2)
                .map((item) => <AgendaTaskCard key={item.kind + item.id} item={item} continued={calendarItemContinuesOnDay(item, day)} language={language} />)}
            </div>
          ))}
        </div>
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: `42px repeat(${days.length}, minmax(0, 1fr))`, minHeight: HOURS.length * HOUR_HEIGHT }}>
        <div className="border-r border-neutral-100 bg-neutral-50">
          {HOURS.map((hour) => <div key={hour} className="h-14 pr-1 text-right text-[10px] font-medium text-neutral-400">{String(hour).padStart(2, '0')}:00</div>)}
        </div>
        {days.map((day) => {
          const dayTimedItems = layoutOverlappingItems(timedItems.filter((item) => calendarItemCoversDay(item, day)));
          return (
            <div key={day} className={`relative min-w-0 border-r border-neutral-100 ${sameLocalDay(day, now) ? 'bg-violet-50/30' : ''}`}>
              {HOURS.map((hour) => {
                const isActive = inlineSlot?.day === day && inlineSlot?.hour === hour;
                if (isActive) {
                  return (
                    <div key={hour} className="absolute left-0 right-0 z-20" style={{ top: hour * HOUR_HEIGHT }}>
                      <input
                        autoFocus
                        type="text"
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleInlineCreate(day, hour); }
                          if (e.key === 'Escape') clearInline();
                        }}
                        onBlur={() => {
                          if (!inlineTitle.trim()) clearInline();
                        }}
                        placeholder={t('calendar.newEvent', language)}
                        className="w-full rounded-xl border-2 border-violet-400 bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-900 shadow-[0_4px_16px_rgba(99,102,241,0.2)] outline-none ring-2 ring-violet-300/50 placeholder:text-neutral-400"
                        style={{ boxSizing: 'border-box' }}
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
              {dayTimedItems.map((item) => <CalendarTaskSlot key={item.kind + item.id} item={item} day={day} language={language} />)}
            </div>
          );
        })}
        {showNowLine && (
          <div data-testid="calendar-now-line" className="pointer-events-none absolute left-0 right-0 z-[60] h-[2px] bg-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]" style={{ top: nowTop }}>
            <span data-testid="calendar-now-time-chip" className="absolute left-0 -top-2.5 rounded-sm bg-red-500 px-1 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm">{formatNowTime(now)}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function CalendarTaskSlot({ item, day, language }: { item: TimedLayout; day: number; language: Language }) {
  const dayStart = startOfLocalDay(day);
  const dayEnd = endOfLocalDay(day);
  // Clip the block to the current day so a multi-day timed entry renders a
  // per-day segment instead of one oversized block from its start day (GH#82).
  const segmentStart = Math.max(item.startTime, dayStart);
  const segmentEnd = Math.min(item.endTime || item.startTime + 60 * 60 * 1000, dayEnd);
  const startMinutes = Math.max(0, (segmentStart - dayStart) / 60000);
  const durationMinutes = Math.max(30, (segmentEnd - segmentStart) / 60000);
  const width = `${100 / item.columns}%`;
  const left = `${(100 / item.columns) * item.column}%`;
  const height = Math.min(Math.max(42, (durationMinutes / 60) * HOUR_HEIGHT), 24 * HOUR_HEIGHT);

  return (
    <div
      data-testid={`calendar-timed-task-${item.id}`}
      className="absolute z-20 overflow-visible text-left rounded-sm bg-violet-100"
      style={{ top: (startMinutes / 60) * HOUR_HEIGHT, left, width, height: `${height}px` }}
    >
      <AgendaTaskCard item={item} showTimeLabel continued={calendarItemContinuesOnDay(item, day)} language={language} />
    </div>
  );
}

function AgendaTaskCard({ item, startExpanded = false, showTimeLabel = false, continued = false, inline = false, language }: { item: CalendarItem; startExpanded?: boolean; showTimeLabel?: boolean; continued?: boolean; inline?: boolean; language: Language }) {
  const timeLabel = showTimeLabel && !item.allDay ? formatNowTime(item.startTime) : undefined;
  const card = <TaskCard task={item.source} showCheckbox={false} compact calendarBlock={!inline} startExpanded={startExpanded} calendarTimeLabel={timeLabel} hideDateChip />;
  if (!continued) return card;
  return (
    <div className="relative">
      {card}
      <span
        data-testid="calendar-continuation-marker"
        aria-label={t('calendar.continued', language)}
        className="pointer-events-none absolute left-0.5 top-0.5 z-10 rounded-sm bg-black/60 px-1 py-px text-[8px] font-bold leading-none text-white shadow-sm"
      >
        ↪
      </span>
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
  return <div data-testid="calendar-agenda-list" className={`space-y-1 ${compact ? 'mt-2' : ''}`}>{items.map((item) => <AgendaTaskCard key={`${item.kind}-${item.id}-${expandedTaskId === item.id ? 'expanded' : 'compact'}`} item={item} startExpanded={expandedTaskId === item.id} inline language={language} />)}</div>;
}


function formatNowTime(timestamp: number) {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
