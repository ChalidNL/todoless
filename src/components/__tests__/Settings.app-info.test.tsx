import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../shared/NewGlobalHeader', () => ({ NewGlobalHeader: () => <div data-testid="new-global-header" /> }));
vi.mock('../shared/TopBar', () => ({ TopBar: () => <div data-testid="top-bar" /> }));
vi.mock('../shared/LabelBadge', () => ({ LabelBadge: () => <div data-testid="label-badge" /> }));
vi.mock('../shared/FilterBuilder', () => ({ FilterBuilder: () => <div data-testid="filter-builder" /> }));
vi.mock('../ApiIntegrations', () => ({ ApiIntegrations: () => <div data-testid="api-integrations" /> }));
vi.mock('../shared/BulkImport', () => ({ BulkImport: () => <div data-testid="bulk-import" /> }));
vi.mock('../InviteManager', () => ({ InviteManager: () => <div data-testid="invite-manager" /> }));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    users: [{ id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'admin' }],
    appSettings: { currentUserId: 'u1' },
    updateAppSettings: vi.fn(),
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
    signOut: vi.fn(),
  }),
}));

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: vi.fn(),
  }),
}));

import { Settings } from '../Settings';

describe('Settings app info', () => {
  it('shows app info section with version and commit labels', () => {
    render(<Settings />);

    expect(screen.getByTestId('app-info')).toBeInTheDocument();
    expect(screen.getByText('App Info')).toBeInTheDocument();
    expect(screen.getByText('Version:')).toBeInTheDocument();
    expect(screen.getByText('Commit:')).toBeInTheDocument();
  });
});
