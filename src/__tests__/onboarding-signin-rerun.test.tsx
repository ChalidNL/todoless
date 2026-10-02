import React, { useEffect, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// The first-run check in App re-runs on every `user` change. The admin
// onboarding signs the user in when the account is created (step 'account'),
// so the check ran again while the onboarding was still on screen - and when
// the onboarding-seen flag had already been saved it routed straight into the
// app, skipping the final "Open todoless" step. Seen as a flaky E2E
// (01-onboarding-auth: "Open todoless" never appeared, the inbox was shown).

const { appState, authState, authListeners, fetchSetupStatus, hasUserSeenOnboarding } = vi.hoisted(() => ({
  fetchSetupStatus: vi.fn(),
  hasUserSeenOnboarding: vi.fn(),
  authListeners: new Set<() => void>(),
  authState: {
    user: null as { id: string } | null,
    isValid: false,
    record: null as { id: string } | null,
  },
  appState: { completionMessage: null, tasks: [], items: [], dataLoadState: 'ready' as const, loadError: null as string | null },
}));

const signIn = () => {
  authState.user = { id: 'admin-1' };
  authState.isValid = true;
  authState.record = { id: 'admin-1' };
  for (const notify of authListeners) notify();
};

vi.mock('../context/AppContext', () => ({
  AppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useApp: () => ({ ...appState, retryLoad: vi.fn() }),
}));
vi.mock('../context/LanguageContext', () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLanguage: () => ({ language: 'en' }),
}));
vi.mock('../components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  // re-renders consumers when the (mocked) auth store changes, like the real provider
  useAuth: () => {
    const [, force] = useState(0);
    useEffect(() => {
      const listener = () => force((n) => n + 1);
      authListeners.add(listener);
      return () => { authListeners.delete(listener); };
    }, []);
    return { user: authState.user, loading: false };
  },
}));
vi.mock('../lib/pocketbase', () => ({ pb: { authStore: authState } }));
vi.mock('../lib/bootstrap-status', () => ({ fetchSetupStatus }));
vi.mock('../lib/pocketbase-client', () => ({ api: { hasUserSeenOnboarding } }));
vi.mock('../components/InboxBacklog', () => ({ InboxBacklog: () => <div>Inbox route</div> }));
vi.mock('../components/Login', () => ({ Login: () => <div>Login</div> }));
vi.mock('../components/Register', () => ({ Register: () => <div>Register</div> }));
vi.mock('../components/Onboarding', () => ({
  // The account step: creating the account signs the user in and saves the
  // onboarding-seen flag; the onboarding then shows its 'done' step and only
  // its "Open todoless" button calls onComplete.
  Onboarding: ({ mode, onComplete }: { mode: string; onComplete: () => void }) => (
    <div>
      <span>Onboarding {mode}</span>
      <button type="button" onClick={() => { hasUserSeenOnboarding.mockResolvedValue(true); fetchSetupStatus.mockResolvedValue({ hasUsers: true, setupComplete: true }); signIn(); }}>Create account</button>
      <button type="button" onClick={onComplete}>Open todoless</button>
    </div>
  ),
}));

describe('admin onboarding: signing in during the account step', () => {
  beforeEach(() => {
    localStorage.clear();
    authState.user = null; authState.isValid = false; authState.record = null;
    fetchSetupStatus.mockReset(); hasUserSeenOnboarding.mockReset();
    fetchSetupStatus.mockResolvedValue({ hasUsers: false, setupComplete: false });
    hasUserSeenOnboarding.mockResolvedValue(false);
  });

  it('stays on the onboarding until "Open todoless" is pressed, even when the seen flag is already saved', async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByText('Onboarding admin')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    // give the re-run of the first-run check every chance to route away
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText('Onboarding admin')).toBeInTheDocument();
    expect(screen.queryByText('Inbox route')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open todoless' }));
    expect(await screen.findByText('Inbox route')).toBeInTheDocument();
  });
});
