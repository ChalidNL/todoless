import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileView } from '../components/ProfileView';

const { useAppMock, login } = vi.hoisted(() => ({
  useAppMock: vi.fn(),
  login: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useApp: () => useAppMock() }));
vi.mock('../lib/pocketbase-client', () => ({ api: { login } }));
vi.mock('../components/shared/SettingsDetailHeader', () => ({
  SettingsDetailHeader: () => <div>Profile header</div>,
}));

const currentUser = {
  id: 'user-1',
  email: 'user@example.com',
  firstName: 'Test',
  lastName: 'User',
  language: 'en',
  role: 'member',
};

describe('profile password verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue({
      users: [currentUser],
      appSettings: { currentUserId: currentUser.id },
      updateUser: vi.fn().mockResolvedValue(true),
      showCompletionMessage: vi.fn(),
    });
    login.mockResolvedValue(currentUser);
  });

  it('verifies the current password before changing it', async () => {
    const updateUser = vi.fn().mockResolvedValue(true);
    useAppMock.mockReturnValue({
      users: [currentUser],
      appSettings: { currentUserId: currentUser.id },
      updateUser,
      showCompletionMessage: vi.fn(),
    });
    render(<MemoryRouter><ProfileView /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'old-secret' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'new-secret' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'new-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('user@example.com', 'old-secret'));
    expect(updateUser).toHaveBeenCalledWith('user-1', {
      password: 'new-secret',
      passwordConfirm: 'new-secret',
    });
  });

  it('does not change the password when current-password verification fails', async () => {
    const updateUser = vi.fn().mockResolvedValue(true);
    const showCompletionMessage = vi.fn();
    login.mockRejectedValue(new Error('invalid'));
    useAppMock.mockReturnValue({
      users: [currentUser],
      appSettings: { currentUserId: currentUser.id },
      updateUser,
      showCompletionMessage,
    });
    render(<MemoryRouter><ProfileView /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'new-secret' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'new-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => expect(showCompletionMessage).toHaveBeenCalledWith('Current password is incorrect'));
    expect(updateUser).not.toHaveBeenCalled();
  });
});
