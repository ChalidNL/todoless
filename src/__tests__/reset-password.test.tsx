import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPassword, extractResetToken } from '../components/ResetPassword';

const confirmPasswordReset = vi.fn();

vi.mock('../lib/pocketbase-client', () => ({
  api: {
    confirmPasswordReset: (...args: unknown[]) => confirmPasswordReset(...args),
  },
}));

vi.mock('../components/shared/AppLogo', () => ({
  AppLogo: () => <div>todoless</div>,
}));

describe('reset password flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmPasswordReset.mockResolvedValue(undefined);
  });

  it('extracts the token from a ?token= query param', () => {
    expect(
      extractResetToken({ search: '?token=abc123def456', hash: '' } as Location),
    ).toBe('abc123def456');
  });

  it('extracts the token from the PB default hash route', () => {
    expect(
      extractResetToken({ search: '', hash: '#/confirm-password-reset/xyz789' } as Location),
    ).toBe('xyz789');
  });

  it('resets the password and reports success', async () => {
    render(<ResetPassword token="tok123" onResetComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Password', { selector: 'input' }), {
      target: { value: 'newpass123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password', { selector: 'input' }), {
      target: { value: 'newpass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(confirmPasswordReset).toHaveBeenCalledWith('tok123', 'newpass123', 'newpass123');
    expect(await screen.findByText('Your password has been updated.')).toBeInTheDocument();
  });

  it('rejects mismatched passwords without calling the API', async () => {
    render(<ResetPassword token="tok123" onResetComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Password', { selector: 'input' }), {
      target: { value: 'newpass123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password', { selector: 'input' }), {
      target: { value: 'different' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('shows an invalid-link message for expired tokens', async () => {
    confirmPasswordReset.mockRejectedValue({ data: { message: 'Invalid or expired token.' } });
    render(<ResetPassword token="expired" onResetComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Password', { selector: 'input' }), {
      target: { value: 'newpass123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password', { selector: 'input' }), {
      target: { value: 'newpass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This password reset link is invalid or has expired.',
    );
  });
});