import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import {
  addMonths,
  buildCalendarItems,
  calendarItemContinuesOnDay,
  calendarItemCoversDay,
  expandRecurringTask,
  formatDateInputValue,
  getDefaultCalendarView,
  getStoredCalendarView,
  sameLocalDay,
  storeCalendarView,
  type CalendarItem,
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

it('addMonths moves by calendar month preserving the local day', () => {
    const jan15 = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
    expect(addMonths(jan15, 1)).toBe(new Date(2026, 1, 15, 0, 0, 0, 0).getTime());
    expect(addMonths(jan15, -1)).toBe(new Date(2025, 11, 15, 0, 0, 0, 0).getTime());
    expect(addMonths(jan15, 0)).toBe(jan15);
    // December → January crosses the year boundary.
    expect(addMonths(new Date(2026, 11, 10, 0, 0, 0, 0).getTime(), 1))
      .toBe(new Date(2027, 0, 10, 0, 0, 0, 0).getTime());
  });

  it('addMonths clamps to the target month last day instead of overflowing', () => {
    const jan31 = new Date(2026, 0, 31, 0, 0, 0, 0).getTime();
    expect(addMonths(jan31, 1)).toBe(new Date(2026, 1, 28, 0, 0, 0, 0).getTime());
    const jan31Leap = new Date(2024, 0, 31, 0, 0, 0, 0).getTime();
    expect(addMonths(jan31Leap, 1)).toBe(new Date(2024, 1, 29, 0, 0, 0, 0).getTime());
    expect(addMonths(new Date(2026, 2, 31, 0, 0, 0, 0).getTime(), -1))
      .toBe(new Date(2026, 1, 28, 0, 0, 0, 0).getTime());
  });

  it('covers every day a timed entry spans, not only its start day (GH#82)', () => {
    const friday1800 = new Date(2026, 8, 25, 18, 0, 0, 0).getTime();
    const sunday1800 = new Date(2026, 8, 27, 18, 0, 0, 0).getTime();
    const item: CalendarItem = {
      id: 'trip',
      kind: 'task',
      title: 'Trip',
      startTime: friday1800,
      endTime: sunday1800,
      allDay: false,
      source: task({ id: 'trip', title: 'Trip' }),
    };

    expect(calendarItemCoversDay(item, friday1800)).toBe(true);
    expect(calendarItemCoversDay(item, new Date(2026, 8, 26, 12, 0, 0, 0).getTime())).toBe(true);
    expect(calendarItemCoversDay(item, sunday1800)).toBe(true);
    expect(calendarItemCoversDay(item, new Date(2026, 8, 24, 12, 0, 0, 0).getTime())).toBe(false);
    expect(calendarItemCoversDay(item, new Date(2026, 8, 28, 12, 0, 0, 0).getTime())).toBe(false);

    // Continuation flag: middle and end days continue, the start day does not.
    expect(calendarItemContinuesOnDay(item, friday1800)).toBe(false);
    expect(calendarItemContinuesOnDay(item, new Date(2026, 8, 26, 12, 0, 0, 0).getTime())).toBe(true);
    expect(calendarItemContinuesOnDay(item, new Date(2026, 8, 27, 12, 0, 0, 0).getTime())).toBe(true);
  });

  it('keeps single-day all-day items on their own day only', () => {
    const friday = new Date(2026, 8, 25, 0, 0, 0, 0).getTime();
    const item: CalendarItem = {
      id: 'single',
      kind: 'task',
      title: 'Chore',
      startTime: friday,
      endTime: friday,
      allDay: true,
      source: task({ id: 'single', title: 'Chore' }),
    };

    expect(calendarItemCoversDay(item, new Date(2026, 8, 25, 12, 0, 0, 0).getTime())).toBe(true);
    expect(calendarItemCoversDay(item, new Date(2026, 8, 26, 12, 0, 0, 0).getTime())).toBe(false);
    expect(calendarItemContinuesOnDay(item, new Date(2026, 8, 25, 12, 0, 0, 0).getTime())).toBe(false);
  });

  it('covers all-day spans across their full range with exclusive ICS end semantics (GH#82)', () => {
    const friday = new Date(2026, 8, 25, 2, 0, 0, 0).getTime();
    const mondayExclusive = new Date(2026, 8, 28, 2, 0, 0, 0).getTime();
    const item: CalendarItem = {
      id: 'festival',
      kind: 'task',
      title: 'Festival',
      startTime: friday,
      endTime: mondayExclusive,
      allDay: true,
      source: task({ id: 'festival', title: 'Festival' }),
    };

    expect(calendarItemCoversDay(item, new Date(2026, 8, 25, 12, 0, 0, 0).getTime())).toBe(true);
    expect(calendarItemCoversDay(item, new Date(2026, 8, 26, 12, 0, 0, 0).getTime())).toBe(true);
    expect(calendarItemCoversDay(item, new Date(2026, 8, 27, 12, 0, 0, 0).getTime())).toBe(true);
    // Exclusive end: the Monday boundary day is not covered.
    expect(calendarItemCoversDay(item, new Date(2026, 8, 28, 12, 0, 0, 0).getTime())).toBe(false);
    expect(calendarItemCoversDay(item, new Date(2026, 8, 24, 12, 0, 0, 0).getTime())).toBe(false);
  });

  it('keeps multi-day all-day entries in ranges over their continuation days (GH#82)', () => {
    const friday = new Date(2026, 8, 25, 0, 0, 0, 0).getTime();
    const mondayExclusive = new Date(2026, 8, 28, 0, 0, 0, 0).getTime();
    const tasks = [task({ id: 'festival', title: 'Festival', dueDate: friday, allDay: true, endTime: mondayExclusive })];

    // Visible range covers only Saturday + Sunday: the entry must still appear.
    const weekend = buildCalendarItems({
      tasks,
      rangeStart: new Date(2026, 8, 26, 0, 0, 0, 0).getTime(),
      rangeEnd: new Date(2026, 8, 27, 23, 59, 59, 999).getTime(),
    });
    expect(weekend).toHaveLength(1);
    expect(weekend[0]).toMatchObject({ id: 'festival', allDay: true });
    expect(calendarItemCoversDay(weekend[0], new Date(2026, 8, 27, 12, 0, 0, 0).getTime())).toBe(true);

    // Visible range covers only the exclusive-end Monday: the entry is absent.
    const mondayOnly = buildCalendarItems({
      tasks,
      rangeStart: new Date(2026, 8, 28, 0, 0, 0, 0).getTime(),
      rangeEnd: new Date(2026, 8, 28, 23, 59, 59, 999).getTime(),
    });
    expect(mondayOnly).toHaveLength(0);
  });

  it('includes timed multi-day entries in ranges spanning their continuation days (GH#82)', () => {
    const friday1800 = new Date(2026, 8, 25, 18, 0, 0, 0).getTime();
    const sunday1800 = new Date(2026, 8, 27, 18, 0, 0, 0).getTime();
    const tasks = [task({ id: 'trip', title: 'Trip', dueDate: friday1800, startTime: friday1800, endTime: sunday1800 })];

    const items = buildCalendarItems({
      tasks,
      rangeStart: new Date(2026, 8, 26, 0, 0, 0, 0).getTime(),
      rangeEnd: new Date(2026, 8, 27, 23, 59, 59, 999).getTime(),
    });
    expect(items).toHaveLength(1);
    expect(calendarItemCoversDay(items[0], new Date(2026, 8, 26, 12, 0, 0, 0).getTime())).toBe(true);
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
