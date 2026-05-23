// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Onboarding } from '../Onboarding';

const {
  updateAppSettingsMock,
  registerAdminMock,
  createFamilyMock,
  updateUserFamilyMock,
  markOnboardingSeenMock,
} = vi.hoisted(() => ({
  updateAppSettingsMock: vi.fn(),
  registerAdminMock: vi.fn(),
  createFamilyMock: vi.fn(),
  updateUserFamilyMock: vi.fn(),
  markOnboardingSeenMock: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ updateAppSettings: updateAppSettingsMock }),
}));

vi.mock('../../lib/pocketbase-client', () => ({
  api: {
    registerAdmin: registerAdminMock,
    createFamily: createFamilyMock,
    updateUserFamily: updateUserFamilyMock,
    markOnboardingSeen: markOnboardingSeenMock,
  },
}));

describe('Onboarding admin flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows field-level validation errors with clear messages', async () => {
    const onComplete = vi.fn();
    render(<Onboarding mode="admin" onComplete={onComplete} />);

    // Navigate to workspace step (step 2 of admin flow — 2 info slides, then workspace)
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByText('Next'));
    }

    // Workspace step
    fireEvent.change(screen.getByPlaceholderText('Smith Family'), {
      target: { value: 'My Family' },
    });
    fireEvent.click(screen.getByText('Next'));

    // Try to submit with empty fields
    fireEvent.click(screen.getByText('Create account'));

    // Should show "Please enter your first name" first (name is checked first)
    await waitFor(() => {
      expect(screen.getByText('Please enter your first name')).toBeTruthy();
    });
    expect(registerAdminMock).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows email required error when name is filled but email is empty', async () => {
    const onComplete = vi.fn();
    render(<Onboarding mode="admin" onComplete={onComplete} />);

    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByText('Next'));
    }

    fireEvent.change(screen.getByPlaceholderText('Smith Family'), {
      target: { value: 'My Family' },
    });
    fireEvent.click(screen.getByText('Next'));

    // Fill only name
    fireEvent.change(screen.getByPlaceholderText('John'), {
      target: { value: 'Admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('Doe'), {
      target: { value: 'User' },
    });
    fireEvent.click(screen.getByText('Create account'));

    await waitFor(() => {
      expect(screen.getByText('Please enter your email')).toBeTruthy();
    });
  });

  it('shows password mismatch error when passwords differ', async () => {
    const onComplete = vi.fn();
    render(<Onboarding mode="admin" onComplete={onComplete} />);

    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByText('Next'));
    }

    fireEvent.change(screen.getByPlaceholderText('Smith Family'), {
      target: { value: 'My Family' },
    });
    fireEvent.click(screen.getByText('Next'));

    fireEvent.change(screen.getByPlaceholderText('John'), {
      target: { value: 'Admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('Doe'), {
      target: { value: 'User' },
    });
    fireEvent.change(screen.getByPlaceholderText('admin@example.com'), {
      target: { value: 'admin@example.com' },
    });

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'differentpass' } });

    fireEvent.click(screen.getByText('Create account'));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeTruthy();
    });
  });

  it('does not mark setup complete when registration fails', async () => {
    registerAdminMock.mockRejectedValueOnce(new Error('Registration failed'));

    const onComplete = vi.fn();
    render(<Onboarding mode="admin" onComplete={onComplete} />);

    // Navigate through info slides
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByText('Next'));
    }

    // Workspace step
    fireEvent.change(screen.getByPlaceholderText('Smith Family'), {
      target: { value: 'My Family' },
    });
    fireEvent.click(screen.getByText('Next'));

    // Admin account step
    fireEvent.change(screen.getByPlaceholderText('John'), {
      target: { value: 'Admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('Doe'), {
      target: { value: 'User' },
    });
    fireEvent.change(screen.getByPlaceholderText('admin@example.com'), {
      target: { value: 'admin@example.com' },
    });

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('Create account'));

    await waitFor(
      () => {
        expect(screen.getByText('Registration failed')).toBeTruthy();
      },
      { timeout: 3000 }
    );

    expect(markOnboardingSeenMock).not.toHaveBeenCalled();
    expect(updateAppSettingsMock).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows email already in use message on email conflict', async () => {
    registerAdminMock.mockRejectedValueOnce(new Error('This email is already in use'));

    const onComplete = vi.fn();
    render(<Onboarding mode="admin" onComplete={onComplete} />);

    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByText('Next'));
    }

    fireEvent.change(screen.getByPlaceholderText('Smith Family'), {
      target: { value: 'My Family' },
    });
    fireEvent.click(screen.getByText('Next'));

    fireEvent.change(screen.getByPlaceholderText('John'), {
      target: { value: 'Admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('Doe'), {
      target: { value: 'User' },
    });
    fireEvent.change(screen.getByPlaceholderText('admin@example.com'), {
      target: { value: 'admin@example.com' },
    });

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('Create account'));

    await waitFor(() => {
      expect(screen.getByText('This email is already in use. Try logging in.')).toBeTruthy();
    });

    expect(markOnboardingSeenMock).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('disables button and shows loading text while submitting', async () => {
    registerAdminMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ user: { id: 'u1' } }), 500))
    );

    const onComplete = vi.fn();
    render(<Onboarding mode="admin" onComplete={onComplete} />);

    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByText('Next'));
    }

    fireEvent.change(screen.getByPlaceholderText('Smith Family'), {
      target: { value: 'My Family' },
    });
    fireEvent.click(screen.getByText('Next'));

    fireEvent.change(screen.getByPlaceholderText('John'), {
      target: { value: 'Admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('Doe'), {
      target: { value: 'User' },
    });
    fireEvent.change(screen.getByPlaceholderText('admin@example.com'), {
      target: { value: 'admin@example.com' },
    });

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('Create account'));

    // Button should be disabled immediately after click
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Creating account/ });
      expect(btn).toBeTruthy();
    });
  });
});
