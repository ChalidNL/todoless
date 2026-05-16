import { describe, expect, it, vi } from 'vitest';
import { fetchSetupStatus, normalizeSetupStatus } from '../bootstrap-status';

describe('normalizeSetupStatus', () => {
  it('normalizes safe setup status payloads', () => {
    expect(normalizeSetupStatus({ has_users: true, setup_complete: true })).toEqual({
      hasUsers: true,
      setupComplete: true,
    });
  });

  it('defaults to safe existing-user mode when payload is missing flags', () => {
    expect(normalizeSetupStatus({})).toEqual({
      hasUsers: true,
      setupComplete: false,
    });
  });
});

describe('fetchSetupStatus', () => {
  it('reads has_users and setup_complete from the dedicated bootstrap endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ has_users: false, setup_complete: false }),
    });

    await expect(fetchSetupStatus(fetcher)).resolves.toEqual({
      hasUsers: false,
      setupComplete: false,
    });
    expect(fetcher).toHaveBeenCalledWith('/api/todoless/setup-status');
  });

  it('falls back to existing-user mode on endpoint errors', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });

    await expect(fetchSetupStatus(fetcher)).resolves.toEqual({
      hasUsers: true,
      setupComplete: false,
    });
  });
});
