import { describe, expect, it } from 'vitest';
import { classifyLoadError } from '../lib/load-error';

describe('classifyLoadError', () => {
  it('distinguishes offline, auth, forbidden, server and unknown failures', () => {
    expect(classifyLoadError({ status: 0 })).toBe('offline');
    expect(classifyLoadError(new TypeError('Failed to fetch'))).toBe('offline');
    expect(classifyLoadError({ status: 500 }, false)).toBe('offline');
    expect(classifyLoadError({ status: 401 })).toBe('auth');
    expect(classifyLoadError({ status: 403 })).toBe('forbidden');
    expect(classifyLoadError({ status: 502 })).toBe('server');
    expect(classifyLoadError({ status: 400 })).toBe('unknown');
    expect(classifyLoadError('boom')).toBe('unknown');
  });
});
