import { useMemo, useState } from 'react';
import { Camera, ChevronLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { t, SUPPORTED_UI_LANGUAGES, type SupportedUiLanguage } from '../i18n/translations';
import { changeAppLanguage } from '../i18n';
import { userDisplayName } from '../types';

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
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || displayName[0]?.toUpperCase() || '?';

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
      <section className="relative overflow-hidden px-6 pb-7 pt-5 text-white shadow-[0_16px_40px_rgba(99,102,241,0.28)]" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)' }}>
        <button type="button" onClick={() => navigate(-1)} className="absolute left-4 top-4 inline-flex min-h-9 items-center gap-1 rounded-full bg-white/12 px-3 text-sm font-semibold text-white active:scale-[0.97]">
          <ChevronLeft className="h-[18px] w-[18px]" /> Terug
        </button>
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <span className="relative grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-full border-[3px] border-white/60 bg-white/25 text-[28px] font-black text-white shadow-lg">
            {initials}
            <button type="button" onClick={handleAvatarUpload} className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-white text-indigo-600 shadow-[0_2px_8px_rgba(0,0,0,0.2)]" aria-label="Avatar upload">
              <Camera className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </span>
          <div>
            <h1 className="text-xl font-black tracking-[-0.01em]">{displayName}</h1>
            <p className="mt-1 text-sm font-semibold text-white/80">{currentUser.email}</p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-lg pt-4">
        <section className="mx-4 overflow-hidden rounded-[var(--app-radius-xl)] bg-white shadow-[var(--app-shadow-card)]">
          <ProfileField label={t('onboarding.firstName')} value={firstName} onChange={setFirstName} required />
          <ProfileField label={t('onboarding.lastName')} value={lastName} onChange={setLastName} />
          <ProfileField label={t('settings.language')} value={language} onChange={(value) => setLanguage(value as SupportedUiLanguage)} type="select" options={SUPPORTED_UI_LANGUAGES.map((lang) => ({ value: lang, label: languageLabel(lang) }))} />
        </section>

        <button type="button" onClick={saveProfile} className="mx-4 mt-3 flex min-h-[54px] w-[calc(100%-32px)] items-center justify-center gap-2 rounded-[var(--app-radius-xl)] bg-[var(--app-primary-grad)] px-4 text-[15px] font-bold text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)] active:scale-[0.97]">
          <Save className="h-[17px] w-[17px]" />
          {t('common.save')}
        </button>

        <section className="mx-4 mt-4 overflow-hidden rounded-[var(--app-radius-xl)] bg-white shadow-[var(--app-shadow-card)]">
          <ProfileField label={t('settings.newPassword')} type="password" value={password} onChange={setPassword} />
          <ProfileField label={t('settings.confirmPassword')} type="password" value={passwordConfirm} onChange={setPasswordConfirm} />
        </section>

        <button type="button" onClick={savePassword} className="mx-4 mb-8 mt-3 flex min-h-[52px] w-[calc(100%-32px)] items-center justify-center rounded-[var(--app-radius-xl)] border-[1.5px] border-[var(--app-border-subtle)] bg-white px-4 text-[15px] font-bold text-[var(--app-text)] shadow-sm active:scale-[0.97]">
          {t('settings.changePassword')}
        </button>
      </main>
    </div>
  );
}
