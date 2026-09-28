import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const update = vi.fn(async (_id: string, payload: Record<string, unknown>) => ({ id: _id, ...payload }));
  const getOne = vi.fn(async (id: string) => ({ id }));
  const authRefresh = vi.fn();
  const collection = vi.fn((name: string) => {
    if (name === 'users') return { authRefresh };
    if (name === 'tasks') return { update, getOne };
    return { update, getOne };
  });

  return {
    update,
    getOne,
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

/**
 * GH#80 / CERT2-TSK-001 — reopening a completed task left completed_at populated.
 *
 * The payload builder assigned `undefined` for falsy dates, so JSON.stringify
 * dropped the key and PocketBase never received a clearing instruction. These
 * tests assert on the PATCH payload itself, not component state.
 */
describe('PocketBase date-field clearing on update (GH#80 / CERT2-TSK-001)', () => {
  beforeEach(() => {
    mocks.update.mockClear();
    mocks.getOne.mockClear();
    mocks.authRefresh.mockClear();
    mocks.collection.mockClear();
    mocks.pb.authStore.isValid = true;
    mocks.pb.authStore.record = { id: 'user-1' };
    mocks.pb.authStore.model = { id: 'user-1' };
  });

  const lastPayload = () => mocks.update.mock.calls.at(-1)![1] as Record<string, unknown>;

  it('sends an explicit clearing value for completed_at when a task is reopened', async () => {
    await api.updateTask('task-1', { status: 'todo', completedAt: undefined, completedBy: undefined });

    const payload = lastPayload();
    expect(payload).toHaveProperty('completed_at');
    expect(payload.completed_at).toBeNull();
    expect(payload.status).toBe('todo');
    // The key must survive JSON serialisation — `undefined` would be dropped.
    expect(JSON.parse(JSON.stringify(payload))).toHaveProperty('completed_at', null);
  });

  it('still sends the ISO timestamp when a task is completed', async () => {
    const completedAt = Date.parse('2026-09-24T17:24:53.687Z');

    await api.updateTask('task-1', { status: 'done', completedAt });

    expect(lastPayload().completed_at).toBe('2026-09-24T17:24:53.687Z');
  });

  it('sends an explicit clearing value for archived_at when a task is unarchived', async () => {
    await api.updateTask('task-1', { archived: false, archivedAt: undefined });

    const payload = lastPayload();
    expect(payload).toHaveProperty('archived_at');
    expect(payload.archived_at).toBeNull();
    expect(JSON.parse(JSON.stringify(payload))).toHaveProperty('archived_at', null);
  });

  it('sends an explicit clearing value for delete_after when retention is lifted', async () => {
    await api.updateTask('task-1', { deleteAfter: undefined });

    const payload = lastPayload();
    expect(payload).toHaveProperty('delete_after');
    expect(payload.delete_after).toBeNull();
    expect(JSON.parse(JSON.stringify(payload))).toHaveProperty('delete_after', null);
  });

  it('clears archived_at and delete_after together while keeping set values intact', async () => {
    const archivedAt = Date.parse('2026-09-20T08:00:00.000Z');

    await api.updateTask('task-1', { archivedAt, deleteAfter: undefined });

    const payload = lastPayload();
    expect(payload.archived_at).toBe('2026-09-20T08:00:00.000Z');
    expect(payload.delete_after).toBeNull();
  });

  it('omits date keys entirely when the caller did not mention them', async () => {
    await api.updateTask('task-1', { title: 'Renamed only' });

    const payload = lastPayload();
    expect(payload).not.toHaveProperty('completed_at');
    expect(payload).not.toHaveProperty('archived_at');
    expect(payload).not.toHaveProperty('delete_after');
    expect(payload.title).toBe('Renamed only');
  });

  it('clears due dates on sibling collections that share the payload-builder bug', async () => {
    await api.updateItem('item-1', { dueDate: undefined });
    expect(lastPayload()).toHaveProperty('due_date', null);

    await api.updateNote('note-1', { dueDate: undefined });
    expect(lastPayload()).toHaveProperty('due_date', null);

    await api.updateProject('project-1', { dueDate: undefined });
    expect(lastPayload()).toHaveProperty('due_date', null);

    await api.updateGoal('goal-1', { completedAt: undefined });
    expect(lastPayload()).toHaveProperty('completed_at', null);

    await api.updateReminder('reminder-1', { dueDate: undefined, dismissedAt: undefined });
    const reminder = lastPayload();
    expect(reminder).toHaveProperty('due_date', null);
    expect(reminder).toHaveProperty('dismissed_at', null);
  });

  it('leaves sibling date keys off the wire when the caller did not supply them', async () => {
    // Sibling builders are object literals, so an unsupplied key is present-but-undefined
    // in the literal and dropped at serialisation. Assert on what actually reaches the API.
    const wire = () => JSON.parse(JSON.stringify(lastPayload()));

    await api.updateItem('item-1', { quantity: 3 });
    expect(wire()).not.toHaveProperty('due_date');

    await api.updateGoal('goal-1', { title: 'Goal' });
    expect(wire()).not.toHaveProperty('completed_at');
  });
});