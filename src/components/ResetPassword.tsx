import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { AppLogo } from './shared/AppLogo';
import { pb } from '../lib/pocketbase';
import { PASSWORD_MIN_LENGTH } from '../lib/password';
import { captureUrlSecrets, getResetToken } from '../lib/url-secrets';
import { t } from '../i18n/translations';

interface ResetPasswordProps {
  token: string;
  onDone: () => void;
}

/**
 * Completes the forgot-password flow (#68). The reset email links here
 * ({APP_URL}/reset-password#token=…, migrations z071/z074) instead of PocketBase's
 * admin UI under /_/, which nginx only exposes to private networks.
 */
export function ResetPassword({ token: initialToken, onDone }: ResetPasswordProps) {
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState(initialToken ? '' : t('auth.resetInvalidLink'));
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(false);

  // A reset link opened while this page is already shown only changes the
  // fragment (no reload): take the new token, clean the address bar again
  // and start over.
  useEffect(() => {
    const onHashChange = () => {
      captureUrlSecrets();
      const next = getResetToken();
      if (!next) return;
      setToken(next);
      setPassword('');
      setPasswordConfirm('');
      setError('');
      setDone(false);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const submit = async () => {
    if (!token) return;
    if (password.length < PASSWORD_MIN_LENGTH) { setError(t('auth.passwordMinLength')); return; }
    if (password !== passwordConfirm) { setError(t('auth.passwordsDoNotMatch')); return; }
    setError('');
    setIsSaving(true);
    try {
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm);
      setDone(true);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setError(status === 400 || status === 404 ? t('auth.resetInvalidLink') : t('errors.unknown'));
    } finally {
      setIsSaving(false);
    }
  };

  const goToLogin = () => {
    // Drop the token from the address bar before leaving the page.
    window.history.replaceState({}, '', '/');
    onDone();
  };

  return (
    <main className="auth-shell app-shell-bg">
      <section className="auth-card app-surface" aria-labelledby="reset-title">
        <div className="auth-logo">
          <AppLogo size="lg" showText={true} variant="dark" />
        </div>
        <h1 id="reset-title" className="auth-title">{t('auth.resetTitle')}</h1>

        {done ? (
          <div className="auth-form">
            <div className="auth-validation-message" role="status">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
              <p className="auth-message">{t('auth.resetDone')}</p>
            </div>
            <button type="button" className="auth-submit" onClick={goToLogin}>{t('auth.logIn')}</button>
          </div>
        ) : (
          <form
            className="auth-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <p className="auth-subtitle">{t('auth.resetSubtitle')}</p>
            {/* Hidden username field so password managers update the right entry. */}
            <input type="text" name="username" autoComplete="username" hidden readOnly value="" />
            <div className="auth-field">
              <label htmlFor="reset-password" className="auth-label">{t('auth.newPassword')}</label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                className="auth-input"
                value={password}
                disabled={!token}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="auth-hint">{t('auth.passwordMinLengthShort')}</p>
            </div>
            <div className="auth-field">
              <label htmlFor="reset-password-confirm" className="auth-label">{t('auth.confirmNewPassword')}</label>
              <input
                id="reset-password-confirm"
                type="password"
                autoComplete="new-password"
                className="auth-input"
                value={passwordConfirm}
                disabled={!token}
                onChange={(event) => setPasswordConfirm(event.target.value)}
              />
            </div>
            {error && <p className="auth-message auth-error" role="alert">{error}</p>}
            <button type="submit" className="auth-submit" disabled={!token || isSaving} aria-busy={isSaving}>
              {isSaving ? <Loader2 className="inline animate-spin" size={16} /> : t('auth.resetSubmit')}
            </button>
            <div className="auth-footer">
              <button type="button" className="min-h-[var(--app-touch-target)] text-sm font-medium text-indigo-600" onClick={goToLogin}>
                {t('auth.backToLogin')}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
