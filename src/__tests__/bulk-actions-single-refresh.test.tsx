import { useEffect, useRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// "Restock" (uncheckAllDoneItems) and the archive/uncheck-all task helpers
// used to issue one update per record, each followed by a full
// refreshEntries(): 3N requests in one burst (the nginx api_general zone
// allows 120, so ~40 checked groceries hit 429s, the #87 class) and N racing
// refetches. Bulk actions now run with bounded concurrency and refresh once.

const { api, authState, bootstrap, inFlight } = vi.hoisted(() => {
  // 60 items: the old 3N pattern (180 requests) exceeded the nginx api_general burst of 120.
  const items = Array.from({ length: 60 }, (_, i) => ({
    id: `item-${i}`, title: `Grocery ${i}`, completed: true, labels: [], quantity: 1, userId: 'user-1', createdAt: 1_700_000_000_000 + i, isPrivate: false,
  }));
  const bootstrap = {
    tasks: [], items, notes: [], labels: [], shops: [],
    users: [{ id: 'user-1', name: 'Me', email: 'me@example.test', role: 'owner' }],
    invites: [], reminders: [], settings: { id: 's1', currentUserId: 'user-1', language: 'en' },
  };
  const api = {
    getBootstrap: vi.fn(), getTasks: vi.fn(), getItems: vi.fn(), getSharedTasks: vi.fn(), getSharedItems: vi.fn(),
    getUsers: vi.fn(), getLabels: vi.fn(), getShops: vi.fn(), getInvites: vi.fn(), getReminders: vi.fn(), getNotes: vi.fn(), getSettings: vi.fn(),
    updateItem: vi.fn(), updateTask: vi.fn(), createTask: vi.fn(), createItem: vi.fn(), deleteTask: vi.fn(), deleteItem: vi.fn(),
  };
  const authState = { isValid: true, record: { id: 'user-1' }, model: { id: 'user-1' }, onChange: () => () => {}, clear: () => {} };
  const inFlight = { current: 0, max: 0 };
  return { api, authState, bootstrap, inFlight };
});

vi.mock('../lib/pocketbase-client', () => ({
  api, isInvalidOldPasswordError: () => false,
  normalizeItem: (r: unknown) => r, normalizeLabel: (r: unknown) => r, normalizeTask: (r: unknown) => r,
}));
vi.mock('../lib/pocketbase', () => ({
  pb: { authStore: authState, collection: () => ({ subscribe: vi.fn().mockResolvedValue(undefined), unsubscribe: vi.fn().mockResolvedValue(undefined) }) },
}));

import { AppProvider, useApp } from '../context/AppContext';

function RestockWhenReady() {
  const app = useApp();
  const fired = useRef(false);
  useEffect(() => {
    if (app.dataLoadState === 'ready' && app.items.length > 0 && !fired.current) {
      fired.current = true;
      app.uncheckAllDoneItems();
    }
  }, [app]);
  return <span data-testid="msg">{app.completionMessage ?? ''}</span>;
}

describe('bulk item/task actions', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    inFlight.current = 0; inFlight.max = 0;
    api.getBootstrap.mockResolvedValue(bootstrap);
    api.getTasks.mockResolvedValue([]);
    api.getItems.mockResolvedValue(bootstrap.items);
    api.getSharedTasks.mockResolvedValue([]);
    api.getSharedItems.mockResolvedValue(bootstrap.items);
    api.updateItem.mockImplementation(async () => {
      inFlight.current++;
      inFlight.max = Math.max(inFlight.max, inFlight.current);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight.current--;
      return {};
    });
  });

  it('restock updates every checked grocery, with bounded concurrency and ONE refresh', async () => {
    render(<AppProvider><RestockWhenReady /></AppProvider>);
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(60));
    // the boot loads entries via getBootstrap; refreshEntries() is getTasks+getItems
    await waitFor(() => expect(api.getItems).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(api.getItems).toHaveBeenCalledTimes(1);
    expect(api.getTasks).toHaveBeenCalledTimes(1);
    expect(inFlight.max).toBeLessThanOrEqual(4);
    expect(api.updateItem).toHaveBeenCalledWith('item-7', { completed: false, quantity: 1 });
  });

  it('a failing record does not stop the rest, and the user is told once', async () => {
    api.updateItem.mockImplementation(async (id: string) => {
      if (id === 'item-3' || id === 'item-9') throw new Error('429');
      return {};
    });
    const { findByTestId } = render(<AppProvider><RestockWhenReady /></AppProvider>);
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(60));
    await waitFor(() => expect(api.getItems).toHaveBeenCalledTimes(1));
    expect((await findByTestId('msg')).textContent).toBe('Some changes could not be saved');
  });
});
