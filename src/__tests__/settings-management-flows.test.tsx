import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembersView } from '../components/MembersView';
import { LabelsView } from '../components/LabelsView';
import { ShopsView } from '../components/ShopsView';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../components/shared/SettingsDetailHeader', () => ({
  SettingsDetailHeader: ({ onAdd }: { onAdd?: () => void }) => (
    <button type="button" onClick={onAdd}>Header add</button>
  ),
}));

vi.mock('../components/InviteManager', () => ({
  InviteManager: () => <div>Invite manager</div>,
}));

vi.mock('../components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

const member = {
  id: 'member-1',
  name: 'Member One',
  email: 'member@example.com',
  role: 'member',
  active: true,
  member_type: 'human',
};

const baseApp = {
  appSettings: { currentUserId: 'admin-1' },
  users: [
    { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'admin', active: true },
    member,
  ],
  labels: [{ id: 'label-1', name: 'Family', color: '#6366f1', visibility: 'family' }],
  shops: [{ id: 'shop-1', name: 'Market', color: '#ec4899' }],
  addLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
  addShop: vi.fn(),
  updateShop: vi.fn(),
  deleteShop: vi.fn(),
  updateUser: vi.fn().mockResolvedValue(true),
  deleteUser: vi.fn().mockResolvedValue(true),
  showCompletionMessage: vi.fn(),
};

describe('redesign settings management parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue({ ...baseApp });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('lets an admin manage member role, active state and deletion from Members', async () => {
    const updateUser = vi.fn().mockResolvedValue(true);
    const deleteUser = vi.fn().mockResolvedValue(true);
    useAppMock.mockReturnValue({ ...baseApp, updateUser, deleteUser });

    render(<MembersView />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage Member One' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make admin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Member' }));

    expect(updateUser).toHaveBeenCalledWith('member-1', { role: 'admin' });
    expect(updateUser).toHaveBeenCalledWith('member-1', {
      active: false,
      member_status: 'blocked',
    });
    expect(deleteUser).toHaveBeenCalledWith('member-1');
  });

  it('creates a shared label for selected family members', () => {
    const addLabel = vi.fn();
    useAppMock.mockReturnValue({ ...baseApp, addLabel });

    render(<LabelsView />);
    fireEvent.click(screen.getByRole('button', { name: 'Header add' }));
    fireEvent.change(screen.getByPlaceholderText(/label name/i), { target: { value: 'Shared project' } });
    fireEvent.click(screen.getByRole('button', { name: 'Shared' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Member One' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(addLabel).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Shared project',
      visibility: 'shared',
      isPrivate: false,
      sharedWith: ['member-1'],
    }));
  });

  it('requires confirmation and deletes a label from its expanded redesign card', () => {
    const deleteLabel = vi.fn();
    useAppMock.mockReturnValue({ ...baseApp, deleteLabel });

    render(<LabelsView />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Family' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(deleteLabel).toHaveBeenCalledWith('label-1');
  });

  it('requires confirmation and deletes a shop from its edit dialog', () => {
    const deleteShop = vi.fn();
    useAppMock.mockReturnValue({ ...baseApp, deleteShop });

    render(<ShopsView />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Market' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(deleteShop).toHaveBeenCalledWith('shop-1');
  });
});
