import { RRule, rrulestr } from 'rrule';
import type { CalendarEvent, Task } from '../types';

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

export interface CalendarItem {
  id: string;
  kind: 'event' | 'task';
  title: string;
  startTime: number;
  endTime: number;
  allDay: boolean;
  color?: string;
  source: CalendarEvent | Task;
  recurring?: boolean;
  recurrenceId?: string;
  completed?: boolean;
}

const VALID_VIEWS: CalendarView[] = ['month', 'week', 'day', 'agenda'];

export function getDefaultCalendarView(width = window.innerWidth, height = window.innerHeight): CalendarView {
  if (width < 640) return width > height ? 'week' : 'agenda';
  if (width < 1024) return 'week';
  return 'month';
}

export function getStoredCalendarView(userId: string | undefined, fallback: CalendarView): CalendarView {
  if (!userId) return fallback;
  const stored = localStorage.getItem(storageKey(userId));
  return VALID_VIEWS.includes(stored as CalendarView) ? (stored as CalendarView) : fallback;
}

export function storeCalendarView(userId: string | undefined, view: CalendarView) {
  if (!userId) return;
  localStorage.setItem(storageKey(userId), view);
}

export function buildCalendarItems({
  events,
  tasks,
  rangeStart,
  rangeEnd,
}: {
  events: CalendarEvent[];
  tasks: Task[];
  rangeStart: number;
  rangeEnd: number;
}): CalendarItem[] {
  const eventItems = events.flatMap((event) => event.rrule
    ? expandRecurringEvent(event, rangeStart, rangeEnd).map(eventToItem)
    : overlaps(event.startTime, event.endTime || event.startTime, rangeStart, rangeEnd) ? [eventToItem(event)] : []);

  const taskItems = tasks
    .filter((task) => task.dueDate && task.showInCalendar !== false)
    .filter((task) => overlaps(task.dueDate!, task.dueDate!, rangeStart, rangeEnd))
    .map(taskToItem);

  return [...eventItems, ...taskItems].sort((a, b) => a.startTime - b.startTime || a.title.localeCompare(b.title));
}

export function expandRecurringEvent(event: CalendarEvent, rangeStart: number, rangeEnd: number): CalendarEvent[] {
  if (!event.rrule) return [event];
  const duration = Math.max(0, (event.endTime || event.startTime) - event.startTime);
  const rule = rrulestr(event.rrule, { dtstart: new Date(event.startTime) }) as RRule;
  const exdateSet = new Set((event.exdates || []).map((date) => new Date(date).getTime()));

  return rule
    .between(new Date(rangeStart), new Date(rangeEnd), true)
    .filter((date) => !exdateSet.has(date.getTime()))
    .map((date) => {
      const startTime = date.getTime();
      return {
        ...event,
        id: `${event.id}:${date.toISOString()}`,
        startTime,
        endTime: startTime + duration,
        recurrenceId: date.toISOString(),
      };
    });
}

export function sameLocalDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export function startOfLocalDay(timestamp: number) {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfLocalDay(timestamp: number) {
  const d = new Date(timestamp);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function startOfMonthGrid(timestamp: number) {
  const first = new Date(timestamp);
  first.setDate(1);
  first.setHours(0, 0, 0, 0);
  const offset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - offset);
  return first.getTime();
}

export function addDays(timestamp: number, days: number) {
  const d = new Date(timestamp);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function formatDateInputValue(timestamp: number) {
  const d = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateInputValue(value: string) {
  return value ? new Date(value).getTime() : undefined;
}

export function toDateLabel(timestamp: number, locale = 'en') {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(timestamp));
}

export function toTimeLabel(timestamp: number, locale = 'en') {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

function eventToItem(event: CalendarEvent): CalendarItem {
  return {
    id: event.id,
    kind: 'event',
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime || event.startTime,
    allDay: !!event.allDay,
    color: event.color || '#8B5CF6',
    source: event,
    recurring: !!event.rrule,
    recurrenceId: event.recurrenceId,
  };
}

function taskToItem(task: Task): CalendarItem {
  const startTime = task.dueDate!;
  return {
    id: task.id,
    kind: 'task',
    title: task.title,
    startTime,
    endTime: startTime,
    allDay: true,
    color: task.status === 'done' ? '#94a3b8' : '#0ea5e9',
    source: task,
    completed: task.status === 'done',
  };
}

function overlaps(start: number, end: number, rangeStart: number, rangeEnd: number) {
  return start <= rangeEnd && end >= rangeStart;
}

function storageKey(userId: string) {
  return `todoless_calendar_view_${userId}`;
}
