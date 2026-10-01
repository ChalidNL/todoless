import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// icsImport / icsExport moved from the removed second client
// (src/lib/api-client.ts) into the one client the app uses.
const mocks = vi.hoisted(() => ({
  pb: {
    authStore: { isValid: true, record: { id: 'user-1' }, model: { id: 'user-1' }, token: 'token-1' },
    collection: vi.fn(() => ({})),
  },
}));
vi.mock('../lib/pocketbase', () => ({ pb: mocks.pb }));

import { api } from '../lib/pocketbase-client';

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as Response;

describe('ICS import/export live on the single client', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('icsImport posts events + options with the session token and returns the counts', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { created: 2, updated: 0, skipped: 1, errors: [] }));
    const result = await api.icsImport([{ uid: 'a' }, { uid: 'b' }], { labels: ['l1'] });
    expect(result).toEqual({ created: 2, updated: 0, skipped: 1, errors: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ics-import');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer token-1');
    expect(JSON.parse(init.body)).toEqual({ events: [{ uid: 'a' }, { uid: 'b' }], options: { labels: ['l1'] } });
  });

  it('icsImport surfaces the server error message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'events must be an array' }));
    await expect(api.icsImport([])).rejects.toThrow('events must be an array');
  });

  it('icsExport passes the optional range and returns the calendar', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ics: 'BEGIN:VCALENDAR\nEND:VCALENDAR', count: 3 }));
    const result = await api.icsExport('2026-01-01', '2026-02-01');
    expect(result.count).toBe(3);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ics-export?start=2026-01-01&end=2026-02-01');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-1');
  });

  it('icsExport without a range calls the bare route and reports failures', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ics: '', count: 0 }));
    await api.icsExport();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ics-export');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new Error('not json'); } } as unknown as Response);
    await expect(api.icsExport()).rejects.toThrow('Export failed');
  });
});
