import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Settings } from '../components/Settings';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'admin-1' }, signOut: vi.fn() }),
}));

vi.mock('../lib/pocketbase-client', () => ({
  api: {
    getFamilyById: vi.fn().mockResolvedValue({ name: 'Family' }),
  },
}));

vi.mock('../lib/pocketbase', () => ({
  pb: { authStore: { token: 'token' } },
}));

vi.mock('../lib/app-update', () => ({
  fetchLatestAppVersion: vi.fn().mockResolvedValue(null),
  forceRefreshApp: vi.fn(),
  getNormalizedAppVersion: vi.fn().mockReturnValue('dev'),
  shouldShowUpdateButton: vi.fn().mockReturnValue(false),
}));

vi.mock('../components/shared/NewGlobalHeader', () => ({
  AppHeader: () => <header>App header</header>,
}));

const baseAppValue = {
  users: [{ id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'owner', member_type: 'human' }],
  appSettings: { currentUserId: 'admin-1' },
  updateAppSettings: vi.fn(),
  updateUser: vi.fn().mockResolvedValue(true),
  deleteUser: vi.fn().mockResolvedValue(true),
  labels: [],
  addLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
  shops: [],
  addShop: vi.fn(),
  updateShop: vi.fn(),
  deleteShop: vi.fn(),
  tasks: [],
  showCompletionMessage: vi.fn(),
};

function renderSettingsHub() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/profile" element={<div>PROFILE_ROUTE</div>} />
        <Route path="/settings/members" element={<div>MEMBERS_ROUTE</div>} />
        <Route path="/settings/preferences" element={<div>PREFERENCES_ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('settings hub navigation (GH#74)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue({ ...baseAppValue });
    vi.stubGlobal('__APP_VERSION__', 'dev');
    vi.stubGlobal('__APP_COMMIT__', 'local');
    vi.stubGlobal('__APP_BUILD_ID__', 'test');
  });

  it('navigates to the profile route through the SPA router when the profile card is clicked', () => {
    renderSettingsHub();

    const profileLink = screen.getByRole('link', { name: /Admin/ });
    fireEvent.click(profileLink);

    expect(screen.getByText('PROFILE_ROUTE')).toBeInTheDocument();
  });

  it('navigates to the members sub-route through the SPA router when the Family hub entry is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/members" element={<div>MEMBERS_ROUTE</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: /1 Family/ }));
    expect(screen.getByText('MEMBERS_ROUTE')).toBeInTheDocument();
  });

  it('keeps the documentation entry a real anchor opened in a new tab (GH#74)', () => {
    renderSettingsHub();

    // GH#80: Integrations (swagger) row was intentionally removed from the hub;
    // the settings.documentation row is now the external entry.
    const external = screen.getByRole('link', { name: /Documentation/ });
    expect(external.getAttribute('href')).toMatch(/^https?:\/\//);
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
  });
});