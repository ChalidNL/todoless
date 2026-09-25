import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from '../components/Login';

const signIn = vi.fn();
vi.mock('../components/AuthProvider', () => ({
  useAuth: () => ({ signIn }),
}));
vi.mock('../components/shared/AppLogo', () => ({
  AppLogo: () => <div>todoless</div>,
}));

describe('redesign login accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn.mockResolvedValue({ error: null });
  });

  it('associates labels and gives the password visibility control a 44px accessible target', () => {
    render(<Login onLogin={vi.fn()} />);

    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    const passwordInput = screen.getByLabelText('Password', { selector: 'input' });
    expect(passwordInput).toHaveAttribute('type', 'password');
    const visibility = screen.getByRole('button', { name: 'Password' });
    expect(visibility).toHaveClass('h-11', 'w-11');
    expect(visibility).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(visibility);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(visibility).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses the shared redesign surface and announces validation errors', () => {
    const { container } = render(<Login onLogin={vi.fn()} />);
    expect(container.querySelector('.app-shell-bg')).toBeInTheDocument();
    expect(container.querySelector('.app-surface')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter email and password');
  });
});
