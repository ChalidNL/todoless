import { describe, expect, it } from 'vitest';
import { getNormalizedAppVersion, shouldShowUpdateButton } from '../lib/app-update';

describe('app update helpers', () => {
  it('normalizes commit hashes to 7 chars', () => {
    expect(getNormalizedAppVersion({ version: 'dev', commit: 'abcdef123456' })).toEqual({
      version: 'dev',
      commit: 'abcdef1',
      buildId: '',
    });
  });

  it('does not show update button when remote build matches current build', () => {
    expect(
      shouldShowUpdateButton(
        { version: 'dev', commit: 'abcdef1', buildId: 'dev-abcdef1-20260603T210000Z' },
        { version: 'dev', commit: 'abcdef1', buildId: 'dev-abcdef1-20260603T210000Z' }
      )
    ).toBe(false);
  });

  it('shows update button when remote build id differs from current build id', () => {
    expect(
      shouldShowUpdateButton(
        { version: 'dev', commit: 'abcdef1', buildId: 'dev-abcdef1-20260603T210000Z' },
        { version: 'dev', commit: 'abcdef1', buildId: 'dev-abcdef1-20260603T220000Z' }
      )
    ).toBe(true);
  });

  it('falls back to commit comparison when build ids are unavailable', () => {
    expect(
      shouldShowUpdateButton(
        { version: 'dev', commit: 'abcdef1' },
        { version: 'dev', commit: '1234567' }
      )
    ).toBe(true);
  });

  it('ignores invalid remote payloads', () => {
    expect(
      shouldShowUpdateButton(
        { version: 'dev', commit: 'abcdef1', buildId: 'dev-abcdef1-20260603T210000Z' },
        { version: '', commit: '', buildId: '' }
      )
    ).toBe(false);
  });
});
