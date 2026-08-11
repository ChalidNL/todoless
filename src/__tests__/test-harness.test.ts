import { describe, expect, it } from 'vitest';

describe('browser storage test harness', () => {
  it('provides shared localStorage without Node runtime flags', () => {
    localStorage.clear();
    localStorage.setItem('view', 'month');

    expect(window.localStorage.getItem('view')).toBe('month');
  });
});
