import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteManager } from '../components/InviteManager';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'invite.memberInviteTitle': 'Share member invite',
      'invite.memberLabel': 'Member',
      'invite.inviteCode': 'Invite code',
      'invite.inviteLink': 'Invite link',
      'invite.generatedHuman': 'Member invite generated',
      'invite.generateMember': 'Generate member invite',
      'invite.close': 'Close',
      'common.share': 'Share',
    }[key] || key),
  }),
}));

describe('InviteManager mobile dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue({
      inviteCodes: [],
      generateInviteCode: vi.fn().mockResolvedValue({ code: 'ABCDEF123456' }),
      deleteInviteCode: vi.fn(),
      showCompletionMessage: vi.fn(),
    });
  });

  it('renders the generated invite as an isolated mobile-safe dialog', async () => {
    render(<InviteManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate member invite' }));

    const dialog = await screen.findByRole('dialog', { name: 'Share member invite' });
    expect(dialog.classList.contains('invite-share-dialog')).toBe(true);
    expect(dialog.parentElement?.classList.contains('invite-share-overlay')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(dialog.querySelector('.invite-share-content')).not.toBeNull();

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.style.overflow).toBe('');
  });
});
