import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import {
  buildCalendarItems,
  expandRecurringTask,
  formatDateInputValue,
  getDefaultCalendarView,
  getStoredCalendarView,
  sameLocalDay,
  storeCalendarView,
} from '../lib/calendar-utils';

describe('calendar utilities', () => {
  it('keeps dated tasks in calendar as task items without duplicating events', () => {
    const day = new Date(2026, 5, 16, 0, 0, 0, 0).getTime();
    const timed = new Date(2026, 5, 16, 10, 0, 0, 0).getTime();
    const tasks = [
      task({ id: 'task-1', title: 'Tandarts', dueDate: day }),
      task({ id: 'task-2', title: 'Legacy false flag', dueDate: day, showInCalendar: false }),
      task({ id: 'task-3', title: 'Geen datum' }),
      task({ id: 'task-4', title: 'School', dueDate: timed, startTime: timed, endTime: timed + 3600000 }),
      task({ id: 'task-5', title: 'Done', status: 'done', dueDate: day }),
      task({ id: 'task-6', title: 'Archived', dueDate: day, archived: true }),
    ];

    const items = buildCalendarItems({ tasks, rangeStart: startOfDay(day), rangeEnd: endOfDay(day) });

    expect(items.map((item) => `${item.kind}:${item.id}`).sort()).toEqual(['task:task-1', 'task:task-2', 'task:task-4']);
  });

  it('shows live regression dated June tasks even when legacy showInCalendar is false', () => {
    const tasks = [
      task({ id: 'pakket', title: 'Pakket ophalen', dueDate: Date.parse('2026-06-04T22:00:00.000Z'), showInCalendar: false }),
      task({ id: 'rekening', title: 'Rekening betalen', dueDate: Date.parse('2026-06-21T16:00:00.000Z'), showInCalendar: false }),
      task({ id: 'dokter', title: 'Dokter bellen', dueDate: Date.parse('2026-06-27T22:00:00.000Z'), showInCalendar: false }),
    ];

    const items = buildCalendarItems({
      tasks,
      rangeStart: new Date(2026, 5, 1, 0, 0, 0, 0).getTime(),
      rangeEnd: new Date(2026, 5, 30, 23, 59, 59, 999).getTime(),
    });

    expect(items.map((item) => item.title)).toEqual(['Pakket ophalen', 'Rekening betalen', 'Dokter bellen']);
  });

  it('places Tasks-created dueDate-with-time records into the matching timed slot even when startTime is empty', () => {
    const sixAM = new Date(2026, 5, 20, 6, 0, 0, 0).getTime();
    const tasks = [task({ id: 'task-teat', title: 'Teat', dueDate: sixAM })];

    const items = buildCalendarItems({ tasks, rangeStart: startOfDay(sixAM), rangeEnd: endOfDay(sixAM) });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'task-teat', title: 'Teat', allDay: false, startTime: sixAM });
    expect(new Date(items[0].startTime!).getHours()).toBe(6);
  });

  it('keeps date-only tasks in the all-day row', () => {
    const midnight = new Date(2026, 5, 20, 0, 0, 0, 0).getTime();
    const tasks = [task({ id: 'task-all-day', title: 'All day', dueDate: midnight })];

    const items = buildCalendarItems({ tasks, rangeStart: startOfDay(midnight), rangeEnd: endOfDay(midnight) });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'task-all-day', allDay: true, startTime: startOfDay(midnight) });
  });

  it('expands recurring tasks and skips EXDATE instances', () => {
    const base = task({
      id: 'task-1',
      title: 'Training',
      dueDate: Date.parse('2026-06-16T08:00:00.000Z'),
      startTime: Date.parse('2026-06-16T08:00:00.000Z'),
      endTime: Date.parse('2026-06-16T09:00:00.000Z'),
      repeatInterval: 'week',
    });

    const expanded = expandRecurringTask(base, Date.parse('2026-06-01T00:00:00.000Z'), Date.parse('2026-07-01T00:00:00.000Z'));

    expect(expanded.map((item) => new Date(item.startTime).toISOString())).toEqual([
      '2026-06-16T08:00:00.000Z',
      '2026-06-23T08:00:00.000Z',
      '2026-06-30T08:00:00.000Z',
    ]);
    expect(expanded.every((item) => item.recurrenceId)).toBe(true);
  });

  it('persists the last selected view per user with a safe fallback', () => {
    localStorage.clear();
    expect(getDefaultCalendarView(390, 844)).toBe('schedule');
    expect(getDefaultCalendarView(1280, 900)).toBe('month');

    storeCalendarView('user-a', 'week');
    expect(getStoredCalendarView('user-a', 'schedule')).toBe('week');

    localStorage.setItem('todoless_calendar_view_user-a', 'bad-value');
    expect(getStoredCalendarView('user-a', 'month')).toBe('month');
  });

  it('formats date input values and compares local days', () => {
    const value = Date.parse('2026-06-16T15:30:00.000Z');
    expect(formatDateInputValue(value)).toMatch(/^2026-06-16T/);
    expect(sameLocalDay(value, Date.parse('2026-06-16T20:00:00.000Z'))).toBe(true);
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
