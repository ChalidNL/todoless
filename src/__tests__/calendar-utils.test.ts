import { describe, expect, it } from 'vitest';
import type { CalendarEvent, Task } from '../types';
import {
  buildCalendarItems,
  expandRecurringEvent,
  formatDateInputValue,
  getDefaultCalendarView,
  getStoredCalendarView,
  sameLocalDay,
  storeCalendarView,
} from '../lib/calendar-utils';

describe('calendar utilities', () => {
  it('keeps dated tasks in calendar as task items without duplicating events', () => {
    const day = new Date('2026-06-16T10:00:00.000Z').getTime();
    const tasks = [
      task({ id: 'task-1', title: 'Tandarts', dueDate: day }),
      task({ id: 'task-2', title: 'Verborgen', dueDate: day, showInCalendar: false }),
      task({ id: 'task-3', title: 'Geen datum' }),
    ];
    const events = [event({ id: 'event-1', title: 'School', startTime: day, endTime: day + 3600000 })];

    const items = buildCalendarItems({ events, tasks, rangeStart: startOfDay(day), rangeEnd: endOfDay(day) });

    expect(items.map((item) => `${item.kind}:${item.id}`)).toEqual(['event:event-1', 'task:task-1']);
  });

  it('expands RRULE events and skips EXDATE instances', () => {
    const base = event({
      id: 'event-1',
      title: 'Training',
      startTime: Date.parse('2026-06-16T08:00:00.000Z'),
      endTime: Date.parse('2026-06-16T09:00:00.000Z'),
      rrule: 'FREQ=WEEKLY;COUNT=3',
      exdates: ['2026-06-23T08:00:00.000Z'],
    });

    const expanded = expandRecurringEvent(base, Date.parse('2026-06-01T00:00:00.000Z'), Date.parse('2026-07-01T00:00:00.000Z'));

    expect(expanded.map((item) => new Date(item.startTime).toISOString())).toEqual([
      '2026-06-16T08:00:00.000Z',
      '2026-06-30T08:00:00.000Z',
    ]);
    expect(expanded.every((item) => item.recurrenceId)).toBe(true);
  });

  it('persists the last selected view per user with a safe fallback', () => {
    localStorage.clear();
    expect(getDefaultCalendarView(390, 844)).toBe('agenda');
    expect(getDefaultCalendarView(1280, 900)).toBe('month');

    storeCalendarView('user-a', 'week');
    expect(getStoredCalendarView('user-a', 'agenda')).toBe('week');

    localStorage.setItem('todoless_calendar_view_user-a', 'bad-value');
    expect(getStoredCalendarView('user-a', 'month')).toBe('month');
  });

  it('formats date input values and compares local days', () => {
    const value = Date.parse('2026-06-16T15:30:00.000Z');
    expect(formatDateInputValue(value)).toMatch(/^2026-06-16T/);
    expect(sameLocalDay(value, Date.parse('2026-06-16T23:00:00.000Z'))).toBe(true);
  });
});

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task',
    title: 'Task',
    status: 'todo',
    blocked: false,
    labels: [],
    flag: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  const startTime = Date.now();
  return {
    id: 'event',
    title: 'Event',
    startTime,
    endTime: startTime + 3600000,
    allDay: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

function startOfDay(timestamp: number) {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(timestamp: number) {
  const d = new Date(timestamp);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
