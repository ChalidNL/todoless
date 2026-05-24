import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Multi-user test suite for Todoless
// Covers: family context, race conditions, shared vs private,
//         invite flow, permission boundaries, cross-user data isolation
// ============================================================

// ── Shared mock factory ──────────────────────────────────────
const createMockCollection = () => ({
  authWithPassword: vi.fn(),
  authRefresh: vi.fn(),
  getList: vi.fn(),
  getFullList: vi.fn(),
  getOne: vi.fn(),
  getFirstListItem: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
});

const mockUsersCollection = createMockCollection();
const mockTasksCollection = createMockCollection();
const mockItemsCollection = createMockCollection();
const mockNotesCollection = createMockCollection();
const mockLabelsCollection = createMockCollection();
const mockShopsCollection = createMockCollection();
const mockSprintsCollection = createMockCollection();
const mockCalendarCollection = createMockCollection();
const mockInviteCodesCollection = createMockCollection();
const mockSettingsCollection = createMockCollection();
const mockFamiliesCollection = createMockCollection();
const mockRewardsCollection = createMockCollection();
const mockGoalsCollection = createMockCollection();

const collectionMap: Record<string, ReturnType<typeof createMockCollection>> = {
  users: mockUsersCollection,
  tasks: mockTasksCollection,
  items: mockItemsCollection,
  notes: mockNotesCollection,
  labels: mockLabelsCollection,
  shops: mockShopsCollection,
  sprints: mockSprintsCollection,
  calendar_events: mockCalendarCollection,
  invite_codes: mockInviteCodesCollection,
  app_settings: mockSettingsCollection,
  families: mockFamiliesCollection,
  rewards: mockRewardsCollection,
  goals: mockGoalsCollection,
};

vi.mock('../pocketbase', () => ({
  pb: {
    collection: vi.fn((name: string) => collectionMap[name]),
    authStore: {
      token: 'token-a',
      isValid: true,
      record: {
        id: 'user-a',
        email: 'alice@test.com',
        name: 'Alice',
        role: 'admin',
        family_id: 'fam-1',
      },
      clear: vi.fn(),
      save: vi.fn(),
    },
  },
}));

import { pb } from '../pocketbase';

// ── Helper: simulate switching the authenticated user ────────
function switchUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  family_id?: string;
}) {
  (pb.authStore as any).record = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    family_id: user.family_id ?? null,
  };
  (pb.authStore as any).token = `token-${user.id}`;
  (pb.authStore as any).isValid = true;
}

function logout() {
  (pb.authStore as any).record = null;
  (pb.authStore as any).token = '';
  (pb.authStore as any).isValid = false;
}

// ── Import API after mocks ───────────────────────────────────
let api: any;

async function importFreshApi() {
  vi.resetModules();
  // Re-mock after resetModules
  vi.doMock('../pocketbase', () => ({
    pb: {
      collection: vi.fn((name: string) => {
        // Return the right mock based on collection name
        const c = createMockCollection();
        // Copy over existing mock implementations
        if (collectionMap[name]) {
          Object.assign(c, collectionMap[name]);
        }
        return c;
      }),
      authStore: {
        token: 'token-a',
        isValid: true,
        record: {
          id: 'user-a',
          email: 'alice@test.com',
          name: 'Alice',
          role: 'admin',
          family_id: 'fam-1',
        },
        clear: vi.fn(),
      },
    },
  }));
  const mod = await import('../pocketbase-client');
  return mod.api;
}

// ── TESTS ────────────────────────────────────────────────────

describe('Multi-user: Family context task sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    switchUser({ id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin', family_id: 'fam-1' });
  });

  it('filters tasks by family_id when user has a family', async () => {
    mockTasksCollection.getFullList.mockResolvedValue([
      { id: 't1', title: "Alice's task", status: 'todo', created: '2026-01-01T00:00:00Z', user: 'user-a', labels: [] },
      { id: 't2', title: "Bob's task", status: 'todo', created: '2026-01-02T00:00:00Z', user: 'user-b', labels: [] },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const tasks = await freshApi.getTasks();

    expect(mockTasksCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'user.family_id = "fam-1"' }),
    );
    expect(tasks).toHaveLength(2);
  });

  it('falls back to user.id filter when no family_id is set', async () => {
    switchUser({ id: 'user-c', email: 'charlie@test.com', name: 'Charlie', role: 'user', family_id: undefined });
    mockTasksCollection.getFullList.mockResolvedValue([
      { id: 't3', title: "Charlie's task", status: 'todo', created: '2026-01-01T00:00:00Z', user: 'user-c', labels: [] },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const tasks = await freshApi.getTasks();

    expect(mockTasksCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'user.id = "user-c"' }),
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Charlie's task");
  });

  it('returns empty array when not authenticated', async () => {
    logout();
    const { api: freshApi } = await import('../pocketbase-client');
    const tasks = await freshApi.getTasks();
    expect(tasks).toEqual([]);
    expect(mockTasksCollection.getFullList).not.toHaveBeenCalled();
  });
});

describe('Multi-user: Shared vs private items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    switchUser({ id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin', family_id: 'fam-1' });
  });

  it('getSharedTasks returns only non-private tasks', async () => {
    mockTasksCollection.getFullList.mockResolvedValue([
      { id: 't1', title: 'Public task', status: 'todo', is_private: false, created: '2026-01-01T00:00:00Z', user: 'user-a', labels: [] },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const tasks = await freshApi.getSharedTasks();

    expect(mockTasksCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'is_private = false && user.family_id = "fam-1"', sort: '-created' }),
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].isPrivate).toBe(false);
  });

  it('getSharedItems returns only non-private items', async () => {
    mockItemsCollection.getFullList.mockResolvedValue([
      { id: 'i1', title: 'Public item', completed: false, is_private: false, created: '2026-01-01T00:00:00Z', user: 'user-a', labels: [] },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const items = await freshApi.getSharedItems();

    expect(mockItemsCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'is_private = false && user.family_id = "fam-1"', sort: '-created' }),
    );
    expect(items).toHaveLength(1);
  });

  it('getItems filters by family_id when user has a family (shared shopping list)', async () => {
    mockItemsCollection.getFullList.mockResolvedValue([
      { id: 'i1', title: "Alice's milk", completed: false, created: '2026-01-01T00:00:00Z', user: 'user-a', labels: [] },
      { id: 'i2', title: "Bob's bread", completed: false, created: '2026-01-02T00:00:00Z', user: 'user-b', labels: [] },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const items = await freshApi.getItems();

    expect(mockItemsCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'user.family_id = "fam-1"' }),
    );
    expect(items).toHaveLength(2);
  });

  it('getItems falls back to user.id filter when no family_id is set', async () => {
    switchUser({ id: 'user-c', email: 'charlie@test.com', name: 'Charlie', role: 'user', family_id: undefined });
    mockItemsCollection.getFullList.mockResolvedValue([
      { id: 'i3', title: "Charlie's eggs", completed: false, created: '2026-01-01T00:00:00Z', user: 'user-c', labels: [] },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const items = await freshApi.getItems();

    expect(mockItemsCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'user.id = "user-c"' }),
    );
    expect(items).toHaveLength(1);
  });

  it('createTask sets is_private flag correctly', async () => {
    mockTasksCollection.create.mockResolvedValue({ id: 't-private' });

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.createTask({ title: 'Private task', isPrivate: true });

    expect(mockTasksCollection.create).toHaveBeenCalledWith(
      expect.objectContaining({ is_private: true, user: 'user-a' }),
    );
  });

  it('createItem sets is_private flag correctly', async () => {
    mockItemsCollection.create.mockResolvedValue({ id: 'i-private' });

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.createItem({ title: 'Private item', isPrivate: true });

    expect(mockItemsCollection.create).toHaveBeenCalledWith(
      expect.objectContaining({ is_private: true, user: 'user-a' }),
    );
  });

  it('updateItem toggles is_private flag', async () => {
    mockItemsCollection.update.mockResolvedValue({ id: 'i1', is_private: true });

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.updateItem('i1', { isPrivate: true });

    expect(mockItemsCollection.update).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({ isPrivate: true }),
    );
  });
});

describe('Multi-user: Invite flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    logout();
  });

  it('first user registers as admin without invite code', async () => {
    mockUsersCollection.authWithPassword.mockImplementation(async () => {
      (pb.authStore as any).record = { id: 'user-admin', email: 'admin@test.com', name: 'Admin', role: 'admin', family_id: 'fam-1' };
      return { record: (pb.authStore as any).record };
    });
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        token: 'admin-token',
        user: { id: 'user-admin', email: 'admin@test.com', name: 'Admin', role: 'admin', family_id: 'fam-1' },
      }),
    });

    const { api: freshApi } = await import('../pocketbase-client');
    const result = await freshApi.register('admin@test.com', 'pass', 'Admin');

    expect(result.user.role).toBe('admin');
    expect(fetch).toHaveBeenCalledWith('/api/register', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.email).toBe('admin@test.com');
    expect(body.user_type).toBe('family_member');
  });

  it('non-first user without invite code throws error', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'Invite code required for registration.' }),
    });

    const { api: freshApi } = await import('../pocketbase-client');
    await expect(freshApi.register('newbie@test.com', 'pass', 'Newbie')).rejects.toThrow('Invite code required');
    // Should NOT try to create user directly
    expect((fetch as any).mock.calls[0][0]).toBe('/api/register');
  });

  it('non-first user with invalid invite code throws error', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'Invalid or expired invite code.' }),
    });

    const { api: freshApi } = await import('../pocketbase-client');
    await expect(freshApi.register('newbie@test.com', 'pass', 'Newbie', 'BAD_CODE')).rejects.toThrow('Invalid or expired invite code');
  });

  it('non-first user with valid invite code registers as user', async () => {
    mockUsersCollection.authWithPassword.mockImplementation(async () => {
      (pb.authStore as any).record = { id: 'user-newbie', email: 'newbie@test.com', name: 'Newbie', role: 'user', family_id: 'fam-1' };
      return { record: (pb.authStore as any).record };
    });
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        token: 'user-token',
        user: { id: 'user-newbie', email: 'newbie@test.com', name: 'Newbie', role: 'user', family_id: 'fam-1' },
      }),
    });

    const { api: freshApi } = await import('../pocketbase-client');
    const result = await freshApi.register('newbie@test.com', 'pass', 'Newbie', 'VALIDCODE');

    expect(result.user.role).toBe('user');
    expect(result.user.family_id).toBe('fam-1');
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.invite_code).toBe('VALIDCODE');
  });

  it('validateInviteCode normalizes code to uppercase', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: 'valid',
        message: 'Invite code is valid',
        invite: { id: 'inv-2', code: 'XYZ789', created_by: 'admin-1' },
      }),
    });

    const { api: freshApi } = await import('../pocketbase-client');
    const result = await freshApi.validateInviteCode('xyz789');

    expect(result.code).toBe('XYZ789');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/validate-invite?code=XYZ789'),
    );
  });
});

describe('Multi-user: Permission boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin can see all users via getUsers', async () => {
    switchUser({ id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin', family_id: 'fam-1' });
    mockUsersCollection.getFullList.mockResolvedValue([
      { id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin' },
      { id: 'user-b', email: 'bob@test.com', name: 'Bob', role: 'user' },
      { id: 'user-d', email: 'dave@test.com', name: 'Dave', role: 'child' },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const users = await freshApi.getUsers();

    expect(users).toHaveLength(3);
    expect(users.map((u: any) => u.id)).toContain('user-b');
    expect(users.map((u: any) => u.id)).toContain('user-d');
  });

  it('getNotes filters strictly by user.id — no cross-user note leakage', async () => {
    switchUser({ id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin', family_id: 'fam-1' });
    mockNotesCollection.getFullList.mockResolvedValue([
      { id: 'n1', title: "Alice's note", content: 'secret', created: '2026-01-01T00:00:00Z', user: 'user-a', labels: [] },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const notes = await freshApi.getNotes();

    expect(mockNotesCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'user.id = "user-a"' }),
    );
    expect(notes).toHaveLength(1);
  });

  it('getLabels filters by family_id', async () => {
    switchUser({ id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin', family_id: 'fam-1' });
    mockLabelsCollection.getFullList.mockResolvedValue([
      { id: 'l1', name: 'Work', color: '#ff0000', is_private: false, user: 'user-a' },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const labels = await freshApi.getLabels();

    expect(mockLabelsCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'user.family_id = "fam-1"', sort: 'name' }),
    );
  });

  it('getSprints filters strictly by user.id', async () => {
    switchUser({ id: 'user-b', email: 'bob@test.com', name: 'Bob', role: 'user', family_id: 'fam-1' });
    mockSprintsCollection.getFullList.mockResolvedValue([
      { id: 's1', name: 'Sprint 1', start_date: '2026-01-01T00:00:00Z', end_date: '2026-01-14T00:00:00Z', user: 'user-b' },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const sprints = await freshApi.getSprints();

    expect(mockSprintsCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'user.id = "user-b"' }),
    );
  });

  it('getCalendarEvents filters strictly by user.id', async () => {
    switchUser({ id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin', family_id: 'fam-1' });
    mockCalendarCollection.getFullList.mockResolvedValue([
      { id: 'c1', title: "Alice's meeting", start_time: '2026-01-01T10:00:00Z', end_time: '2026-01-01T11:00:00Z', user: 'user-a' },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const events = await freshApi.getCalendarEvents();

    expect(mockCalendarCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'user.id = "user-a"' }),
    );
  });
});

describe('Multi-user: Role-based permissions (usePermissions)', () => {
  // usePermissions reads pb.authStore.record.role directly
  it('admin has full management permissions', async () => {
    switchUser({ id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin', family_id: 'fam-1' });
    const { usePermissions } = await import('../../hooks/usePermissions');
    const perms = usePermissions();

    expect(perms.canManageUsers).toBe(true);
    expect(perms.canDeleteOthersItems).toBe(true);
    expect(perms.canSeeAllItems).toBe(true);
    expect(perms.canAccessFullSettings).toBe(true);
    expect(perms.isAdmin).toBe(true);
    expect(perms.isChild).toBe(false);
  });

  it('regular user cannot manage users or see all items', async () => {
    switchUser({ id: 'user-b', email: 'bob@test.com', name: 'Bob', role: 'user', family_id: 'fam-1' });
    const { usePermissions } = await import('../../hooks/usePermissions');
    const perms = usePermissions();

    expect(perms.canManageUsers).toBe(false);
    expect(perms.canDeleteOthersItems).toBe(false);
    expect(perms.canSeeAllItems).toBe(false);
    expect(perms.canAccessFullSettings).toBe(false);
    expect(perms.isAdmin).toBe(false);
    expect(perms.isChild).toBe(false);
    expect(perms.canCreateSprints).toBe(true);
  });

  it('child has limited permissions and can earn rewards', async () => {
    switchUser({ id: 'user-d', email: 'dave@test.com', name: 'Dave', role: 'child', family_id: 'fam-1' });
    const { usePermissions } = await import('../../hooks/usePermissions');
    const perms = usePermissions();

    expect(perms.canManageUsers).toBe(false);
    expect(perms.canCreateSprints).toBe(false);
    expect(perms.canDeleteOthersItems).toBe(false);
    expect(perms.canSeeAllItems).toBe(false);
    expect(perms.canEarnRewards).toBe(true);
    expect(perms.canAccessSettings).toBe(false);
    expect(perms.isChild).toBe(true);
  });
});

describe('Multi-user: Race conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    switchUser({ id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin', family_id: 'fam-1' });
  });

  it('getSettings handles concurrent first-run create race (idempotent)', async () => {
    // First call: getFullList returns empty → tries create → fails (concurrent) → retries getFullList → finds existing
    let createCallCount = 0;
    mockSettingsCollection.getFullList
      .mockResolvedValueOnce([]) // first check: empty
      .mockResolvedValueOnce([{ id: 's1', user: 'user-a', sprint_duration: '2weeks', sprint_start_day: 1, language: 'en', archive_retention_days: 30, auto_cleanup: true, theme: 'light' }]); // retry after create conflict

    mockSettingsCollection.create.mockImplementation(() => {
      createCallCount++;
      if (createCallCount === 1) {
        throw new Error('duplicate key value violates unique constraint');
      }
      return Promise.resolve({ id: 's2', user: 'user-a', sprint_duration: '2weeks', sprint_start_day: 1, language: 'en', archive_retention_days: 30, auto_cleanup: true, theme: 'light' });
    });

    const { api: freshApi } = await import('../pocketbase-client');
    const settings = await freshApi.getSettings();

    expect(settings.hasCompletedOnboarding).toBe(true);
    // The retry path should have been taken
    expect(mockSettingsCollection.getFullList).toHaveBeenCalledTimes(2);
  });

  it('concurrent task updates from two users in same family both go through', async () => {
    // Alice updates task
    mockTasksCollection.update.mockResolvedValueOnce({ id: 't1', title: 'Updated by Alice' });
    // Bob updates same task
    mockTasksCollection.update.mockResolvedValueOnce({ id: 't1', title: 'Updated by Bob' });

    const { api: freshApi } = await import('../pocketbase-client');

    // Simulate concurrent updates
    const [aliceResult, bobResult] = await Promise.all([
      freshApi.updateTask('t1', { title: 'Updated by Alice' }),
      freshApi.updateTask('t1', { title: 'Updated by Bob' }),
    ]);

    expect(mockTasksCollection.update).toHaveBeenCalledTimes(2);
    expect(mockTasksCollection.update).toHaveBeenCalledWith('t1', expect.objectContaining({}));
  });
});

describe('Multi-user: Cross-user data isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('User B cannot see User A private tasks through getSharedTasks', async () => {
    switchUser({ id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin', family_id: 'fam-1' });
    // Alice has a private task
    mockTasksCollection.getFullList.mockResolvedValue([
      { id: 't-pub', title: 'Public task', status: 'todo', is_private: false, created: '2026-01-01T00:00:00Z', user: 'user-a', labels: [] },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const sharedTasks = await freshApi.getSharedTasks();

    // Only public tasks should appear
    expect(sharedTasks.every((t: any) => t.isPrivate === false)).toBe(true);
  });

  it('createItem sets the correct user ownership', async () => {
    switchUser({ id: 'user-b', email: 'bob@test.com', name: 'Bob', role: 'user', family_id: 'fam-1' });
    mockItemsCollection.create.mockResolvedValue({ id: 'i-new' });

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.createItem({ title: "Bob's milk" });

    expect(mockItemsCollection.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'user-b' }),
    );
  });

  it('createNote sets the correct user ownership', async () => {
    switchUser({ id: 'user-b', email: 'bob@test.com', name: 'Bob', role: 'user', family_id: 'fam-1' });
    mockNotesCollection.create.mockResolvedValue({ id: 'n-new' });

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.createNote({ title: "Bob's note", content: 'secret' });

    expect(mockNotesCollection.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'user-b' }),
    );
  });

  it('createLabel sets the correct user ownership', async () => {
    switchUser({ id: 'user-b', email: 'bob@test.com', name: 'Bob', role: 'user', family_id: 'fam-1' });
    mockLabelsCollection.create.mockResolvedValue({ id: 'l-new' });

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.createLabel({ name: 'Personal', color: '#00ff00' });

    expect(mockLabelsCollection.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'user-b' }),
    );
  });

  it('updateTask does not change ownership', async () => {
    mockTasksCollection.update.mockResolvedValue({ id: 't1' });

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.updateTask('t1', { title: 'New title' });

    // update should NOT include a 'user' field — ownership is immutable
    const callArgs = mockTasksCollection.update.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('user');
  });

  it('updateItem does not change ownership', async () => {
    mockItemsCollection.update.mockResolvedValue({ id: 'i1' });

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.updateItem('i1', { title: 'New title' });

    const callArgs = mockItemsCollection.update.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('user');
  });
});

describe('Multi-user: Family management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    switchUser({ id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin', family_id: 'fam-1' });
  });

  it('createFamily creates family record with creator', async () => {
    mockFamiliesCollection.create.mockResolvedValue({ id: 'fam-new', name: 'The Smiths' });

    const { api: freshApi } = await import('../pocketbase-client');
    const family = await freshApi.createFamily('The Smiths', 'user-a');

    expect(family.id).toBe('fam-new');
    expect(family.name).toBe('The Smiths');
    expect(mockFamiliesCollection.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'The Smiths', created_by: 'user-a' }),
    );
  });

  it('updateUserFamily updates user family_id', async () => {
    mockUsersCollection.update.mockResolvedValue({ id: 'user-newbie', family_id: 'fam-new' });

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.updateUserFamily('user-newbie', 'fam-new');

    expect(mockUsersCollection.update).toHaveBeenCalledWith(
      'user-newbie',
      expect.objectContaining({ family_id: 'fam-new' }),
    );
  });

  it('getHouseholdUsers returns all users (admin view)', async () => {
    mockUsersCollection.getFullList.mockResolvedValue([
      { id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin' },
      { id: 'user-b', email: 'bob@test.com', name: 'Bob', role: 'user' },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const users = await freshApi.getHouseholdUsers();

    expect(users).toHaveLength(2);
    // No filter — all users visible
    expect(mockUsersCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'name' }),
    );
    const filterArg = mockUsersCollection.getFullList.mock.calls[0][0];
    expect(filterArg).not.toHaveProperty('filter');
  });
});

describe('Multi-user: getTasks family filter handles missing family_id safely', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('user with family_id=null falls back to user.id filter', async () => {
    switchUser({ id: 'user-x', email: 'x@test.com', name: 'X', role: 'user', family_id: null });
    mockTasksCollection.getFullList.mockResolvedValue([]);

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.getTasks();

    expect(mockTasksCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'user.id = "user-x"' }),
    );
  });
});

describe('Multi-user: Item privacy and assignee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    switchUser({ id: 'user-a', email: 'alice@test.com', name: 'Alice', role: 'admin', family_id: 'fam-1' });
  });

  it('createItem sets is_private flag correctly', async () => {
    mockItemsCollection.create.mockResolvedValue({ id: 'i-private' });

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.createItem({ title: 'Private item', isPrivate: true });

    expect(mockItemsCollection.create).toHaveBeenCalledWith(
      expect.objectContaining({ is_private: true, user: 'user-a' }),
    );
  });

  it('createItem with assignee sets assigned_to', async () => {
    mockItemsCollection.create.mockResolvedValue({ id: 'i-assigned' });

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.createItem({ title: 'Milk', assignedTo: 'user-b' });

    expect(mockItemsCollection.create).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_to: 'user-b' }),
    );
  });

  it('normalizeItem includes isPrivate field', async () => {
    mockItemsCollection.getFullList.mockResolvedValue([
      { id: 'i1', title: 'Public item', completed: false, is_private: false, created: '2026-01-01T00:00:00Z', user: 'user-a', labels: [] },
      { id: 'i2', title: 'Private item', completed: false, is_private: true, created: '2026-01-02T00:00:00Z', user: 'user-b', labels: [] },
    ]);

    const { api: freshApi } = await import('../pocketbase-client');
    const items = await freshApi.getItems();

    expect(items[0].isPrivate).toBe(false);
    expect(items[1].isPrivate).toBe(true);
  });

  it('getItems with family_id=null falls back to user.id', async () => {
    switchUser({ id: 'user-z', email: 'z@test.com', name: 'Z', role: 'user', family_id: null });
    mockItemsCollection.getFullList.mockResolvedValue([]);

    const { api: freshApi } = await import('../pocketbase-client');
    await freshApi.getItems();

    expect(mockItemsCollection.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'user.id = "user-z"' }),
    );
  });
});
