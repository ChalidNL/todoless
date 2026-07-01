import { useMemo, useState } from 'react';
import { Camera, Lock, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { t, SUPPORTED_UI_LANGUAGES, type SupportedUiLanguage } from '../i18n/translations';
import { changeAppLanguage } from '../i18n';
import { userDisplayName } from '../types';
import { Button } from './ui/Button';
import { SettingsDetailHeader } from './shared/SettingsDetailHeader';

const languageLabel = (language: SupportedUiLanguage) => {
  const labels: Record<SupportedUiLanguage, string> = { en: 'English', nl: 'Nederlands', fr: 'Français', de: 'Deutsch', es: 'Español' };
  return labels[language] || language.toUpperCase();
};

function ProfileField({ label, value, onChange, type = 'text', options, required }: { label: string; value: string; onChange: (value: string) => void; type?: 'text' | 'password' | 'select'; options?: Array<{ value: string; label: string }>; required?: boolean }) {
  return (
    <label className="block border-b border-[var(--app-border-subtle)] px-4 py-3 last:border-b-0">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.03em] text-[var(--app-text-muted)]">{label}{required ? ' *' : ''}</span>
      {type === 'select' ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full border-0 bg-transparent p-0 text-[15px] font-semibold text-[var(--app-text)] outline-none">
          {options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full border-0 bg-transparent p-0 text-[15px] font-semibold text-[var(--app-text)] outline-none" />
      )}
    </label>
  );
}

export function ProfileView() {
  const navigate = useNavigate();
  const { users, appSettings, updateUser, showCompletionMessage } = useApp();
  const currentUser = useMemo(() => users.find((user) => user.id === appSettings.currentUserId), [appSettings.currentUserId, users]);
  const [firstName, setFirstName] = useState(currentUser?.firstName || '');
  const [lastName, setLastName] = useState(currentUser?.lastName || '');
  const [language, setLanguage] = useState<SupportedUiLanguage>((currentUser?.language || 'en') as SupportedUiLanguage);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const displayName = currentUser ? userDisplayName(currentUser) : '';
  const initials = `${currentUser?.firstName?.[0] || ''}${currentUser?.lastName?.[0] || ''}`.toUpperCase() || displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CT';

  if (!currentUser) {
    return <div className="app-shell-bg min-h-full p-4 text-sm text-[var(--app-text-muted)]">{t('common.noData')}</div>;
  }

  const saveProfile = async () => {
    const ok = await updateUser(currentUser.id, { firstName: firstName.trim(), lastName: lastName.trim(), language });
    if (ok) {
      changeAppLanguage(language);
      showCompletionMessage(t('common.saved'));
    }
  };

  const savePassword = async () => {
    if (!password.trim()) return;
    if (password !== passwordConfirm) {
      showCompletionMessage(t('settings.passwordMismatch'));
      return;
    }
    const ok = await updateUser(currentUser.id, { password } as any);
    if (ok) {
      setPassword('');
      setPasswordConfirm('');
      showCompletionMessage(t('settings.passwordUpdated'));
    }
  };

  const handleAvatarUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.click();
  };

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <div className="relative">
        <SettingsDetailHeader
          mode="detail"
          themeColor="#6366f1"
          title={displayName}
          subtitle={currentUser.email}
          avatarInitials={initials}
          onBack={() => navigate(-1)}
        />
        <button
          type="button"
          onClick={handleAvatarUpload}
          className="absolute right-[calc(50%-56px)] top-[108px] grid h-7 w-7 place-items-center rounded-full bg-white text-indigo-600 shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
          aria-label="Avatar upload"
        >
          <Camera className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>

      <main className="mx-auto max-w-lg pt-4">
        <section className="mx-4 overflow-hidden rounded-[var(--app-radius-xl)] bg-white shadow-[var(--app-shadow-card)]">
          <ProfileField label={t('onboarding.firstName')} value={firstName} onChange={setFirstName} required />
          <ProfileField label={t('onboarding.lastName')} value={lastName} onChange={setLastName} />
          <ProfileField label={t('settings.language')} value={language} onChange={(value) => setLanguage(value as SupportedUiLanguage)} type="select" options={SUPPORTED_UI_LANGUAGES.map((lang) => ({ value: lang, label: languageLabel(lang) }))} />
        </section>

        <div className="px-4 pb-2 pt-4">
          <Button label={t('common.save')} icon={Save} onClick={saveProfile} />
        </div>

        <section className="mx-4 mt-4 overflow-hidden rounded-[var(--app-radius-xl)] bg-white shadow-[var(--app-shadow-card)]">
          <ProfileField label={t('settings.newPassword')} type="password" value={password} onChange={setPassword} />
          <ProfileField label={t('settings.confirmPassword')} type="password" value={passwordConfirm} onChange={setPasswordConfirm} />
        </section>

        <div className="px-4 pb-8 pt-3">
          <Button label={t('settings.changePassword')} icon={Lock} onClick={savePassword} variant="secondary" />
        </div>
      </main>
    </div>
  );
}
