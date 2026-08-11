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
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 max-w-md w-full border border-white/20">
          <div className="flex items-center justify-center mb-8">
            <AppLogo size="lg" showText={true} variant="dark" />
          </div>

          <h1 className="text-2xl font-extrabold text-center text-neutral-900 mb-2">{t('auth.joinTitle')}</h1>
          <p className="text-neutral-600 text-center mb-8 text-sm">
            {t('auth.invitePrompt')}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-600 mb-1 font-medium">{t('auth.inviteCode')}</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleValidateInvite()}
                maxLength={6}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                placeholder="ABC123"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              onClick={() => handleValidateInvite()}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all font-semibold shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="animate-spin inline" size={16} /> : t('auth.validateCode')}
            </button>

            <div className="text-center pt-4 border-t border-neutral-200">
              <p className="text-xs text-neutral-500">
                {t('auth.alreadyHaveAccount')}{' '}
                <a href="/" className="text-indigo-600 hover:underline font-medium">
                  {t('auth.loginLink')}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 max-w-md w-full border border-white/20">
        <div className="flex items-center justify-center mb-6">
          <AppLogo size="lg" showText={true} variant="dark" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-6 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800 font-medium">{t('auth.inviteValidated')}</p>
        </div>

        <h1 className="text-2xl font-extrabold text-center text-neutral-900 mb-2">{t('auth.createAccountTitle')}</h1>
        <p className="text-neutral-600 text-center mb-8 text-sm">
          {t('auth.createAccountSubtitle')}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-600 mb-1 font-medium">{t('auth.firstName')}</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="John"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-600 mb-1 font-medium">{t('auth.lastName')}</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Doe"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-600 mb-1 font-medium">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-600 mb-1 font-medium">{t('auth.password')}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-1">{t('auth.passwordMinLengthShort')}</p>
          </div>

          <div>
            <label className="block text-sm text-neutral-600 mb-1 font-medium">{t('auth.confirmPassword')}</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAccount()}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}

          <button
            onClick={handleCreateAccount}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all font-semibold shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : t('auth.createAccount')}
          </button>

          <div className="text-center pt-4 border-t border-neutral-200">
            <p className="text-xs text-neutral-500">
              {t('auth.alreadyHaveAccount')}{' '}
              <a href="/" className="text-indigo-600 hover:underline font-medium">
                {t('auth.loginLink')}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
