import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const { appState, retryLoad } = vi.hoisted(() => ({
  retryLoad: vi.fn(),
  appState: {
    completionMessage: null,
    tasks: [],
    items: [],
    dataLoadState: 'loading' as 'loading' | 'ready' | 'error',
    loadError: null as string | null,
  },
}));

vi.mock('../context/AppContext', () => ({
  AppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useApp: () => ({ ...appState, retryLoad }),
}));
vi.mock('../context/LanguageContext', () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLanguage: () => ({ language: 'en' }),
}));
vi.mock('../components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}));
vi.mock('../lib/pocketbase', () => ({ pb: { authStore: { isValid: true, record: { id: 'user-1' } } } }));
vi.mock('../components/InboxBacklog', () => ({ InboxBacklog: () => <div>Inbox route</div> }));
vi.mock('../components/TasksView', () => ({ TasksView: () => <div>Tasks route</div> }));
vi.mock('../components/calendar/CalendarView', () => ({ CalendarView: () => <div>Calendar route</div> }));
vi.mock('../components/groceries/GroceriesView', () => ({ GroceriesView: () => <div>Groceries route</div> }));
vi.mock('../components/Settings', () => ({ Settings: () => <div>Settings route</div> }));
vi.mock('../components/MembersView', () => ({ MembersView: () => <div>Members route</div> }));
vi.mock('../components/LabelsView', () => ({ LabelsView: () => <div>Labels route</div> }));
vi.mock('../components/ShopsView', () => ({ ShopsView: () => <div>Shops route</div> }));
vi.mock('../components/ProfileView', () => ({ ProfileView: () => <div>Profile route</div> }));
vi.mock('../components/SettingsPreferences', () => ({ SettingsPreferences: () => <div>Preferences route</div> }));
vi.mock('../components/NotificationsView', () => ({ NotificationsView: () => <div>Notifications route</div> }));
vi.mock('../components/Onboarding', () => ({ Onboarding: () => <div>Onboarding</div> }));
vi.mock('../components/Login', () => ({ Login: () => <div>Login</div> }));
vi.mock('../components/Register', () => ({ Register: () => <div>Register</div> }));

describe('authenticated data loading states', () => {
  beforeEach(() => {
    localStorage.setItem('todoless_onboarding_completed', 'user:user-1');
    appState.dataLoadState = 'loading';
    appState.loadError = null;
    retryLoad.mockReset();
  });

  it('shows a distinct loading state instead of an empty route', async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText('Inbox route')).not.toBeInTheDocument();
  });

  it('shows a retryable error state instead of an empty route', async () => {
    appState.dataLoadState = 'error';
    appState.loadError = 'Network unavailable';
    render(<MemoryRouter><App /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retryLoad).toHaveBeenCalledTimes(1);
  });
});
