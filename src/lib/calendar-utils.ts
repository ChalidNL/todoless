import { RRule, rrulestr } from 'rrule';
import type { Task, RepeatInterval } from '../types';

export type CalendarView = 'month' | 'week' | 'workweek' | 'day' | 'agenda';

export interface CalendarItem {
  id: string;
  kind: 'task';
  title: string;
  startTime: number;
  endTime: number;
  allDay: boolean;
  color?: string;
  source: Task;
  recurring?: boolean;
  recurrenceId?: string;
  completed?: boolean;
}

const VALID_VIEWS: CalendarView[] = ['month', 'week', 'workweek', 'day', 'agenda'];
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

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
  tasks,
  rangeStart,
  rangeEnd,
}: {
  tasks: Task[];
  rangeStart: number;
  rangeEnd: number;
}): CalendarItem[] {
  const visibleTasks = tasks.filter((task) => task.showInCalendar !== false);

  const recurringTasks = visibleTasks.filter((task) => task.repeatInterval);
  const nonRecurringTasks = visibleTasks.filter((task) => !task.repeatInterval);

  const recurringItems = recurringTasks.flatMap((task) =>
    expandRecurringTask(task, rangeStart, rangeEnd).map(taskToItem),
  );

  const nonRecurringItems = nonRecurringTasks
    .filter((task) => {
      const placement = getTaskCalendarPlacement(task);
      if (!placement) return false;
      if (!placement.allDay) return overlaps(placement.startTime, placement.endTime, rangeStart, rangeEnd);
      return overlaps(startOfLocalDay(placement.startTime), endOfLocalDay(placement.startTime), rangeStart, rangeEnd);
    })
    .map(taskToItem);

  return [...recurringItems, ...nonRecurringItems].sort(
    (a, b) => a.startTime - b.startTime || a.title.localeCompare(b.title),
  );
}

export function expandRecurringTask(task: Task, rangeStart: number, rangeEnd: number): Task[] {
  if (!task.repeatInterval) return [task];

  const startTime = task.startTime || task.dueDate;
  if (!startTime) return [task];

  const duration = task.startTime && task.endTime
    ? Math.max(0, task.endTime - task.startTime)
    : 0;

  // Prefer explicit recurrence_rule JSON field when present
  const rruleStr = (task as any).recurrenceRule
    ? (task as any).recurrenceRule
    : repeatIntervalToRRule(task.repeatInterval, task.dueDate || task.startTime);
  const rule = rrulestr(rruleStr, { dtstart: new Date(startTime) }) as RRule;

  return rule
    .between(new Date(rangeStart), new Date(rangeEnd), true)
    .map((date) => {
      const newStartTime = date.getTime();
      return {
        ...task,
        id: `${task.id}:${date.toISOString()}`,
        startTime: newStartTime,
        endTime: newStartTime + duration,
        dueDate: newStartTime,
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

function taskToItem(task: Task): CalendarItem {
  const placement = getTaskCalendarPlacement(task);
  if (!placement) {
    throw new Error(`Cannot build calendar item for undated task ${task.id}`);
  }

  if (placement.allDay) {
    return {
      id: task.id,
      kind: 'task',
      title: task.title,
      startTime: startOfLocalDay(placement.startTime),
      endTime: startOfLocalDay(placement.startTime),
      allDay: true,
      color: '#8B5CF6',
      source: task,
      completed: task.status === 'done',
      recurring: !!task.repeatInterval,
    };
  }

  return {
    id: task.id,
    kind: 'task',
    title: task.title,
    startTime: placement.startTime,
    endTime: placement.endTime,
    allDay: false,
    color: '#8B5CF6',
    source: task,
    completed: task.status === 'done',
    recurring: !!task.repeatInterval,
  };
}

function getTaskCalendarPlacement(task: Task): { startTime: number; endTime: number; allDay: boolean } | null {
  const timestamp = task.startTime ?? task.dueDate;
  if (!timestamp) return null;

  const allDay = task.allDay === true || !hasClockTime(timestamp);
  if (allDay) {
    return { startTime: timestamp, endTime: timestamp, allDay: true };
  }

  return {
    startTime: timestamp,
    endTime: task.endTime && task.endTime > timestamp ? task.endTime : timestamp + DEFAULT_DURATION_MS,
    allDay: false,
  };
}

function hasClockTime(timestamp: number) {
  const d = new Date(timestamp);
  return d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0 || d.getMilliseconds() !== 0;
}

function overlaps(start: number, end: number, rangeStart: number, rangeEnd: number) {
  return start <= rangeEnd && end >= rangeStart;
}

function storageKey(userId: string) {
  return `todoless_calendar_view_${userId}`;
}

function repeatIntervalToRRule(interval: RepeatInterval, referenceDate: number | undefined): string {
  switch (interval) {
    case 'day':
      return 'FREQ=DAILY';
    case 'week':
      return 'FREQ=WEEKLY';
    case 'month':
      return 'FREQ=MONTHLY';
    case 'year':
      return 'FREQ=YEARLY';
    case 'month_weekday': {
      if (!referenceDate) return 'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR'; // fallback
      const d = new Date(referenceDate);
      const weekdays = ['SU','MO','TU','WE','TH','FR','SA'];
      const wd = weekdays[d.getDay()];
      const nth = Math.ceil(d.getDate() / 7); // 1st, 2nd, 3rd, 4th
      return `FREQ=MONTHLY;BYDAY=${nth}${wd}`; // e.g. FREQ=MONTHLY;BYDAY=2WE
    }
    default:
      return 'FREQ=DAILY';
  }
}
