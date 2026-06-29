import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { AppHeader } from './shared/NewGlobalHeader';
import { CalendarImportExport } from './CalendarImportExport';

export function SettingsPreferences() {
  const { appSettings, updateAppSettings } = useApp();
  const weekDays = [
    { value: 0, label: t('settings.sunday') },
    { value: 1, label: t('settings.monday') },
    { value: 2, label: t('settings.tuesday') },
    { value: 3, label: t('settings.wednesday') },
    { value: 4, label: t('settings.thursday') },
    { value: 5, label: t('settings.friday') },
    { value: 6, label: t('settings.saturday') },
  ];

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <AppHeader screen="instellingen" showSearch={false} showFilters={false} showAdd={false} />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-3">
        <section className="rounded-[var(--app-radius-card)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)]">
          <h1 className="mb-3 text-base font-black text-[var(--app-text)]">{t('settings.preferences')}</h1>
          <label className="mb-1 block text-sm font-semibold text-[var(--app-text-muted)]" htmlFor="first-day-of-week">{t('settings.firstDayOfWeek')}</label>
          <select
            id="first-day-of-week"
            aria-label={t('settings.firstDayOfWeek')}
            value={appSettings.sprintStartDay ?? 1}
            onChange={(event) => updateAppSettings({ sprintStartDay: Number(event.target.value) as 0 | 1 | 2 | 3 | 4 | 5 | 6 })}
            className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] border border-[var(--app-border-subtle)] bg-[var(--app-surface-2)] px-3 text-sm font-semibold text-[var(--app-text)]"
          >
            {weekDays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
          </select>
        </section>

        <section className="rounded-[var(--app-radius-card)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)]">
          <CalendarImportExport />
        </section>
      </main>
    </div>
  );
}
