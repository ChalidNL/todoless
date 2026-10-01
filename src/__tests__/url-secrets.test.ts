import { afterEach, describe, expect, it, vi } from 'vitest';

async function load() {
  vi.resetModules();
  return import('../lib/url-secrets');
}

describe('captureUrlSecrets (#68 reset tokens, #258 invite codes)', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('reads the reset token from the fragment and removes it from the address bar', async () => {
    window.history.replaceState({}, '', '/reset-password#token=abc.def');
    const m = await load();
    m.captureUrlSecrets();
    expect(m.getResetToken()).toBe('abc.def');
    expect(window.location.href).toMatch(/\/reset-password$/);
  });

  it('still accepts ?token= from reset mails sent before v1.0.0', async () => {
    window.history.replaceState({}, '', '/reset-password?token=legacy');
    const m = await load();
    m.captureUrlSecrets();
    expect(m.getResetToken()).toBe('legacy');
    expect(window.location.search).toBe('');
  });

  it('reads invite codes from the fragment and from legacy ?invite= / ?code= links', async () => {
    for (const url of ['/register#invite=ABCDEFGHJKLM', '/register?invite=ABCDEFGHJKLM', '/?code=ABCDEFGHJKLM']) {
      window.history.replaceState({}, '', url);
      const m = await load();
      m.captureUrlSecrets();
      expect(m.getLinkInviteCode()).toBe('ABCDEFGHJKLM');
      expect(window.location.search + window.location.hash).toBe('');
    }
  });

  it('leaves ordinary URLs alone', async () => {
    window.history.replaceState({}, '', '/tasks?view=week');
    const m = await load();
    m.captureUrlSecrets();
    expect(m.getResetToken()).toBe('');
    expect(m.getLinkInviteCode()).toBe('');
    expect(window.location.search).toBe('?view=week');
  });
});
