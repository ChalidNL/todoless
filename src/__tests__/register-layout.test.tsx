import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Register } from '../components/Register';

const signUp = vi.fn();

vi.mock('../components/AuthProvider', () => ({
  useAuth: () => ({ signUp }),
}));

vi.mock('../components/shared/AppLogo', () => ({
  AppLogo: () => <div>todoless</div>,
}));

vi.mock('../lib/pocketbase-client', () => ({
  api: {
    validateInviteCode: vi.fn(),
    markOnboardingSeen: vi.fn(),
  },
}));

describe('invite registration layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/register?invite=AAAAAAAAAAAA');
    signUp.mockResolvedValue({ error: null });
  });

  it('uses a responsive, content-driven form layout with readable wrapped messages', async () => {
    const { container } = render(<Register onRegister={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Create Your Account' })).toBeInTheDocument();
    expect(container.querySelector('.auth-shell')).toBeInTheDocument();
    expect(container.querySelector('.auth-card')).toBeInTheDocument();
    expect(container.querySelector('.auth-form')).toBeInTheDocument();
    expect(screen.getByText('Invite code validated!')).toHaveClass('auth-message');

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByRole('alert')).toHaveClass('auth-message');
    expect(screen.getByRole('alert')).toHaveTextContent('First name is required');
  });

  it('keeps labels, autofill fields, password hints, and visibility controls separate and accessible', async () => {
    render(<Register onRegister={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Create Your Account' });

    expect(screen.getByLabelText('First Name')).toHaveAttribute('autocomplete', 'given-name');
    expect(screen.getByLabelText('Last Name')).toHaveAttribute('autocomplete', 'family-name');
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');

    const password = screen.getByLabelText('Password', { selector: 'input' });
    const confirmPassword = screen.getByLabelText('Confirm Password', { selector: 'input' });
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(confirmPassword).toHaveAttribute('autocomplete', 'new-password');
    expect(password).toHaveClass('auth-password-input');
    expect(screen.getByText('Minimum 6 characters')).toHaveClass('auth-hint');

    const visibilityButtons = screen.getAllByRole('button', { name: /password/i });
    expect(visibilityButtons).toHaveLength(2);
    visibilityButtons.forEach((button) => expect(button).toHaveClass('auth-visibility-button'));
  });
});
