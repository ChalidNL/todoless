import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { AppLogo } from './shared/AppLogo';
import { Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../lib/pocketbase-client';
import { t } from '../i18n/translations';

interface RegisterProps {
  onRegister: () => void;
}

export const Register = ({ onRegister }: RegisterProps) => {
  const { signUp } = useAuth();
  const [step, setStep] = useState<'validate' | 'create'>('validate');
  const [inviteCode, setInviteCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check for invite code in URL or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite') || localStorage.getItem('pending_invite_code') || '';
    if (code) {
      setInviteCode(code);
      setStep('create'); // Skip validation if code is in URL
      localStorage.removeItem('pending_invite_code'); // Cleanup
    }
  }, []);

  const handleValidateInvite = async () => {
    if (!inviteCode || inviteCode.length < 6) {
      setError(t('auth.invalidInviteCode'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.validateInviteCode(inviteCode);
      setStep('create');
    } catch (validationError: any) {
      setError(validationError?.message || t('auth.expiredInviteCode'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    // Validation
    if (!firstName.trim()) {
      setError(t('auth.firstNameRequired'));
      return;
    }
    if (!email || !password || !confirmPassword) {
      setError(t('auth.allFieldsRequired'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('auth.emailInvalid'));
      return;
    }

    setIsLoading(true);
    setError('');

    const { error: signUpError } = await signUp(email, password, firstName, lastName, inviteCode);

    setIsLoading(false);

    if (signUpError) {
      setError(signUpError.message || t('auth.registrationFailed'));
      return;
    }

    // Mark onboarding as seen so the onboarding gate doesn't redirect
    try { await api.markOnboardingSeen(false); } catch { /* ignore */ }

    // Complete registration
    onRegister();
  };

  if (step === 'validate') {
    return (
      <main className="auth-shell app-shell-bg">
        <section className="auth-card app-surface" aria-labelledby="invite-title">
          <div className="auth-logo">
            <AppLogo size="lg" showText={true} variant="dark" />
          </div>

          <h1 id="invite-title" className="auth-title">{t('auth.joinTitle')}</h1>
          <p className="auth-subtitle">
            {t('auth.invitePrompt')}
          </p>

          <div className="auth-form">
            <div className="auth-field">
              <label htmlFor="register-invite" className="auth-label">{t('auth.inviteCode')}</label>
              <input
                id="register-invite"
                type="text"
                autoComplete="one-time-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleValidateInvite()}
                maxLength={12}
                className="auth-input auth-invite-input"
                placeholder="ABC123"
              />
            </div>

            {error && (
              <p className="auth-message auth-error" role="alert">{error}</p>
            )}

            <button
              onClick={() => handleValidateInvite()}
              disabled={isLoading}
              className="auth-submit"
            >
              {isLoading ? <Loader2 className="animate-spin inline" size={16} /> : t('auth.validateCode')}
            </button>

            <div className="auth-footer">
              <p>
                {t('auth.alreadyHaveAccount')}{' '}
                <a href="/" className="text-indigo-600 hover:underline font-medium">
                  {t('auth.loginLink')}
                </a>
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell app-shell-bg">
      <section className="auth-card app-surface" aria-labelledby="register-title">
        <div className="auth-logo">
          <AppLogo size="lg" showText={true} variant="dark" />
        </div>

        <div className="auth-validation-message">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" aria-hidden="true" />
          <p className="auth-message">{t('auth.inviteValidated')}</p>
        </div>

        <h1 id="register-title" className="auth-title">{t('auth.createAccountTitle')}</h1>
        <p className="auth-subtitle">
          {t('auth.createAccountSubtitle')}
        </p>

        <div className="auth-form">
          <div className="auth-field">
            <label htmlFor="register-first-name" className="auth-label">{t('auth.firstName')}</label>
            <input
              id="register-first-name"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="auth-input"
              placeholder="John"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-last-name" className="auth-label">{t('auth.lastName')}</label>
            <input
              id="register-last-name"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="auth-input"
              placeholder="Doe"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-email" className="auth-label">{t('auth.email')}</label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="you@example.com"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-password" className="auth-label">{t('auth.password')}</label>
            <div className="auth-password-field">
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            <label htmlFor="register-confirm-password" className="auth-label">{t('auth.confirmPassword')}</label>
            <div className="auth-password-field">
              <input
                id="register-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAccount()}
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
            onClick={handleCreateAccount}
            disabled={isLoading}
            className="auth-submit"
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : t('auth.createAccount')}
          </button>

          <div className="auth-footer">
            <p>
              {t('auth.alreadyHaveAccount')}{' '}
              <a href="/" className="text-indigo-600 hover:underline font-medium">
                {t('auth.loginLink')}
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};
