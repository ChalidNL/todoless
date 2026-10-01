import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InviteManager } from '../components/InviteManager';
import { timeLeft } from '../lib/time-left';

const useAppMock = vi.fn();
vi.mock('../context/AppContext', () => ({ useApp: () => useAppMock() }));
vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'invite.minutesRemaining': '{n} minutes remaining',
      'invite.hoursRemaining': '{n} hours remaining',
      'invite.daysRemaining': '{n} days remaining',
      'invite.generateMember': 'Generate member invite',
    }[key] || key),
  }),
}));

// Invites live for 7 days; the list used to say "10079 minutes remaining".
describe('invite expiry wording', () => {
  it('picks the largest whole unit', () => {
    expect(timeLeft(7 * 24 * 60 * 60_000 - 60_000)).toEqual({ unit: 'days', n: 6 });
    expect(timeLeft(90 * 60_000)).toEqual({ unit: 'hours', n: 1 });
    expect(timeLeft(59 * 60_000)).toEqual({ unit: 'minutes', n: 59 });
    expect(timeLeft(-5)).toEqual({ unit: 'minutes', n: 0 });
  });

  it('renders a fresh 7-day invite in days, not minutes', () => {
    useAppMock.mockReturnValue({
      inviteCodes: [{ id: 'i1', code: 'ABCDEF123456', createdBy: 'u1', createdAt: Date.now(), expiresAt: Date.now() + 7 * 24 * 60 * 60_000 - 1000, used: false, type: 'human' }],
      generateInviteCode: vi.fn(), deleteInviteCode: vi.fn(), showCompletionMessage: vi.fn(),
    });
    render(<InviteManager />);
    expect(screen.getByText('6 days remaining')).toBeInTheDocument();
    expect(screen.queryByText(/minutes remaining/)).toBeNull();
  });
});
