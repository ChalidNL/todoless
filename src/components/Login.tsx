import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { AppLogo } from './shared/AppLogo';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { t, translatePbError } from '../i18n/translations';
import { pb } from '../lib/pocketbase';

interface LoginProps {
  onLogin: () => void;
  onSwitchToRegister?: () => void;
}

export const Login = ({ onLogin, onSwitchToRegister }: LoginProps) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t('auth.missingCredentials'));
      return;
    }

    setIsLoading(true);
    setError('');

    const { error: signInError } = await signIn(email, password);

    setIsLoading(false);

    if (signInError) {
      // GH#42: the nginx rate limiter answers HTTP 429 with a JSON body when
      // too many login attempts are made. Show a friendly "try again in a
      // moment" message instead of a generic invalid-credentials error.
      const status = (signInError as Error & { status?: number }).status;
      if (status === 429) {
        setError(t('auth.rateLimited'));
        return;
      }
      setError(translatePbError(signInError.message, 'auth.invalidCredentials'));
      return;
    }

    onLogin();
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      setForgotError(t('auth.emailInvalid'));
      return;
    }

    setIsSendingReset(true);
    setForgotError('');
    setForgotSuccess(false);

    try {
      await pb.collection('users').requestPasswordReset(forgotEmail);
      setForgotSuccess(true);
    } catch (err) {
      setForgotError(translatePbError((err as Error)?.message, 'auth.resetFailed'));
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="app-shell-bg flex min-h-dvh items-center justify-center p-4">
      <div className="app-surface w-full max-w-md rounded-[28px] p-6 sm:p-8">
        <div className="flex items-center justify-center mb-8">
          <AppLogo size="lg" showText={true} variant="dark" />
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-2">{t('auth.welcomeBack')}</h1>
        <p className="text-neutral-600 text-center mb-8 text-sm">
          {t('auth.signInSubtitle')}
        </p>

        {/* A real <form>: the mobile keyboard's Go/Enter submits and password
            managers recognise the username/current-password pair. */}
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleLogin();
          }}
        >
          <div>
            <label htmlFor="login-email" className="block text-sm text-neutral-600 mb-1">{t('auth.email')}</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] border border-[var(--app-border-subtle)] bg-white px-4 focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm text-neutral-600 mb-1">{t('auth.password')}</label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] border border-[var(--app-border-subtle)] bg-white px-4 pr-14 focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-neutral-500 hover:bg-[var(--app-surface-2)]"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={t('onboarding.showPassword')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(!showForgotPassword);
                setForgotError('');
                setForgotSuccess(false);
              }}
              className="-my-2 min-h-[var(--app-touch-target)] px-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>

          {showForgotPassword && (
            <div className="space-y-3 rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-2)] p-4">
              <div>
                <h2 className="text-sm font-bold text-[var(--app-text)]">{t('auth.forgotPasswordTitle')}</h2>
                <p className="mt-0.5 text-xs text-neutral-500">{t('auth.forgotPasswordHint')}</p>
              </div>
              <div>
                <label htmlFor="forgot-email" className="mb-1 block text-sm text-neutral-600">{t('auth.email')}</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    // Keep Enter inside the reset panel from submitting the login form.
                    e.preventDefault();
                    void handleForgotPassword();
                  }}
                  className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] border border-[var(--app-border-subtle)] bg-white px-4 focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]"
                  placeholder="you@example.com"
                />
              </div>
              {forgotError && (
                <p className="text-sm text-red-500" role="alert">{forgotError}</p>
              )}
              {forgotSuccess && (
                <p className="text-sm text-green-600" role="status">{t('auth.resetLinkSent')}</p>
              )}
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isSendingReset}
                className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-xl)] border border-[var(--app-primary)] px-4 py-3 text-sm font-bold text-[var(--app-primary)] transition active:scale-[0.98] disabled:opacity-60"
              >
                {isSendingReset ? <Loader2 size={16} className="mx-auto animate-spin" /> : t('auth.sendResetLink')}
              </button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="mx-auto block text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                {t('auth.backToLogin')}
              </button>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-xl)] bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] px-4 py-3 font-bold text-white shadow-[0_6px_20px_rgba(99,102,241,0.32)] transition active:scale-[0.98]"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : t('auth.logIn')}
          </button>

          <div className="text-center pt-4 border-t border-neutral-100 space-y-2">
            <p className="text-xs text-neutral-500">
              {t('auth.noAccountInviteHint')}
            </p>
            {onSwitchToRegister && (
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="min-h-[var(--app-touch-target)] px-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                {t('auth.iHaveInviteCode')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};