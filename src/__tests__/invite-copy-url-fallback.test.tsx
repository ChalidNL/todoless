import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteManager } from '../components/InviteManager';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) =>
      ({
        'invite.memberInviteTitle': 'Share member invite',
        'invite.memberLabel': 'Member',
        'invite.inviteCode': 'Invite code',
        'invite.inviteLink': 'Invite link',
        'invite.generatedHuman': 'Member invite generated',
        'invite.generateMember': 'Generate member invite',
        'invite.close': 'Close',
        'invite.copyUrl': 'Copy URL',
        'invite.urlCopied': 'URL copied!',
        'invite.copyFailed': 'Copy failed',
        'common.share': 'Share',
      })[key] || key,
  }),
}));

describe('InviteManager copy URL fallback (GH#83)', () => {
  const showCompletionMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    // Simulate a plain-HTTP install: no Clipboard API, non-secure context.
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    // jsdom has no execCommand; define it so the textarea fallback is testable.
    Object.defineProperty(document, 'execCommand', { configurable: true, value: undefined });
    useAppMock.mockReturnValue({
      inviteCodes: [],
      generateInviteCode: vi.fn().mockResolvedValue({ code: 'ABCDEF123456' }),
      deleteInviteCode: vi.fn(),
      showCompletionMessage,
    });
  });

  it('copies the invite URL via the textarea fallback without throwing on plain HTTP', async () => {
    const execMock = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execMock });
    render(<InviteManager />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate member invite' }));
    const copyButton = await screen.findByTitle('Copy URL');
    fireEvent.click(copyButton);

    await waitFor(() => expect(showCompletionMessage).toHaveBeenCalledWith('URL copied!'));
    expect(execMock).toHaveBeenCalledWith('copy');
    expect(document.body.querySelector('textarea')).toBeNull();
  });

  it('shows a failure message when the fallback copy cannot complete', async () => {
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn(() => false) });
    render(<InviteManager />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate member invite' }));
    const copyButton = await screen.findByTitle('Copy URL');
    fireEvent.click(copyButton);

    await waitFor(() => expect(showCompletionMessage).toHaveBeenCalledWith('Copy failed'));
  });
});