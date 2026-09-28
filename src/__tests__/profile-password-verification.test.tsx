import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileView } from '../components/ProfileView';

const { useAppMock } = vi.hoisted(() => ({
  useAppMock: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useApp: () => useAppMock() }));
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
  });

  it('sends the current password as oldPassword so PocketBase accepts the change (GH#66)', async () => {
    const updateUser = vi.fn().mockResolvedValue(true);
    const showCompletionMessage = vi.fn();
    useAppMock.mockReturnValue({
      users: [currentUser],
      appSettings: { currentUserId: currentUser.id },
      updateUser,
      showCompletionMessage,
    });
    render(<MemoryRouter><ProfileView /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'old-secret' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'new-secret' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'new-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('user-1', {
      password: 'new-secret',
      passwordConfirm: 'new-secret',
      oldPassword: 'old-secret',
    }));
    expect(showCompletionMessage).toHaveBeenCalledWith('Password updated successfully');
  });

  it('does not announce success when the password update fails', async () => {
    const updateUser = vi.fn().mockResolvedValue(false);
    const showCompletionMessage = vi.fn();
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

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('user-1', {
      password: 'new-secret',
      passwordConfirm: 'new-secret',
      oldPassword: 'wrong',
    }));
    expect(showCompletionMessage).not.toHaveBeenCalledWith('Password updated successfully');
  });
});
