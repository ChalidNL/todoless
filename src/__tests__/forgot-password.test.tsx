import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPassword } from '../components/ForgotPassword';

const requestPasswordReset = vi.fn();

vi.mock('../lib/pocketbase-client', () => ({
  api: {
    requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
  },
}));

vi.mock('../components/shared/AppLogo', () => ({
  AppLogo: () => <div>todoless</div>,
}));

describe('forgot password flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestPasswordReset.mockResolvedValue(undefined);
  });

  it('requests a reset link and always shows the same confirmation (no account leak)', async () => {
    render(<ForgotPassword onBackToLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(requestPasswordReset).toHaveBeenCalledWith('user@example.com');
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for this email/)).toBeInTheDocument();
  });

  it('shows the same confirmation when the server rejects (SMTP missing => no leak)', async () => {
    requestPasswordReset.mockRejectedValue(new Error('Failed to send password reset email'));
    render(<ForgotPassword onBackToLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  it('validates the email before calling the API', async () => {
    render(<ForgotPassword onBackToLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a valid email address');
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('offers a way back to the login screen', () => {
    const onBackToLogin = vi.fn();
    render(<ForgotPassword onBackToLogin={onBackToLogin} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to login' }));
    expect(onBackToLogin).toHaveBeenCalled();
  });
});