import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from '../context/AppContext';

const mocks = vi.hoisted(() => {
  const api = {
    getBootstrap: vi.fn(),
    getTasks: vi.fn(),
    getItems: vi.fn(),
    getSharedTasks: vi.fn(),
    getSharedItems: vi.fn(),
    getNotes: vi.fn(),
    getLabels: vi.fn(),
    getShops: vi.fn(),
    getSprints: vi.fn(),
    getUsers: vi.fn(),
    getInvites: vi.fn(),
    getRewards: vi.fn(),
    getGoals: vi.fn(),
    getProjects: vi.fn(),
    getReminders: vi.fn(),
    getSettings: vi.fn(),
  };
  const pb = {
    authStore: {
      isValid: true,
      record: { id: 'u1', family_id: 'fam-1' },
      onChange: vi.fn(() => () => {}),
    },
    collection: vi.fn(),
  };
  return { api, pb };
});

vi.mock('../lib/pocketbase', () => ({ pb: mocks.pb }));
vi.mock('../lib/pocketbase-client', () => ({ api: mocks.api }));

const user1 = { id: 'u1', name: 'One', role: 'owner', family_id: 'fam-1' };
const user2 = { id: 'u2', name: 'Two', role: 'member', family_id: 'fam-1' };
const taskRecord = { id: 't1', title: 'Task', status: 'todo' };
const itemRecord = { id: 'i1', title: 'Item', completed: false };

function bootstrapPayload(users: typeof user1[], tasks: unknown[] = [], items: unknown[] = []) {
  return {
    tasks,
    items,
    notes: [],
    labels: [],
    shops: [],
    users,
    invites: [],
    reminders: [],
    settings: {},
  };
}

function Probe() {
  const { dataLoadState, sharedView, tasks, items } = useApp();
  return (
    <div>
      <span data-testid="state">{dataLoadState}</span>
      <span data-testid="shared">{String(sharedView)}</span>
      <span data-testid="task-count">{tasks.length}</span>
      <span data-testid="item-count">{items.length}</span>
    </div>
  );
}

describe('shared-view boot race (GH#76)', () => {
  beforeEach(() => {
    Object.values(mocks.api).forEach((fn) => fn.mockReset());
    mocks.pb.collection.mockReset();
    mocks.pb.collection.mockImplementation(() => ({
      subscribe: vi.fn(async () => () => {}),
      unsubscribe: vi.fn(),
    }));
    mocks.pb.authStore.onChange.mockReset();
    mocks.pb.authStore.onChange.mockImplementation(() => () => {});
    mocks.pb.authStore.isValid = true;
    mocks.pb.authStore.record = { id: 'u1', family_id: 'fam-1' };

    mocks.api.getBootstrap.mockResolvedValue(bootstrapPayload([user1]));
    mocks.api.getUsers.mockResolvedValue([user1]);
    mocks.api.getTasks.mockResolvedValue([]);
    mocks.api.getItems.mockResolvedValue([]);
    mocks.api.getSharedTasks.mockResolvedValue([]);
    mocks.api.getSharedItems.mockResolvedValue([]);
    mocks.api.getNotes.mockResolvedValue([]);
    mocks.api.getLabels.mockResolvedValue([]);
    mocks.api.getShops.mockResolvedValue([]);
    mocks.api.getSprints.mockResolvedValue([]);
    mocks.api.getInvites.mockResolvedValue([]);
    mocks.api.getRewards.mockResolvedValue([]);
    mocks.api.getGoals.mockResolvedValue([]);
    mocks.api.getProjects.mockResolvedValue([]);
    mocks.api.getReminders.mockResolvedValue([]);
    mocks.api.getSettings.mockResolvedValue({});
  });

  it('family boot fetches once via /api/bootstrap and resolves the shared scope from the payload', async () => {
    mocks.api.getBootstrap.mockResolvedValue(bootstrapPayload([user1, user2], [taskRecord], [itemRecord]));

    render(
      <AppProvider>
        <Probe />
      </AppProvider>
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready'));

    expect(screen.getByTestId('shared')).toHaveTextContent('true');
    expect(screen.getByTestId('task-count')).toHaveTextContent('1');
    expect(screen.getByTestId('item-count')).toHaveTextContent('1');

    // Single round-trip: /api/bootstrap is the only data call and the scope
    // effect must NOT start a second fetch after boot (GH#75 + GH#76).
    expect(mocks.api.getBootstrap).toHaveBeenCalledTimes(1);
    expect(mocks.api.getSharedTasks).not.toHaveBeenCalled();
    expect(mocks.api.getSharedItems).not.toHaveBeenCalled();
    expect(mocks.api.getTasks).not.toHaveBeenCalled();
    expect(mocks.api.getItems).not.toHaveBeenCalled();
  });

  it('single-user boot uses the full scope and never calls shared fetchers', async () => {
    mocks.api.getBootstrap.mockResolvedValue(bootstrapPayload([user1], [taskRecord], [itemRecord]));

    render(
      <AppProvider>
        <Probe />
      </AppProvider>
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready'));

    expect(screen.getByTestId('shared')).toHaveTextContent('false');
    expect(mocks.api.getBootstrap).toHaveBeenCalledTimes(1);
    expect(mocks.api.getSharedTasks).not.toHaveBeenCalled();
    expect(mocks.api.getSharedItems).not.toHaveBeenCalled();
    expect(mocks.api.getTasks).not.toHaveBeenCalled();
    expect(mocks.api.getItems).not.toHaveBeenCalled();
  });

  it('re-scopes with a single fresh fetch when a second member joins after boot', async () => {
    let usersCallback: (() => void) | undefined;
    mocks.pb.collection.mockImplementation((name: string) => ({
      subscribe: vi.fn(async (_event: string, callback: () => void) => {
        if (name === 'users') usersCallback = callback;
        return () => {};
      }),
      unsubscribe: vi.fn(),
    }));
    mocks.api.getBootstrap.mockResolvedValue(bootstrapPayload([user1], [taskRecord], [itemRecord]));
    mocks.api.getUsers.mockResolvedValue([user1]);

    render(
      <AppProvider>
        <Probe />
      </AppProvider>
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready'));
    expect(screen.getByTestId('shared')).toHaveTextContent('false');
    expect(mocks.api.getBootstrap).toHaveBeenCalledTimes(1);
    expect(mocks.api.getSharedTasks).not.toHaveBeenCalled();

    // A member joins: the users realtime event flips the view to shared and
    // triggers exactly one re-scoped fetch — no clearing, no duplicate call.
    mocks.api.getUsers.mockResolvedValue([user1, user2]);
    mocks.api.getSharedTasks.mockResolvedValue([taskRecord]);
    mocks.api.getSharedItems.mockResolvedValue([itemRecord]);
    expect(usersCallback).toBeDefined();
    usersCallback!();

    await waitFor(() => expect(screen.getByTestId('shared')).toHaveTextContent('true'));
    expect(mocks.api.getSharedTasks).toHaveBeenCalledTimes(1);
    expect(mocks.api.getSharedItems).toHaveBeenCalledTimes(1);
    // Boot fetch was already consumed via /api/bootstrap; the scope switch
    // adds only the shared fetch.
    expect(mocks.api.getTasks).not.toHaveBeenCalled();
    expect(screen.getByTestId('task-count')).toHaveTextContent('1');
    expect(screen.getByTestId('item-count')).toHaveTextContent('1');
  });
});