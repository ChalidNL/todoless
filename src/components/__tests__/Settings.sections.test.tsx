import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../shared/NewGlobalHeader', () => ({ NewGlobalHeader: () => <div data-testid="new-global-header" /> }));
vi.mock('../shared/TopBar', () => ({ TopBar: () => <div data-testid="top-bar" /> }));
vi.mock('../shared/LabelBadge', () => ({ LabelBadge: () => <div data-testid="label-badge" /> }));
vi.mock('../shared/FilterBuilder', () => ({ FilterBuilder: () => <div data-testid="filter-builder" /> }));
vi.mock('../ApiIntegrations', () => ({ ApiIntegrations: () => <div data-testid="api-integrations" /> }));
vi.mock('../shared/BulkImport', () => ({ BulkImport: () => <div data-testid="bulk-import" /> }));
vi.mock('../InviteManager', () => ({ InviteManager: () => <div data-testid="invite-manager" /> }));

const mockUpdateAppSettings = vi.fn();
const mockSetLanguage = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    users: [{ id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'admin' }],
    appSettings: {
      currentUserId: 'u1',
      theme: 'light',
      language: 'en',
      sprintDuration: '2weeks',
      sprintStartDay: 1,
      notificationEmail: false,
      notificationPush: false,
      taskReminders: true,
      reminderMinutes: 15,
    },
    updateAppSettings: mockUpdateAppSettings,
    updateUser: vi.fn(),
    labels: [],
    addLabel: vi.fn(),
    updateLabel: vi.fn(),
    deleteLabel: vi.fn(),
    shops: [],
    addShop: vi.fn(),
    updateShop: vi.fn(),
    deleteShop: vi.fn(),
    filters: [],
    deleteFilter: vi.fn(),
    sprints: [],
    createNewSprint: vi.fn(),
    currentSprint: null,
    deleteSprint: vi.fn(),
    tasks: [],
    archiveCompletedSprintTasks: vi.fn(),
    archiveAllDoneTasks: vi.fn(),
    deleteArchivedTasks: vi.fn(),
    showCompletionMessage: vi.fn(),
  }),
}));

vi.mock('../AuthProvider', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
  }),
}));

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: mockSetLanguage,
    t: (key: string) => key,
  }),
}));

import { Settings } from '../Settings';

describe('Settings Preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Preferences section header', () => {
    render(<Settings />);
    expect(screen.getByText('Preferences')).toBeInTheDocument();
  });

  it('shows theme options when Preferences is expanded', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Preferences'));
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('shows language selector when Preferences is expanded', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Preferences'));
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Nederlands')).toBeInTheDocument();
  });

  it('shows sprint duration selector when Preferences is expanded', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Preferences'));
    expect(screen.getByText('1 Week')).toBeInTheDocument();
    expect(screen.getByText('2 Weeks')).toBeInTheDocument();
  });

  it('calls updateAppSettings with dark theme when Dark is clicked', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Preferences'));
    fireEvent.click(screen.getByText('Dark'));
    expect(mockUpdateAppSettings).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('calls updateAppSettings with light theme when Light is clicked', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Preferences'));
    fireEvent.click(screen.getByText('Light'));
    expect(mockUpdateAppSettings).toHaveBeenCalledWith({ theme: 'light' });
  });

  it('calls setLanguage when language is changed', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Preferences'));
    const selects = screen.getAllByRole('combobox');
    const languageSelect = selects.find(s => s.closest('div')?.textContent?.includes('English'));
    expect(languageSelect).toBeDefined();
    fireEvent.change(languageSelect!, { target: { value: 'nl' } });
    expect(mockSetLanguage).toHaveBeenCalledWith('nl');
  });

  it('calls updateAppSettings when sprint duration is changed', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Preferences'));
    const selects = screen.getAllByRole('combobox');
    const sprintSelect = selects.find(s => s.closest('div')?.textContent?.includes('Weeks'));
    expect(sprintSelect).toBeDefined();
    fireEvent.change(sprintSelect!, { target: { value: '4weeks' } });
    expect(mockUpdateAppSettings).toHaveBeenCalledWith({ sprintDuration: '4weeks' });
  });
});

describe('Settings Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Notifications section header', () => {
    render(<Settings />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('shows notification toggles when expanded', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Notifications'));
    expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    expect(screen.getByText('Push Notifications')).toBeInTheDocument();
    expect(screen.getByText('Task Reminders')).toBeInTheDocument();
  });

  it('shows reminder time selector when task reminders are enabled', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Notifications'));
    // The mock has taskReminders: true, so the select should be visible
    expect(screen.getByText('15 minutes before')).toBeInTheDocument();
    expect(screen.getByText('5 minutes before')).toBeInTheDocument();
  });

  it('toggles email notifications on click', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Notifications'));
    fireEvent.click(screen.getByLabelText('Toggle email notifications'));
    expect(mockUpdateAppSettings).toHaveBeenCalledWith({ notificationEmail: true });
  });

  it('toggles push notifications on click', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Notifications'));
    fireEvent.click(screen.getByLabelText('Toggle push notifications'));
    expect(mockUpdateAppSettings).toHaveBeenCalledWith({ notificationPush: true });
  });

  it('toggles task reminders on click', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Notifications'));
    fireEvent.click(screen.getByLabelText('Toggle task reminders'));
    expect(mockUpdateAppSettings).toHaveBeenCalledWith({ taskReminders: false });
  });
});

describe('Settings Account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Account section header', () => {
    render(<Settings />);
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('shows danger zone when Account is expanded', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Account'));
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
  });

  it('shows Delete Account button when expanded', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Account'));
    expect(screen.getByText('Delete Account')).toBeInTheDocument();
  });

  it('shows warning text about permanent deletion', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Account'));
    expect(screen.getByText(/Deleting your account will permanently remove all your data/)).toBeInTheDocument();
  });
});
