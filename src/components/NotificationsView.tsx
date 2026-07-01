import { Bell, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { t } from '../i18n/translations';
import { SettingsDetailHeader } from './shared/SettingsDetailHeader';

export function NotificationsView() {
  const navigate = useNavigate();

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <SettingsDetailHeader
        mode="detail"
        themeColor="#22c55e"
        title={t('settings.notifications')}
        onBack={() => navigate('/settings')}
      />

      <main className="mx-auto max-w-lg px-4 pt-4">
        <section className="overflow-hidden rounded-[var(--app-radius-xl)] bg-white shadow-[var(--app-shadow-card)]">
          <div className="flex items-center gap-3 border-b border-[var(--app-border-subtle)] px-4 py-5">
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-[#22c55e15] text-[#22c55e]">
              <Bell className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[var(--app-text)]">
                {t('settings.notificationsDueDate')}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--app-text-muted)]">
                {t('settings.notificationsComingSoon')}
              </span>
            </span>
          </div>

          <div className="flex flex-col items-center gap-4 px-4 py-10 text-center opacity-60">
            <Settings2 className="h-10 w-10 text-[var(--app-text-muted)]" strokeWidth={1.5} />
            <div>
              <p className="mb-1 text-sm font-semibold text-[var(--app-text)]">
                {t('settings.notificationsComingSoon')}
              </p>
              <p className="text-xs text-[var(--app-text-muted)]">
                {t('settings.notificationsComingSoonHint')}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
