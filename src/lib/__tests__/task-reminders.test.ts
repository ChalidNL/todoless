import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock PocketBase SDK
const mockCollection = {
  authWithPassword: vi.fn(),
  getList: vi.fn(),
  getFullList: vi.fn(),
  getFirstListItem: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../pocketbase', () => ({
  pb: {
    collection: vi.fn(() => mockCollection),
    authStore: {
      token: 'mock-token',
      isValid: true,
      record: { id: 'user1', email: 'test@test.com', name: 'Test', role: 'admin' },
      clear: vi.fn(),
    },
  },
}));

let api: any;

describe('Task Reminders Module', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    const mod = await import('../pocketbase-client');
    api = mod.api;
  });

  describe('getTasks — normalizes reminders fields', () => {
    it('normalizes linked_to and linked_type from raw record', async () => {
      mockCollection.getFullList.mockResolvedValue([
        {
          id: 't1',
          title: 'Linked Task',
          status: 'todo',
          created: new Date().toISOString(),
          user: 'user1',
          labels: [],
          linked_to: 't2',
          linked_type: 'task',
        },
      ]);

      const tasks = await api.getTasks();
      expect(tasks[0].linkedTo).toBe('t2');
      expect(tasks[0].linkedType).toBe('task');
    });

    it('normalizes flag from raw record', async () => {
      mockCollection.getFullList.mockResolvedValue([
        {
          id: 't1',
          title: 'Flagged Task',
          status: 'todo',
          created: new Date().toISOString(),
          user: 'user1',
          labels: [],
          flag: true,
        },
      ]);

      const tasks = await api.getTasks();
      expect(tasks[0].flag).toBe(true);
    });

    it('defaults flag to false when absent', async () => {
      mockCollection.getFullList.mockResolvedValue([
        {
          id: 't1',
          title: 'Unflagged Task',
          status: 'todo',
          created: new Date().toISOString(),
          user: 'user1',
          labels: [],
        },
      ]);

      const tasks = await api.getTasks();
      expect(tasks[0].flag).toBe(false);
    });

    it('normalizes linked_type as item', async () => {
      mockCollection.getFullList.mockResolvedValue([
        {
          id: 't1',
          title: 'Item-linked Task',
          status: 'todo',
          created: new Date().toISOString(),
          user: 'user1',
          labels: [],
          linked_to: 'item42',
          linked_type: 'item',
        },
      ]);

      const tasks = await api.getTasks();
      expect(tasks[0].linkedTo).toBe('item42');
      expect(tasks[0].linkedType).toBe('item');
    });

    it('normalizes linked_type as note', async () => {
      mockCollection.getFullList.mockResolvedValue([
        {
          id: 't1',
          title: 'Note-linked Task',
          status: 'todo',
          created: new Date().toISOString(),
          user: 'user1',
          labels: [],
          linked_to: 'note7',
          linked_type: 'note',
        },
      ]);

      const tasks = await api.getTasks();
      expect(tasks[0].linkedTo).toBe('note7');
      expect(tasks[0].linkedType).toBe('note');
    });
  });

  describe('createTask — sends reminders fields', () => {
    it('sends linked_to and linked_type to PocketBase', async () => {
      mockCollection.create.mockResolvedValue({ id: 't1' });

      await api.createTask({
        title: 'New Linked Task',
        status: 'todo',
        linkedTo: 't2',
        linkedType: 'task',
      });

      expect(mockCollection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Linked Task',
          linked_to: 't2',
          linked_type: 'task',
        }),
      );
    });

    it('sends flag to PocketBase', async () => {
      mockCollection.create.mockResolvedValue({ id: 't1' });

      await api.createTask({
        title: 'Flagged Task',
        status: 'todo',
        flag: true,
      });

      expect(mockCollection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Flagged Task',
          flag: true,
        }),
      );
    });

    it('sends all task metadata fields on create', async () => {
      mockCollection.create.mockResolvedValue({ id: 't-rich' });
      const due = Date.UTC(2026, 0, 2, 12, 0, 0);

      await api.createTask({
        title: 'Rich Task',
        status: 'todo',
        projectId: 'proj-1',
        dueDate: due,
        repeatInterval: 'week',
        labels: ['home', 'urgent'],
        linkedItemIds: ['item-1'],
        linkedNoteIds: ['note-1'],
      });

      expect(mockCollection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Rich Task',
          project_id: 'proj-1',
          due_date: new Date(due).toISOString(),
          repeat_interval: 'week',
          labels: ['home', 'urgent'],
          linked_item_ids: ['item-1'],
          linked_note_ids: ['note-1'],
        }),
      );
    });

    it('defaults flag to false when not provided', async () => {
      mockCollection.create.mockResolvedValue({ id: 't1' });

      await api.createTask({
        title: 'Default Task',
        status: 'todo',
      });

      expect(mockCollection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Default Task',
          flag: false,
        }),
      );
    });
  });

  describe('updateTask — sends reminders fields', () => {
    it('sends linked_to and linked_type to PocketBase', async () => {
      mockCollection.update.mockResolvedValue({ id: 't1' });

      await api.updateTask('t1', {
        linkedTo: 't3',
        linkedType: 'note',
      });

      expect(mockCollection.update).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({
          linked_to: 't3',
          linked_type: 'note',
        }),
      );
    });

    it('sends flag toggle to PocketBase', async () => {
      mockCollection.update.mockResolvedValue({ id: 't1' });

      await api.updateTask('t1', { flag: true });

      expect(mockCollection.update).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ flag: true }),
      );
    });

    it('preserves recurring fields when updating unrelated task fields', async () => {
      mockCollection.update.mockResolvedValue({ id: 't1' });

      await api.updateTask('t1', { status: 'done' });

      const [, payload] = mockCollection.update.mock.calls[0];
      expect(payload).toEqual(expect.objectContaining({ status: 'done' }));
      expect(payload).not.toHaveProperty('repeat_interval');
      expect(payload).not.toHaveProperty('due_date');
      expect(payload).not.toHaveProperty('completed_at');
    });

    it('clears linked fields when set to undefined', async () => {
      mockCollection.update.mockResolvedValue({ id: 't1' });

      await api.updateTask('t1', { linkedTo: undefined, linkedType: undefined });

      expect(mockCollection.update).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({
          linked_to: undefined,
          linked_type: undefined,
        }),
      );
    });
  });
});
