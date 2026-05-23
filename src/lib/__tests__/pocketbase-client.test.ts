import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock PocketBase SDK
const mockCollection = {
  authWithPassword: vi.fn(),
  authRefresh: vi.fn(),
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
      save: vi.fn(),
    },
  },
}));

// Import after mock
import { pb } from '../pocketbase';

// Dynamically import the client
let api: any;

describe('PocketBaseClient', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    // Re-import to get fresh instance
    const mod = await import('../pocketbase-client');
    api = mod.api;
  });

  describe('login', () => {
    it('calls authWithPassword with correct params', async () => {
      mockCollection.authWithPassword.mockResolvedValue({
        record: { id: 'u1', email: 'test@test.com', name: 'Test', role: 'user' },
      });

      const result = await api.login('test@test.com', 'password123');

      expect(pb.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.authWithPassword).toHaveBeenCalledWith('test@test.com', 'password123');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
    });
  });

  describe('register', () => {
    beforeEach(() => {
      // Set authStore to "logged in after registration" state
      (pb.authStore as any).record = { id: 'u1', email: 'admin@test.com', name: 'Admin', role: 'admin', family_id: 'fam1' };
    });

    it('posts to todoless/register endpoint', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          token: 'mock-token',
          user: { id: 'u1', email: 'admin@test.com', name: 'Admin', role: 'admin', family_id: 'fam1' },
        }),
      });

      const result = await api.register('admin@test.com', 'pass', 'Admin');

      expect(fetch).toHaveBeenCalledWith(
        '/api/register',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.role).toBe('admin');
    });

    it('throws on registration failure', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Invalid or expired invite code.' }),
      });

      await expect(api.register('user@test.com', 'pass', 'User', 'BADCODE')).rejects.toThrow('Invalid or expired invite code');
    });

    it('accepts user_type parameter', async () => {
      (pb.authStore as any).record = { id: 'u2', email: 'assistant@test.com', name: 'Assistant', role: 'assistant', family_id: 'fam1' };
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          token: 'mock-token',
          user: { id: 'u2', email: 'assistant@test.com', name: 'Assistant', role: 'assistant', family_id: 'fam1' },
        }),
      });

      const result = await api.register('assistant@test.com', 'pass', 'Assistant', 'VALIDCODE', 'family_assistant');
      const body = JSON.parse((fetch as any).mock.calls[0][1].body);
      expect(body.user_type).toBe('family_assistant');
      expect(result.user.role).toBe('assistant');
    });
  });

  describe('CRUD operations', () => {
    it('getTasks filters by shared family/workspace instead of creator', async () => {
      (pb.authStore.record as any).family_id = 'fam1';
      mockCollection.getFullList.mockResolvedValue([
        { id: 't1', title: 'Test Task', status: 'todo', created: new Date().toISOString(), user: 'user1', labels: [] },
      ]);

      const tasks = await api.getTasks();

      expect(pb.collection).toHaveBeenCalledWith('tasks');
      expect(mockCollection.getFullList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: 'user.family_id = "fam1"' })
      );
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Test Task');
    });

    it('createTask sends correct data', async () => {
      mockCollection.create.mockResolvedValue({ id: 't1' });

      await api.createTask({ title: 'New Task', status: 'todo' });

      expect(pb.collection).toHaveBeenCalledWith('tasks');
      expect(mockCollection.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Task', status: 'todo' })
      );
    });

    it('deleteTask calls delete with id', async () => {
      mockCollection.delete.mockResolvedValue(undefined);

      await api.deleteTask('t1');

      expect(pb.collection).toHaveBeenCalledWith('tasks');
      expect(mockCollection.delete).toHaveBeenCalledWith('t1');
    });

    it('getItems returns normalized items', async () => {
      mockCollection.getFullList.mockResolvedValue([
        { id: 'i1', title: 'Milk', completed: false, created: new Date().toISOString(), user: 'user1', labels: [] },
      ]);

      const items = await api.getItems();
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Milk');
    });

    it('updateTask calls update with correct id', async () => {
      mockCollection.update.mockResolvedValue({ id: 't1' });

      await api.updateTask('t1', { title: 'Updated' });

      expect(pb.collection).toHaveBeenCalledWith('tasks');
      expect(mockCollection.update).toHaveBeenCalledWith('t1', expect.objectContaining({}));
    });
  });

  describe('logout', () => {
    it('clears auth store', async () => {
      await api.logout();
      expect(pb.authStore.clear).toHaveBeenCalled();
    });
  });

  describe('shared operations', () => {
    it('getUsers fetches all users', async () => {
      mockCollection.getFullList.mockResolvedValue([
        { id: 'u1', email: 'a@b.com', name: 'User A', role: 'admin' },
        { id: 'u2', email: 'c@d.com', name: 'User B', role: 'user' },
      ]);

      const users = await api.getUsers();
      expect(users).toHaveLength(2);
      expect(pb.collection).toHaveBeenCalledWith('users');
    });

    it('updateUser role uses secured API action set_role', async () => {
      (fetch as any).mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) });

      await api.updateUser('u2', { role: 'child' });

      expect(fetch).toHaveBeenCalledWith(
        '/api/v1',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
        }),
      );
      const body = JSON.parse((fetch as any).mock.calls[0][1].body);
      expect(body).toEqual({ action: 'set_role', user_id: 'u2', role: 'child' });
    });

    it('updateUser active uses secured API action set_user_block', async () => {
      (fetch as any).mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) });

      await api.updateUser('u2', { active: false });

      const body = JSON.parse((fetch as any).mock.calls[0][1].body);
      expect(body).toEqual({ action: 'set_user_block', user_id: 'u2', blocked: true });
    });

    it('deleteUser uses secured API action delete_user', async () => {
      (fetch as any).mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true, deleted_user_id: 'u2' }) });

      const res = await api.deleteUser('u2');

      const body = JSON.parse((fetch as any).mock.calls[0][1].body);
      expect(body).toEqual({ action: 'delete_user', user_id: 'u2' });
      expect(res.deleted_user_id).toBe('u2');
    });

    it('deleteUser surfaces backend error message', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'cannot delete admin account' }),
      });

      await expect(api.deleteUser('u1')).rejects.toThrow('cannot delete admin account');
    });
  });
});
