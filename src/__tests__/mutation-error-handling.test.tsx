import { useEffect, useRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The fire-and-forget mutation helpers (updateItem, deleteItem, updateLabel,
// deleteShop, ...) awaited the request and then a refresh with no catch. A
// failed request ended as an unhandled promise rejection: nothing logged in
// a useful place, no refresh, no message - the UI kept whatever optimistic
// state it had until the next resync.

const { api, authState, bootstrap } = vi.hoisted(() => {
  const item = { id: 'item-1', title: 'Milk', completed: false, labels: [], quantity: 1, userId: 'user-1', createdAt: 1_700_000_000_000, isPrivate: false };
  const bootstrap = {
    tasks: [], items: [item], notes: [], labels: [{ id: 'label-1', name: 'Home', color: '#000', visibility: 'family' }], shops: [],
    users: [{ id: 'user-1', name: 'Me', email: 'me@example.test', role: 'owner' }],
    invites: [], reminders: [], settings: { id: 's1', currentUserId: 'user-1', language: 'en' },
  };
  const api = {
    getBootstrap: vi.fn(), getTasks: vi.fn(), getItems: vi.fn(), getSharedTasks: vi.fn(), getSharedItems: vi.fn(),
    getUsers: vi.fn(), getLabels: vi.fn(), getShops: vi.fn(), getInvites: vi.fn(), getReminders: vi.fn(), getNotes: vi.fn(), getSettings: vi.fn(),
    updateItem: vi.fn(), deleteItem: vi.fn(), updateLabel: vi.fn(), updateTask: vi.fn(), createTask: vi.fn(), createItem: vi.fn(), deleteTask: vi.fn(),
  };
  const authState = { isValid: true, record: { id: 'user-1' }, model: { id: 'user-1' }, onChange: () => () => {}, clear: () => {} };
  return { api, authState, bootstrap };
});

vi.mock('../lib/pocketbase-client', () => ({
  api, isInvalidOldPasswordError: () => false,
  normalizeItem: (r: unknown) => r, normalizeLabel: (r: unknown) => r, normalizeTask: (r: unknown) => r,
}));
vi.mock('../lib/pocketbase', () => ({
  pb: { authStore: authState, collection: () => ({ subscribe: vi.fn().mockResolvedValue(undefined), unsubscribe: vi.fn().mockResolvedValue(undefined) }) },
}));

import { AppProvider, useApp } from '../context/AppContext';

function RunOnceWhenReady({ run }: { run: (app: ReturnType<typeof useApp>) => void }) {
  const app = useApp();
  const fired = useRef(false);
  useEffect(() => {
    if (app.dataLoadState === 'ready' && app.items.length > 0 && !fired.current) {
      fired.current = true;
      run(app);
    }
  }, [app, run]);
  return <span data-testid="msg">{app.completionMessage ?? ''}</span>;
}

describe('failed mutations are handled, not dropped', () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (event: PromiseRejectionEvent) => { unhandled.push(event.reason); event.preventDefault(); };

  beforeEach(() => {
    unhandled.length = 0;
    window.addEventListener('unhandledrejection', onUnhandled);
    for (const fn of Object.values(api)) fn.mockReset();
    api.getBootstrap.mockResolvedValue(bootstrap);
    api.getTasks.mockResolvedValue([]);
    api.getItems.mockResolvedValue(bootstrap.items);
    api.getSharedTasks.mockResolvedValue([]);
    api.getSharedItems.mockResolvedValue(bootstrap.items);
    api.getLabels.mockResolvedValue(bootstrap.labels);
    api.getNotes.mockResolvedValue([]);
  });

  it('a failing deleteItem is logged, followed by a re-read, and reported once', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.deleteItem.mockRejectedValue(new Error('Failed to delete record (403)'));
    const { findByTestId } = render(<AppProvider><RunOnceWhenReady run={(app) => app.deleteItem('item-1')} /></AppProvider>);
    await waitFor(() => expect(api.deleteItem).toHaveBeenCalledTimes(1));
    // re-read happens even though the request failed (reverts optimistic state)
    await waitFor(() => expect(api.getItems).toHaveBeenCalledTimes(1));
    expect((await findByTestId('msg')).textContent).toBe('Some changes could not be saved');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('deleteItem failed'), expect.any(Error));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(unhandled).toEqual([]);
    consoleError.mockRestore();
  });

  it('a failing updateLabel behaves the same (shared path for every helper)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.updateLabel.mockRejectedValue(new Error('network down'));
    const { findByTestId } = render(<AppProvider><RunOnceWhenReady run={(app) => app.updateLabel('label-1', { name: 'Renamed' })} /></AppProvider>);
    await waitFor(() => expect(api.updateLabel).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.getLabels).toHaveBeenCalledTimes(1));
    expect((await findByTestId('msg')).textContent).toBe('Some changes could not be saved');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(unhandled).toEqual([]);
    consoleError.mockRestore();
  });

  it('a successful mutation shows no message', async () => {
    api.updateItem.mockResolvedValue({});
    const { findByTestId } = render(<AppProvider><RunOnceWhenReady run={(app) => app.updateItem('item-1', { quantity: 2 })} /></AppProvider>);
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.getItems).toHaveBeenCalledTimes(1));
    expect((await findByTestId('msg')).textContent).toBe('');
  });
});
