import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../lib/pocketbase', () => ({
  pb: { authStore: { token: 'test-token', record: { id: 'user-1' } } },
}));

import { api } from '../lib/pocketbase-client';

const repoFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('GH#87 — batch delete of completed tasks', () => {
  describe('source contract', () => {
    const tasksView = repoFile('src/components/TasksView.tsx');
    const client = repoFile('src/lib/pocketbase-client.ts');
    const hook = repoFile('pb_hooks/routes/tasks.js');

    it('does not issue one DELETE per completed task anymore', () => {
      expect(tasksView).not.toMatch(/doneIds\.forEach\(id => deleteTask\(id\)\)/);
      expect(tasksView).toMatch(/deleteTasks\(doneIds\)/);
    });

    it('exposes a batch delete client method hitting a single endpoint', () => {
      expect(client).toMatch(/async deleteTasks\(ids: string\[\]\)/);
      expect(client).toContain("fetch('/api/v1/tasks/batch-delete'");
      expect(client).toContain("method: 'POST'");
    });

    it('registers the batch-delete hook route with ownership checks', () => {
      expect(hook).toContain("'/api/v1/tasks/batch-delete'");
      expect(hook).toContain("record.get('user') !== authRecord.id");
      expect(hook).toContain('dao.deleteRecord(records[i])');
    });
  });

  describe('client behavior', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('issues exactly ONE POST with deduped ids and returns the server count', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ deleted: 3, ids: ['a', 'b', 'c'] }),
      });

      const result = await api.deleteTasks(['a', 'b', 'a', 'c', '']);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/v1/tasks/batch-delete');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer test-token');
      expect(JSON.parse(init.body).ids).toEqual(['a', 'b', 'c']);
      expect(result.deleted).toBe(3);
    });

    it('skips the request entirely for an empty list', async () => {
      const result = await api.deleteTasks([]);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.deleted).toBe(0);
    });

    it('propagates the server error message when the batch request fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Forbidden' }),
      });

      await expect(api.deleteTasks(['x'])).rejects.toThrow('Forbidden');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});