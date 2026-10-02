import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
  labels: [
    { id: 'label-1', name: 'Family', color: '#6366f1', visibility: 'family', owner: 'admin-1' },
    { id: 'label-2', name: 'Member Label', color: '#22c55e', visibility: 'family', owner: 'member-1' },
  ],
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
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

    expect(updateUser).toHaveBeenCalledWith('member-1', { role: 'admin' });
    expect(updateUser).toHaveBeenCalledWith('member-1', {
      active: false,
      member_status: 'blocked',
    });
    expect(deleteUser).toHaveBeenCalledWith('member-1');
  });

  it('does not offer role/block/delete on the owner, and translates the role chip', () => {
    const owner = { id: 'owner-1', name: 'Owner One', email: 'owner@example.com', role: 'owner', active: true, member_type: 'human' };
    useAppMock.mockReturnValue({ ...baseApp, users: [...baseApp.users, owner] });

    render(<MembersView />);
    // the server answers 403 to set_role / set_user_block / delete_user for the owner
    expect(screen.queryByRole('button', { name: 'Manage Owner One' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Manage Member One' })).toBeInTheDocument();
    // role chips are translated labels, not raw role strings
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.queryByText('owner')).toBeNull();
    expect(screen.queryByText('member')).toBeNull();
    expect(screen.getByText('Member')).toBeInTheDocument();
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

  it('offers edit controls only for labels owned by the current user', () => {
    useAppMock.mockReturnValue({
      ...baseApp,
      labels: [
        { id: 'label-1', name: 'Family', color: '#6366f1', visibility: 'family', owner: 'admin-1' },
        { id: 'label-2', name: 'Member Label', color: '#22c55e', visibility: 'family', owner: 'member-1' },
      ],
    });

    render(<LabelsView />);

    expect(screen.getByRole('button', { name: 'Edit label: Family' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Member Label' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('labels another member owns render as read-only rows with an owner hint', () => {
    useAppMock.mockReturnValue({
      ...baseApp,
      labels: [
        { id: 'label-1', name: 'Family', color: '#6366f1', visibility: 'family', owner: 'admin-1' },
        { id: 'label-2', name: 'Member Label', color: '#22c55e', visibility: 'family', owner: 'member-1' },
      ],
    });

    render(<LabelsView />);

    expect(screen.getByLabelText(/read-only label by Member One/i)).toBeTruthy();
  });

  it('does not offer edit or delete when a label has no resolved owner', () => {
    useAppMock.mockReturnValue({
      ...baseApp,
      labels: [{ id: 'legacy-1', name: 'Legacy', color: '#6366f1', visibility: 'family' }],
    });

    render(<LabelsView />);

    expect(screen.queryByRole('button', { name: 'Edit Legacy' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('requires confirmation and deletes a label from its expanded redesign card', () => {
    const deleteLabel = vi.fn();
    useAppMock.mockReturnValue({ ...baseApp, deleteLabel });

    render(<LabelsView />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit label: Family' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteLabel).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(deleteLabel).toHaveBeenCalledWith('label-1');
  });

  it('requires confirmation and deletes a shop from its edit dialog', () => {
    const deleteShop = vi.fn();
    useAppMock.mockReturnValue({ ...baseApp, deleteShop });

    render(<ShopsView />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Market' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // In-app confirmation (no native window.confirm in the installed PWA).
    const dialog = screen.getByRole('alertdialog');
    expect(deleteShop).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(deleteShop).toHaveBeenCalledWith('shop-1');
  });
});
