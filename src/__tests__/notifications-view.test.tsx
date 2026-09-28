import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsView } from '../components/NotificationsView';
import { t } from '../i18n/translations';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../components/shared/SettingsDetailHeader', () => ({
  SettingsDetailHeader: () => <div>Header</div>,
}));

const baseApp = {
  appSettings: {
    taskReminders: true,
    notificationPush: false,
    notificationEmail: false,
    reminderMinutes: 15,
  },
  updateAppSettings: vi.fn().mockResolvedValue(true),
  showCompletionMessage: vi.fn(),
};

describe('notifications view persistence (GH#69)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue({ ...baseApp });
  });

  it('persists the push notifications toggle through updateAppSettings', async () => {
    const updateAppSettings = vi.fn().mockResolvedValue(true);
    useAppMock.mockReturnValue({ ...baseApp, updateAppSettings });

    render(
      <MemoryRouter>
        <NotificationsView />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /push notifications/i }));

    await waitFor(() => {
      expect(updateAppSettings).toHaveBeenCalledWith({ notificationPush: true });
      expect(baseApp.showCompletionMessage).toHaveBeenCalledWith(t('settings.notificationsSaved'));
    });
  });

  it('persists the reminder lead time as reminderMinutes', async () => {
    const updateAppSettings = vi.fn().mockResolvedValue(true);
    useAppMock.mockReturnValue({ ...baseApp, updateAppSettings });

    render(
      <MemoryRouter>
        <NotificationsView />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/reminder lead time/i), { target: { value: '30' } });

    await waitFor(() => {
      expect(updateAppSettings).toHaveBeenCalledWith({ reminderMinutes: 30 });
    });
  });

  it('shows the saved message only when the write succeeds', async () => {
    const updateAppSettings = vi.fn().mockResolvedValue(true);
    const showCompletionMessage = vi.fn();
    useAppMock.mockReturnValue({ ...baseApp, updateAppSettings, showCompletionMessage });

    render(
      <MemoryRouter>
        <NotificationsView />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /task reminders/i }));

    await waitFor(() => {
      expect(showCompletionMessage).toHaveBeenCalledWith(t('settings.notificationsSaved'));
    });
  });

  it('surfaces the failure message when the write fails', async () => {
    const updateAppSettings = vi.fn().mockResolvedValue(false);
    const showCompletionMessage = vi.fn();
    useAppMock.mockReturnValue({ ...baseApp, updateAppSettings, showCompletionMessage });

    render(
      <MemoryRouter>
        <NotificationsView />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /task reminders/i }));

    await waitFor(() => {
      expect(showCompletionMessage).toHaveBeenCalled();
      expect(showCompletionMessage).not.toHaveBeenCalledWith(t('settings.notificationsSaved'));
      expect(showCompletionMessage).toHaveBeenCalledWith(t('settings.notificationsSaveFailed'));
    });
  });
});