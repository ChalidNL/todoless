import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { getNextRecurringDate } from '../lib/repeat-schedule';
import { expandRecurringTask } from '../lib/calendar-utils';
import type { RepeatInterval, Task } from '../types';

// #256: the calendar preview and the server must agree on every occurrence.
// pb_hooks/lib/recurrence.js creates the real next task; repeat-schedule.ts
// is its copy for the client. Run both over every interval, date-only and
// timed anchors (incl. late evening, around both DST changes, month ends,
// 29 February) and a chain of occurrences, and require identical dates.
const require = createRequire(import.meta.url);
const server = require('../../pb_hooks/lib/recurrence.js') as {
  getNextRecurringDate: (interval: string, base: Date | string) => Date | null;
};

const INTERVALS: RepeatInterval[] = ['day', 'week', 'month', 'month_weekday', 'year'];
const TIMES = ['00:00:00.000Z', '07:30:00.000Z', '21:30:00.000Z', '23:15:00.000Z', '00:45:00.000Z', '01:30:00.000Z'];

function anchors(): string[] {
  const out: string[] = [];
  for (let day = Date.UTC(2026, 0, 1); day < Date.UTC(2028, 2, 2); day += 5 * 86_400_000) {
    const date = new Date(day).toISOString().slice(0, 10);
    for (const time of TIMES) out.push(`${date}T${time}`);
  }
  for (const date of ['2026-03-29', '2026-10-25', '2027-03-28', '2027-10-31', '2028-02-29', '2026-01-31', '2026-05-29']) {
    for (const time of TIMES) out.push(`${date}T${time}`);
  }
  return out;
}

describe('recurrence: client preview equals server (#256)', () => {
  it('computes the same chain of occurrences for every interval and anchor', () => {
    let compared = 0;
    for (const interval of INTERVALS) {
      for (const anchor of anchors()) {
        let clientDate: Date | null = new Date(anchor);
        let serverDate: Date | null = new Date(anchor);
        for (let step = 0; step < 14; step += 1) {
          clientDate = getNextRecurringDate(interval, clientDate!);
          serverDate = server.getNextRecurringDate(interval, serverDate!);
          if (clientDate?.toISOString() !== serverDate?.toISOString()) {
            throw new Error(`${interval} from ${anchor}, step ${step + 1}: client ${clientDate?.toISOString()} vs server ${serverDate?.toISOString()}`);
          }
          compared += 1;
        }
      }
    }
    expect(compared).toBeGreaterThan(10_000);
  });

  it('expands the calendar to exactly the dates the server will create', () => {
    const due = Date.parse('2026-05-29T00:00:00.000Z'); // fifth Friday of May
    const task = { id: 't', title: 'Fifth Friday', status: 'todo', dueDate: due, repeatInterval: 'month_weekday' } as unknown as Task;

    const expanded = expandRecurringTask(task, Date.parse('2026-05-01T00:00:00.000Z'), Date.parse('2026-10-01T00:00:00.000Z'));

    const expected: string[] = [];
    let next: Date | null = new Date(due);
    while (next && next.getTime() < Date.parse('2026-10-01T00:00:00.000Z')) {
      expected.push(next.toISOString());
      next = server.getNextRecurringDate('month_weekday', next);
    }
    expect(expanded.map((occurrence) => new Date(occurrence.dueDate!).toISOString())).toEqual(expected);
    // June has four Fridays: the server keeps the series on the last one.
    expect(expected).toContain('2026-06-26T00:00:00.000Z');
  });
});
