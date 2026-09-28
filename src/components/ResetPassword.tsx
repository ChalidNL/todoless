import React, { useState } from 'react';
import { AppLogo } from './shared/AppLogo';
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '../lib/pocketbase-client';
import { t } from '../i18n/translations';

interface ResetPasswordProps {
  /** Password-reset token from the emailed link. */
  token: string;
  onResetComplete: () => void;
}

/**
 * Extract the PB password-reset token from the current URL.
 *
 * Supports both link styles:
 * - our custom template:  /reset-password?token={TOKEN}
 * - PB default template:  /_/#/confirm-password-reset/{TOKEN}
 */
export function extractResetToken(locationLike: Pick<Location, 'search' | 'hash'> = window.location): string {
  const query = new URLSearchParams(locationLike.search);
  const fromQuery = query.get('token') || query.get('resetToken') || '';
  if (fromQuery) return fromQuery;

  const hash = locationLike.hash || '';
  const hashMatch = hash.match(/#\/confirm-password-reset\/([^/?#]+)/);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);

  return '';
}

export const ResetPassword = ({ token, onResetComplete }: ResetPasswordProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (password.length < 6) {
      setError(t('auth.passwordMinLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.confirmPasswordReset(token, password, password);
      setSuccess(true);
    } catch (e: any) {
      const message = String(e?.data?.message || e?.message || '');
      const isInvalidToken = /invalid|expired/i.test(message);
      setError(isInvalidToken ? t('auth.resetTokenInvalid') : t('auth.resetErrorGeneric'));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <main className="auth-shell app-shell-bg">
        <section className="auth-card app-surface" aria-labelledby="reset-password-success-title">
          <div className="auth-logo">
            <AppLogo size="lg" showText={true} variant="dark" />
          </div>

          <div className="auth-validation-message">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" aria-hidden="true" />
            <p className="auth-message">{t('auth.resetPasswordSuccess')}</p>
          </div>

          <h1 id="reset-password-success-title" className="auth-title">{t('auth.resetPasswordSuccessTitle')}</h1>
          <p className="auth-subtitle">
            {t('auth.resetPasswordSuccessHint')}
          </p>

          <div className="auth-form">
            <button onClick={onResetComplete} className="auth-submit">
              {t('auth.logIn')}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell app-shell-bg">
      <section className="auth-card app-surface" aria-labelledby="reset-password-title">
        <div className="auth-logo">
          <AppLogo size="lg" showText={true} variant="dark" />
        </div>

        <h1 id="reset-password-title" className="auth-title">{t('auth.resetPasswordTitle')}</h1>
        <p className="auth-subtitle">
          {t('auth.resetPasswordSubtitle')}
        </p>

        <div className="auth-form">
          <div className="auth-field">
            <label htmlFor="reset-password" className="auth-label">{t('auth.password')}</label>
            <div className="auth-password-field">
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                className="auth-input auth-password-input"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="auth-visibility-button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={t('auth.password')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="auth-hint">{t('auth.passwordMinLengthShort')}</p>
          </div>

          <div className="auth-field">
            <label htmlFor="reset-confirm-password" className="auth-label">{t('auth.confirmPassword')}</label>
            <div className="auth-password-field">
              <input
                id="reset-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                className="auth-input auth-password-input"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="auth-visibility-button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={t('auth.confirmPassword')}
                aria-pressed={showConfirmPassword}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="auth-message auth-error" role="alert">{error}</p>
          )}

          <button
            onClick={handleReset}
            disabled={isLoading}
            className="auth-submit"
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : t('auth.resetPasswordSubmit')}
          </button>
        </div>
      </section>
    </main>
  );
};