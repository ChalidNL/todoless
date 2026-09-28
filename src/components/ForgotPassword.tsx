import React, { useState } from 'react';
import { AppLogo } from './shared/AppLogo';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { api } from '../lib/pocketbase-client';
import { t } from '../i18n/translations';

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

/**
 * "Forgot password?" request screen.
 *
 * Always shows the same confirmation message whatever the server replied,
 * so account existence is never leaked (PB returns 204 for unknown emails
 * and an error for known ones when SMTP delivery fails).
 */
export const ForgotPassword = ({ onBackToLogin }: ForgotPasswordProps) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setError(t('auth.emailInvalid'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.requestPasswordReset(email.trim());
    } catch (e) {
      // Do not surface the underlying reason: it distinguishes existing and
      // non-existing accounts. The generic confirmation is shown regardless.
      console.error('requestPasswordReset failed', e);
    } finally {
      setIsLoading(false);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <main className="auth-shell app-shell-bg">
        <section className="auth-card app-surface" aria-labelledby="forgot-password-sent-title">
          <div className="auth-logo">
            <AppLogo size="lg" showText={true} variant="dark" />
          </div>

          <div className="auth-validation-message">
            <MailCheck className="w-5 h-5 text-green-600 flex-shrink-0" aria-hidden="true" />
            <p className="auth-message">{t('auth.resetEmailSent')}</p>
          </div>

          <h1 id="forgot-password-sent-title" className="auth-title">{t('auth.resetEmailSentTitle')}</h1>
          <p className="auth-subtitle">
            {t('auth.resetEmailSentHint')}
          </p>

          <div className="auth-form">
            <button
              onClick={onBackToLogin}
              className="auth-submit"
            >
              {t('auth.backToLogin')}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell app-shell-bg">
      <section className="auth-card app-surface" aria-labelledby="forgot-password-title">
        <div className="auth-logo">
          <AppLogo size="lg" showText={true} variant="dark" />
        </div>

        <h1 id="forgot-password-title" className="auth-title">{t('auth.forgotPasswordTitle')}</h1>
        <p className="auth-subtitle">
          {t('auth.forgotPasswordSubtitle')}
        </p>

        <div className="auth-form">
          <div className="auth-field">
            <label htmlFor="forgot-password-email" className="auth-label">{t('auth.email')}</label>
            <input
              id="forgot-password-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="auth-input"
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <p className="auth-message auth-error" role="alert">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="auth-submit"
          >
            {isLoading ? <Loader2 className="animate-spin inline" size={18} /> : t('auth.sendResetLink')}
          </button>

          <div className="auth-footer">
            <button
              onClick={onBackToLogin}
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline font-medium"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              {t('auth.backToLogin')}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};