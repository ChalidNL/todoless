import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t, SUPPORTED_UI_LANGUAGES, type SupportedUiLanguage } from '../i18n/translations';
import { changeAppLanguage } from '../i18n';
import { userDisplayName } from '../types';
import { PageHeader } from './shared/PageHeader';

const languageLabel = (language: SupportedUiLanguage) => {
  const labels: Record<SupportedUiLanguage, string> = { en: 'English', nl: 'Nederlands', fr: 'Français', de: 'Deutsch', es: 'Español' };
  return labels[language] || language.toUpperCase();
};

export function ProfileView() {
  const { users, appSettings, updateUser, showCompletionMessage } = useApp();
  const currentUser = useMemo(() => users.find((user) => user.id === appSettings.currentUserId), [appSettings.currentUserId, users]);
  const [firstName, setFirstName] = useState(currentUser?.firstName || '');
  const [lastName, setLastName] = useState(currentUser?.lastName || '');
  const [language, setLanguage] = useState<SupportedUiLanguage>((currentUser?.language || 'en') as SupportedUiLanguage);
  const displayName = currentUser ? userDisplayName(currentUser) : '';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';

  if (!currentUser) {
    return <div className="app-shell-bg min-h-full p-4 text-sm text-[var(--app-text-muted)]">{t('common.noData')}</div>;
  }

  const save = async () => {
    const ok = await updateUser(currentUser.id, { firstName: firstName.trim(), lastName: lastName.trim(), language });
    if (ok) {
      changeAppLanguage(language);
      showCompletionMessage(t('common.saved'));
    }
  };

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <PageHeader title={t('settings.yourProfile')} subtitle={currentUser.email} />
      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        <section className="app-rainbow-animated relative overflow-hidden rounded-[32px] bg-[var(--app-rainbow-grad)] p-6 text-white shadow-[var(--app-glow-focus)]">
          <div className="absolute inset-0 bg-black/5" />
          <div className="relative z-10 flex items-center gap-4">
            <button type="button" className="grid h-20 w-20 place-items-center rounded-[28px] bg-white/20 text-3xl font-black ring-1 ring-white/30 backdrop-blur-sm active:scale-[0.97]" aria-label="Avatar editor">
              {initials}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-2xl font-black tracking-[-0.04em]">{displayName}</p>
              <p className="truncate text-sm font-semibold text-white/80">{currentUser.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-black capitalize">{currentUser.role || t('settings.member')}</span>
                <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-black">{languageLabel(language)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="app-surface space-y-4 p-4">
          <label className="block text-sm font-black text-[var(--app-text)]">
            {t('onboarding.firstName')}
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-1 min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] bg-[var(--app-surface-2)] px-3 text-sm font-semibold outline-none" />
          </label>
          <label className="block text-sm font-black text-[var(--app-text)]">
            {t('onboarding.lastName')}
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} className="mt-1 min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] bg-[var(--app-surface-2)] px-3 text-sm font-semibold outline-none" />
          </label>
          <label className="block text-sm font-black text-[var(--app-text)]">
            {t('settings.language')}
            <select value={language} onChange={(event) => setLanguage(event.target.value as SupportedUiLanguage)} className="mt-1 min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] bg-[var(--app-surface-2)] px-3 text-sm font-semibold outline-none">
              {SUPPORTED_UI_LANGUAGES.map((lang) => <option key={lang} value={lang}>{languageLabel(lang)}</option>)}
            </select>
          </label>
          <button type="button" onClick={save} className="inline-flex min-h-[var(--app-touch-target)] w-full items-center justify-center gap-2 rounded-[var(--app-radius-button)] bg-[var(--app-primary)] px-4 text-sm font-black text-white shadow-[var(--app-shadow-fab)] active:scale-[0.97]">
            <Save className="h-4 w-4" />
            {t('common.save')}
          </button>
        </section>
      </div>
    </div>
  );
}
