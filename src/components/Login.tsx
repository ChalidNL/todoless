import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { AppLogo } from './shared/AppLogo';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { t } from '../i18n/translations';

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
      setError(signInError.message || t('auth.invalidCredentials'));
      return;
    }

    onLogin();
  };

  return (
    <div className="app-shell-bg flex min-h-screen items-center justify-center p-4">
      <div className="app-surface w-full max-w-md rounded-[28px] p-6 sm:p-8">
        <div className="flex items-center justify-center mb-8">
          <AppLogo size="lg" showText={true} variant="dark" />
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-2">{t('auth.welcomeBack')}</h1>
        <p className="text-neutral-600 text-center mb-8 text-sm">
          {t('auth.signInSubtitle')}
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm text-neutral-600 mb-1">{t('auth.email')}</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] border border-[var(--app-border-subtle)] bg-white px-4 focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm text-neutral-600 mb-1">{t('auth.password')}</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] border border-[var(--app-border-subtle)] bg-white px-4 pr-14 focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-neutral-500 hover:bg-[var(--app-surface-2)]"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={t('auth.password')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm" role="alert">{error}</p>
          )}

          <button
            onClick={handleLogin}
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
                onClick={onSwitchToRegister}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                {t('auth.iHaveInviteCode')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};