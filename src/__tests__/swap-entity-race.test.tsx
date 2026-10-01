import { useEffect, useRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// swapEntity (task <-> grocery, live from the task and grocery cards) used to
// fire the create of the copy and the delete of the original as two
// independent calls. When the create failed (validation, offline, 429) the
// original was already gone. The original must only go once the copy exists.

const { api, authState, bootstrap } = vi.hoisted(() => {
  const task = {
    id: 'task-1', title: 'Milk', status: 'todo', blocked: false, flag: false, focus: false,
    labels: [], priority: 'medium', userId: 'user-1', createdAt: 1_700_000_000_000, isPrivate: false,
  };
  const bootstrap = {
    tasks: [task], items: [], notes: [], labels: [], shops: [], users: [{ id: 'user-1', name: 'Me', email: 'me@example.test', role: 'owner' }],
    invites: [], reminders: [], settings: { id: 's1', currentUserId: 'user-1', language: 'en' },
  };
  const api = {
    getBootstrap: vi.fn(),
    getTasks: vi.fn(), getItems: vi.fn(), getSharedTasks: vi.fn(), getSharedItems: vi.fn(),
    getUsers: vi.fn(), getLabels: vi.fn(), getShops: vi.fn(), getInvites: vi.fn(), getReminders: vi.fn(),
    getNotes: vi.fn(), getSettings: vi.fn(),
    createTask: vi.fn(), createItem: vi.fn(), deleteTask: vi.fn(), deleteItem: vi.fn(),
    updateTask: vi.fn(), updateItem: vi.fn(),
  };
  const authState = {
    isValid: true,
    record: { id: 'user-1' },
    model: { id: 'user-1' },
    onChange: () => () => {},
    clear: () => {},
  };
  return { api, authState, bootstrap };
});

vi.mock('../lib/pocketbase-client', () => ({
  api,
  isInvalidOldPasswordError: () => false,
  normalizeItem: (r: unknown) => r,
  normalizeLabel: (r: unknown) => r,
  normalizeTask: (r: unknown) => r,
}));
vi.mock('../lib/pocketbase', () => ({
  pb: {
    authStore: authState,
    collection: () => ({
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { AppProvider, useApp } from '../context/AppContext';

function SwapOnReady({ id }: { id: string }) {
  const { entries, swapEntity, dataLoadState } = useApp();
  const present = entries.some((e) => e.id === id);
  const fired = useRef(false); // the context functions are not memoised; swap exactly once, like one click
  useEffect(() => {
    if (dataLoadState === 'ready' && present && !fired.current) {
      fired.current = true;
      swapEntity(id);
    }
  }, [dataLoadState, present, id, swapEntity]);
  return <div data-testid="state">{dataLoadState}</div>;
}

describe('swapEntity keeps the original until the copy exists', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.getBootstrap.mockResolvedValue(bootstrap);
    api.getTasks.mockResolvedValue(bootstrap.tasks);
    api.getItems.mockResolvedValue([]);
    api.getSharedTasks.mockResolvedValue(bootstrap.tasks);
    api.getSharedItems.mockResolvedValue([]);
    api.deleteTask.mockResolvedValue(undefined);
    api.deleteItem.mockResolvedValue(undefined);
  });

  it('does not delete the task when creating the grocery copy fails', async () => {
    api.createItem.mockRejectedValue(new Error('Failed to create record (429)'));
    render(<AppProvider><SwapOnReady id="task-1" /></AppProvider>);
    await waitFor(() => expect(api.createItem).toHaveBeenCalledTimes(1));
    // give a wrongly ordered implementation every chance to fire the delete
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(api.deleteTask).not.toHaveBeenCalled();
  });

  it('deletes the task only after the grocery copy was created', async () => {
    const order: string[] = [];
    api.createItem.mockImplementation(async () => { order.push('create'); return { id: 'item-1' }; });
    api.deleteTask.mockImplementation(async () => { order.push('delete'); });
    render(<AppProvider><SwapOnReady id="task-1" /></AppProvider>);
    await waitFor(() => expect(api.deleteTask).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['create', 'delete']);
    expect(api.createItem.mock.calls[0][0]).toMatchObject({ title: 'Milk', completed: false });
    expect(api.createItem.mock.calls[0][0]).not.toHaveProperty('id');
  });
});
