import { Bell, CheckCircle2, Mail, Smartphone, TimerReset } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import type { AppSettings } from '../types';
import { SettingsDetailHeader } from './shared/SettingsDetailHeader';

function SettingSwitch({
  checked,
  icon: Icon,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  icon: typeof Bell;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-[72px] items-center gap-3 border-b border-[var(--app-border-subtle)] px-4 py-4 last:border-b-0">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-[#22c55e15] text-[#22c55e]">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--app-text)]">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--app-text-muted)]">{description}</span>
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`relative h-8 w-14 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-[#22c55e]' : 'bg-[var(--app-surface-3)]'}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-7' : 'translate-x-1'}`} />
      </span>
    </label>
  );
}

export function NotificationsView() {
  const navigate = useNavigate();
  const { appSettings, updateAppSettings, showCompletionMessage } = useApp();

  const update = (settings: Partial<AppSettings>) => {
    updateAppSettings(settings);
    showCompletionMessage(t('settings.notificationsSaved'));
  };

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <SettingsDetailHeader
        mode="detail"
        themeColor="#22c55e"
        title={t('settings.notifications')}
        onBack={() => navigate('/settings')}
      />

      <main className="mx-auto max-w-lg space-y-4 px-4 pt-4">
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
                {t('settings.notificationsHint')}
              </span>
            </span>
          </div>

          <SettingSwitch
            checked={appSettings.taskReminders !== false}
            icon={TimerReset}
            title={t('settings.taskReminders')}
            description={t('settings.taskRemindersHint')}
            onChange={(taskReminders) => update({ taskReminders })}
          />
          <SettingSwitch
            checked={appSettings.notificationPush === true}
            icon={Smartphone}
            title={t('settings.pushNotifications')}
            description={t('settings.pushNotificationsHint')}
            onChange={(notificationPush) => update({ notificationPush })}
          />
          <SettingSwitch
            checked={appSettings.notificationEmail === true}
            icon={Mail}
            title={t('settings.emailNotifications')}
            description={t('settings.emailNotificationsHint')}
            onChange={(notificationEmail) => update({ notificationEmail })}
          />
        </section>

        <section className="rounded-[var(--app-radius-xl)] bg-white p-4 shadow-[var(--app-shadow-card)]">
          <label className="mb-2 block text-sm font-semibold text-[var(--app-text)]" htmlFor="reminder-minutes">
            {t('settings.reminderLeadTime')}
          </label>
          <select
            id="reminder-minutes"
            className="min-h-[var(--app-touch-target)] w-full rounded-2xl border border-[var(--app-border-subtle)] bg-white px-4 text-sm font-semibold text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[#22c55e]/20"
            value={appSettings.reminderMinutes ?? 15}
            onChange={(event) => update({ reminderMinutes: Number(event.target.value) })}
          >
            {[5, 10, 15, 30, 60, 120, 1440].map((minutes) => (
              <option key={minutes} value={minutes}>{minutes === 1440 ? t('settings.reminderOneDay') : t('settings.reminderMinutes').replace('{minutes}', String(minutes))}</option>
            ))}
          </select>
          <p className="mt-2 flex items-center gap-2 text-xs leading-5 text-[var(--app-text-muted)]">
            <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
            {t('settings.notificationsActiveHint')}
          </p>
        </section>
      </main>
    </div>
  );
}
