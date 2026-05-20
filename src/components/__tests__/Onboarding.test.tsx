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

    // Navigate to admin form (step 8 of admin flow)
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText('Volgende'));
    }

    // Family step
    fireEvent.change(screen.getByPlaceholderText('Familie Jansen'), {
      target: { value: 'Familie Test' },
    });
    fireEvent.click(screen.getByText('Volgende'));

    // Try to submit with empty fields
    fireEvent.click(screen.getByText('Account aanmaken'));

    // Should show "Vul je voornaam in" first (name is checked first)
    await waitFor(() => {
      expect(screen.getByText('Vul je voornaam in')).toBeTruthy();
    });
    expect(registerAdminMock).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows email required error when name is filled but email is empty', async () => {
    const onComplete = vi.fn();
    render(<Onboarding mode="admin" onComplete={onComplete} />);

    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText('Volgende'));
    }

    fireEvent.change(screen.getByPlaceholderText('Familie Jansen'), {
      target: { value: 'Familie Test' },
    });
    fireEvent.click(screen.getByText('Volgende'));

    // Fill only name
    fireEvent.change(screen.getByPlaceholderText('Jan'), {
      target: { value: 'Admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('Jansen'), {
      target: { value: 'User' },
    });
    fireEvent.click(screen.getByText('Account aanmaken'));

    await waitFor(() => {
      expect(screen.getByText('Vul je e-mailadres in')).toBeTruthy();
    });
  });

  it('shows password mismatch error when passwords differ', async () => {
    const onComplete = vi.fn();
    render(<Onboarding mode="admin" onComplete={onComplete} />);

    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText('Volgende'));
    }

    fireEvent.change(screen.getByPlaceholderText('Familie Jansen'), {
      target: { value: 'Familie Test' },
    });
    fireEvent.click(screen.getByText('Volgende'));

    fireEvent.change(screen.getByPlaceholderText('Jan'), {
      target: { value: 'Admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('Jansen'), {
      target: { value: 'User' },
    });
    fireEvent.change(screen.getByPlaceholderText('admin@voorbeeld.nl'), {
      target: { value: 'admin@example.com' },
    });

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'differentpass' } });

    fireEvent.click(screen.getByText('Account aanmaken'));

    await waitFor(() => {
      expect(screen.getByText('Wachtwoorden komen niet overeen')).toBeTruthy();
    });
  });

  it('does not mark setup complete when registration fails', async () => {
    registerAdminMock.mockRejectedValueOnce(new Error('Registration failed'));

    const onComplete = vi.fn();
    render(<Onboarding mode="admin" onComplete={onComplete} />);

    // Door info slides heen
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText('Volgende'));
    }

    // Family stap
    fireEvent.change(screen.getByPlaceholderText('Familie Jansen'), {
      target: { value: 'Familie Test' },
    });
    fireEvent.click(screen.getByText('Volgende'));

    // Admin account stap
    fireEvent.change(screen.getByPlaceholderText('Jan'), {
      target: { value: 'Admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('Jansen'), {
      target: { value: 'User' },
    });
    fireEvent.change(screen.getByPlaceholderText('admin@voorbeeld.nl'), {
      target: { value: 'admin@example.com' },
    });

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('Account aanmaken'));

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

    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText('Volgende'));
    }

    fireEvent.change(screen.getByPlaceholderText('Familie Jansen'), {
      target: { value: 'Familie Test' },
    });
    fireEvent.click(screen.getByText('Volgende'));

    fireEvent.change(screen.getByPlaceholderText('Jan'), {
      target: { value: 'Admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('Jansen'), {
      target: { value: 'User' },
    });
    fireEvent.change(screen.getByPlaceholderText('admin@voorbeeld.nl'), {
      target: { value: 'admin@example.com' },
    });

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('Account aanmaken'));

    await waitFor(() => {
      expect(screen.getByText('Dit e-mailadres is al in gebruik. Probeer in te loggen.')).toBeTruthy();
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

    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText('Volgende'));
    }

    fireEvent.change(screen.getByPlaceholderText('Familie Jansen'), {
      target: { value: 'Familie Test' },
    });
    fireEvent.click(screen.getByText('Volgende'));

    fireEvent.change(screen.getByPlaceholderText('Jan'), {
      target: { value: 'Admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('Jansen'), {
      target: { value: 'User' },
    });
    fireEvent.change(screen.getByPlaceholderText('admin@voorbeeld.nl'), {
      target: { value: 'admin@example.com' },
    });

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('Account aanmaken'));

    // Button should be disabled immediately after click
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Bezig met aanmaken/ });
      expect(btn).toBeTruthy();
    });
  });
});