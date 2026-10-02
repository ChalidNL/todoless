import { useEffect, useRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../types';

// completed_by must name the person who ticked the box. The task card used to
// write the ASSIGNEE into it (and nothing at all for unassigned tasks); every
// other completion path (subtask toggles, drag to done, bulk actions) wrote
// nothing. Attribution now happens once, in AppContext.updateTask.

const { api, authState, bootstrap } = vi.hoisted(() => {
  const assignedToSomeoneElse = {
    id: 'task-1', title: 'Take out the bins', status: 'todo', blocked: false, flag: false, focus: false,
    labels: [], priority: 'medium', userId: 'user-1', assignedTo: 'user-2', createdAt: 1_700_000_000_000, isPrivate: false,
  };
  const alreadyDone = { ...assignedToSomeoneElse, id: 'task-2', title: 'Done yesterday', status: 'done', completedBy: 'user-2' };
  const bootstrap = {
    tasks: [assignedToSomeoneElse, alreadyDone], items: [], notes: [], labels: [], shops: [],
    users: [{ id: 'user-1', name: 'Me', email: 'me@example.test', role: 'owner' }, { id: 'user-2', name: 'Kid', email: 'kid@example.test', role: 'member' }],
    invites: [], reminders: [], settings: { id: 's1', currentUserId: 'user-1', language: 'en' },
  };
  const api = {
    getBootstrap: vi.fn(), getTasks: vi.fn(), getItems: vi.fn(), getSharedTasks: vi.fn(), getSharedItems: vi.fn(),
    getUsers: vi.fn(), getLabels: vi.fn(), getShops: vi.fn(), getInvites: vi.fn(), getReminders: vi.fn(), getNotes: vi.fn(), getSettings: vi.fn(),
    updateTask: vi.fn(), createTask: vi.fn(), createItem: vi.fn(), deleteTask: vi.fn(), deleteItem: vi.fn(), updateItem: vi.fn(),
  };
  const authState = { isValid: true, record: { id: 'user-1' }, model: { id: 'user-1' }, onChange: () => () => {}, clear: () => {} };
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
    collection: () => ({ subscribe: vi.fn().mockResolvedValue(undefined), unsubscribe: vi.fn().mockResolvedValue(undefined) }),
  },
}));

import { AppProvider, useApp } from '../context/AppContext';
import { CompactTaskCard } from '../components/shared/CompactTaskCard';

function RunOnceWhenReady({ run }: { run: (app: ReturnType<typeof useApp>) => void }) {
  const app = useApp();
  const fired = useRef(false);
  useEffect(() => {
    if (app.dataLoadState === 'ready' && app.tasks.length > 0 && !fired.current) {
      fired.current = true;
      run(app);
    }
  }, [app, run]);
  return null;
}

describe('completion is attributed to the current user', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.getBootstrap.mockResolvedValue(bootstrap);
    api.getTasks.mockResolvedValue(bootstrap.tasks);
    api.getItems.mockResolvedValue([]);
    api.getSharedTasks.mockResolvedValue(bootstrap.tasks);
    api.getSharedItems.mockResolvedValue([]);
    api.updateTask.mockResolvedValue({});
  });

  it('marking a task done records the current user, not the assignee', async () => {
    render(<AppProvider><RunOnceWhenReady run={(app) => app.updateTask('task-1', { status: 'done', completedAt: 123 })} /></AppProvider>);
    await waitFor(() => expect(api.updateTask).toHaveBeenCalledTimes(1));
    expect(api.updateTask).toHaveBeenCalledWith('task-1', { status: 'done', completedAt: 123, completedBy: 'user-1' });
  });

  it('moving a task out of done clears the completer', async () => {
    render(<AppProvider><RunOnceWhenReady run={(app) => app.updateTask('task-2', { status: 'todo', completedAt: undefined })} /></AppProvider>);
    await waitFor(() => expect(api.updateTask).toHaveBeenCalledTimes(1));
    const [, updates] = api.updateTask.mock.calls[0];
    expect(updates).toHaveProperty('completedBy', undefined);
  });

  it('an update that keeps a done task done leaves the original completer alone', async () => {
    render(<AppProvider><RunOnceWhenReady run={(app) => app.updateTask('task-2', { status: 'done', title: 'Renamed' })} /></AppProvider>);
    await waitFor(() => expect(api.updateTask).toHaveBeenCalledTimes(1));
    expect(api.updateTask.mock.calls[0][1]).not.toHaveProperty('completedBy');
  });

  it('an explicit completedBy is respected', async () => {
    render(<AppProvider><RunOnceWhenReady run={(app) => app.updateTask('task-1', { status: 'done', completedBy: 'user-2' })} /></AppProvider>);
    await waitFor(() => expect(api.updateTask).toHaveBeenCalledTimes(1));
    expect(api.updateTask.mock.calls[0][1]).toHaveProperty('completedBy', 'user-2');
  });
});

// The card itself must not decide who completed the task.
const useAppMock = vi.fn();
vi.mock('../context/AppContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('../context/AppContext')>();
  return { ...original, useApp: () => useAppMock() ?? original.useApp() };
});

describe('CompactTaskCard toggle', () => {
  it('does not write the assignee as the completer', async () => {
    const updateTask = vi.fn();
    const task: Task = { id: 'task-9', title: 'Assigned to the kid', status: 'todo', blocked: false, flag: false, labels: [], assignedTo: 'user-2', createdAt: Date.now() };
    useAppMock.mockReturnValue({
      labels: [], shops: [], tasks: [task],
      users: [{ id: 'user-1', name: 'Me', email: 'me@example.test', role: 'owner' }, { id: 'user-2', name: 'Kid', email: 'kid@example.test', role: 'member' }],
      updateTask, deleteTask: vi.fn(), addLabel: vi.fn(), addTask: vi.fn(), swapEntity: vi.fn(), toggleChipFilter: vi.fn(),
      isChipFilterActive: vi.fn(() => false), refreshEntries: vi.fn(), showCompletionMessage: vi.fn(), moveTaskToStatus: vi.fn(),
    });
    render(<CompactTaskCard task={task} />);
    fireEvent.click(screen.getByRole('button', { name: /mark as done/i }));
    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));
    const [, updates] = updateTask.mock.calls[0];
    expect(updates).toMatchObject({ status: 'done' });
    expect(updates).not.toHaveProperty('completedBy');
    useAppMock.mockReset();
  });
});
