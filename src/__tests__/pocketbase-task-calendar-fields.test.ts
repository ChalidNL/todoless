import { beforeEach, describe, expect, it, vi } from 'vitest';

// GH#79 — the task list and the calendar must agree about dates. The calendar
// creates tasks with start_time/end_time; the list editor changes only
// due_date. These tests pin the client serialization so calendar fields
// round-trip through create/update/fetch instead of being dropped.
const mocks = vi.hoisted(() => {
  const create = vi.fn(async (payload: Record<string, unknown>) => ({ id: 'task-1', ...payload }));
  const update = vi.fn(async (_id: string, payload: Record<string, unknown>) => ({ id: _id, ...payload }));
  const getFullList = vi.fn(async () => []);
  const authRefresh = vi.fn();
  const collection = vi.fn((name: string) => {
    if (name === 'users') return { authRefresh };
    if (name === 'tasks') return { create, update, getFullList };
    return {};
  });

  return {
    create,
    update,
    getFullList,
    authRefresh,
    collection,
    pb: {
      authStore: {
        isValid: true,
        record: { id: 'user-1' },
        model: { id: 'user-1' },
        token: 'token-1',
      },
      collection,
    },
  };
});

vi.mock('../lib/pocketbase', () => ({ pb: mocks.pb }));

import { api } from '../lib/pocketbase-client';

describe('GH#79 task calendar field persistence', () => {
  beforeEach(() => {
    mocks.create.mockClear();
    mocks.update.mockClear();
    mocks.getFullList.mockClear();
    mocks.authRefresh.mockClear();
    mocks.collection.mockClear();
    mocks.pb.authStore.isValid = true;
    mocks.pb.authStore.record = { id: 'user-1' };
    mocks.pb.authStore.model = { id: 'user-1' };
  });

  it('persists start_time/end_time/all_day when creating a timed calendar task', async () => {
    const dueDate = Date.parse('2026-09-24T10:00:00.000Z');
    const startTime = Date.parse('2026-09-24T10:00:00.000Z');
    const endTime = Date.parse('2026-09-24T10:30:00.000Z');

    await api.createTask({
      title: 'Calendar timed task',
      status: 'todo',
      blocked: false,
      dueDate,
      startTime,
      endTime,
      allDay: false,
      showInCalendar: true,
      labels: [],
      flag: false,
    });

    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      due_date: '2026-09-24T10:00:00.000Z',
      start_time: '2026-09-24T10:00:00.000Z',
      end_time: '2026-09-24T10:30:00.000Z',
      all_day: false,
      show_in_calendar: true,
    }));
  });

  it('creates all-day tasks with empty calendar times and all_day=true', async () => {
    const dueDate = Date.parse('2026-09-24T00:00:00.000Z');

    await api.createTask({
      title: 'Calendar all-day task',
      status: 'todo',
      blocked: false,
      dueDate,
      allDay: true,
      showInCalendar: true,
      labels: [],
      flag: false,
    });

    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      due_date: '2026-09-24T00:00:00.000Z',
      start_time: null,
      end_time: null,
      all_day: true,
    }));
  });

  it('persists start_time/end_time/all_day when updating a task', async () => {
    const startTime = Date.parse('2026-09-24T12:00:00.000Z');
    const endTime = Date.parse('2026-09-24T13:00:00.000Z');

    await api.updateTask('task-1', {
      startTime,
      endTime,
      allDay: false,
      showInCalendar: false,
    });

    expect(mocks.update).toHaveBeenCalledWith('task-1', expect.objectContaining({
      start_time: '2026-09-24T12:00:00.000Z',
      end_time: '2026-09-24T13:00:00.000Z',
      all_day: false,
      show_in_calendar: false,
    }));
  });

  it('still sends due_date:null when the list editor clears the due date', async () => {
    await api.updateTask('task-1', { dueDate: null });

    expect(mocks.update).toHaveBeenCalledWith('task-1', expect.objectContaining({
      due_date: null,
    }));
  });

  it('maps start_time/end_time/all_day back from fetched records', async () => {
    mocks.getFullList.mockResolvedValueOnce([{
      id: 'task-1',
      title: 'Calendar task',
      status: 'todo',
      blocked: false,
      due_date: '2026-09-24T10:00:00.000Z',
      start_time: '2026-09-24T08:00:00.000Z',
      end_time: '2026-09-24T09:00:00.000Z',
      all_day: false,
      show_in_calendar: true,
      created: '2026-09-24T07:00:00.000Z',
      user: 'user-1',
      labels: [],
    }]);

    const tasks = await api.getTasks();
    expect(tasks[0]).toMatchObject({
      startTime: Date.parse('2026-09-24T08:00:00.000Z'),
      endTime: Date.parse('2026-09-24T09:00:00.000Z'),
      allDay: false,
    });
  });
});