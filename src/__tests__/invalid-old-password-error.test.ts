import { describe, expect, it } from 'vitest';
import { isInvalidOldPasswordError } from '../lib/pocketbase-client';

describe('isInvalidOldPasswordError', () => {
  it('recognises the PocketBase 400 field error for a wrong old password (GH#66)', () => {
    const err = {
      status: 400,
      response: {
        data: {
          oldPassword: { code: 'validation_invalid_old_password', message: 'Missing or invalid old password.' },
        },
        message: 'Failed to update record.',
      },
    };
    expect(isInvalidOldPasswordError(err)).toBe(true);
  });

  it('recognises the PocketBase blank-oldPassword error', () => {
    const err = {
      response: {
        data: {
          oldPassword: { code: 'validation_required', message: 'Cannot be blank.' },
        },
      },
    };
    expect(isInvalidOldPasswordError(err)).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isInvalidOldPasswordError(new Error('network down'))).toBe(false);
    expect(isInvalidOldPasswordError({
      response: { data: { password: { code: 'validation_min_length' } } },
    })).toBe(false);
    expect(isInvalidOldPasswordError(null)).toBe(false);
  });
});