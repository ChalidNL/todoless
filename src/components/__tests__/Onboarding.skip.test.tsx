import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ updateAppSettings: vi.fn() }),
}));

vi.mock('../AuthProvider', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock('../../lib/pocketbase-client', () => ({
  api: {
    markOnboardingSeen: vi.fn(async () => {}),
    registerAdmin: vi.fn(async () => ({})),
  },
}));

vi.mock('../../lib/pocketbase', () => ({
  pb: {},
}));

const { Onboarding } = await import('../Onboarding');

describe('Onboarding skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skip button in admin mode and triggers onComplete', () => {
    const onComplete = vi.fn();
    render(<Onboarding mode="admin" onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
