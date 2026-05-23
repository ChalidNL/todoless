import React, { useState } from 'react';
import { Sparkles, ShoppingCart, Check, Eye, EyeOff, UserPlus, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';
import { api } from '../lib/pocketbase-client';
import { pb } from '../lib/pocketbase';
import { AppLogo } from './shared/AppLogo';

interface OnboardingProps {
  mode: 'admin' | 'user' | 'info';
  onComplete: () => void;
}

export const Onboarding = ({ mode, onComplete }: OnboardingProps) => {
  const { updateAppSettings } = useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdmin = mode === 'admin';
  const isInfo = mode === 'info';

  const infoSteps = [
    {
      icon: <Sparkles className="w-16 h-16 text-neutral-900" />,
      title: 'Welcome to todoless-ngx',
      description: 'Your daily assistant for quick, simple productivity without overwhelm.',
    },
    {
      icon: <ShoppingCart className="w-16 h-16 text-neutral-900" />,
      title: 'Simple Groceries',
      description: 'Track groceries with quantities and stores. Keep your shopping list simple and organized.',
    },
  ];

  const adminSteps = [
    ...infoSteps,
    {
      icon: <Users className="w-16 h-16 text-neutral-900" />,
      title: 'Name Your Workspace',
      description: 'Give your household a name. This is the main entity all members share.',
    },
    {
      icon: <UserPlus className="w-16 h-16 text-neutral-900" />,
      title: 'Create Admin Account',
      description: 'Set up your administrator account to get started.',
    },
  ];

  const userSteps = [
    ...infoSteps,
    {
      icon: <Check className="w-16 h-16 text-neutral-900" />,
      title: "Let's Start",
      description: 'Ready to unload your mind and get organized?',
    },
  ];

  const steps = isAdmin ? adminSteps : isInfo ? infoSteps : userSteps;

  const isFamilyStep = isAdmin && currentStep === steps.length - 2;
  const isLastStep = currentStep === steps.length - 1;
  const showAdminForm = isAdmin && isLastStep;
  const showFamilyForm = isAdmin && isFamilyStep;

  const handleNext = () => {
    if (showFamilyForm) {
      if (!familyName.trim()) {
        setError('Please enter a workspace name');
        return;
      }
      setError('');
      // Pre-fill lastName with workspace name when proceeding to admin form
      if (!lastName.trim()) {
        setLastName(familyName.trim());
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      if (isAdmin) {
        handleCreateAdmin();
      } else if (isInfo) {
        onComplete(); // → login
      } else {
        handleUserOnboardingComplete();
      }
    }
  };

  const handleCreateAdmin = async () => {
    // Validate all fields upfront with clear messages
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!password) {
      setError('Please enter a password');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!passwordConfirm) {
      setError('Please confirm your password');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match');
      return;
    }
    if (!familyName.trim()) {
      setError('Workspace name is missing — go back and enter it');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      const result = await api.registerAdmin(email, password, fullName, familyName.trim());
      await api.markOnboardingSeen(true);
      updateAppSettings({ hasCompletedOnboarding: true, setupComplete: true });
      onComplete();
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('already')) {
        setError('This email is already in use. Try logging in.');
      } else if (msg.toLowerCase().includes('password')) {
        setError('Password does not meet requirements: minimum 8 characters');
      } else {
        setError(msg || 'Account creation failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserOnboardingComplete = async () => {
    await api.markOnboardingSeen(false);
    updateAppSettings({ hasCompletedOnboarding: true });
    onComplete();
  };

  const handleSkip = () => {
    if (isInfo || isAdmin) {
      onComplete();
      return;
    }
    handleUserOnboardingComplete();
  };

  const step = steps[currentStep];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Skip button */}
      <div className="p-4 flex justify-end">
        <button
          onClick={handleSkip}
          className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          {isInfo ? 'Go to login' : 'Skip'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {showAdminForm ? (
          // Admin account creation
          <div className="w-full max-w-md">
            <div className="flex items-center justify-center mb-8">
              <AppLogo size="lg" showText={true} variant="dark" />
            </div>

            <h1 className="text-2xl mb-4 text-center text-neutral-900">
              {step.title}
            </h1>

            <p className="text-center text-neutral-600 max-w-sm mx-auto mb-8">
              {step.description}
            </p>

            <div className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">First name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="John"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="Doe"
                />
                <p className="text-xs text-neutral-500 mt-1">Pre-filled with your workspace name, you can change it</p>
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="admin@example.com"
                />
              </div>

              <div className="relative">
                <label className="block text-sm text-neutral-600 mb-1">Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform translate-y-1 text-neutral-500 hover:text-neutral-700"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Confirm password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              <button
                onClick={handleCreateAdmin}
                disabled={isSubmitting}
                className="w-full bg-neutral-900 text-white py-3 rounded-lg hover:bg-neutral-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </button>

              <p className="text-xs text-neutral-500 text-center">
                This is the only account that can invite new users.
              </p>
            </div>
          </div>
        ) : showFamilyForm ? (
          // Workspace name step
          <div className="w-full max-w-md">
            <div className="flex items-center justify-center mb-8">
              {step.icon}
            </div>

            <h1 className="text-2xl mb-4 text-center text-neutral-900">
              {step.title}
            </h1>

            <p className="text-center text-neutral-600 max-w-sm mx-auto mb-8">
              {step.description}
            </p>

            <div className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Workspace name</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => { setFamilyName(e.target.value); setError(''); }}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="Smith Family"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              <button
                onClick={handleNext}
                className="w-full bg-neutral-900 text-white py-3 rounded-lg hover:bg-neutral-800 transition-colors font-medium"
              >
                Next
              </button>
            </div>
          </div>
        ) : (
          // Regular onboarding slides
          <>
            <div className="mb-8">
              {step.icon}
            </div>

            <h1 className="text-2xl mb-4 text-center text-neutral-900">
              {step.title}
            </h1>

            <p className="text-center text-neutral-600 max-w-sm mb-12">
              {step.description}
            </p>

            {/* Progress dots — only for info slides (not workspace/admin form steps) */}
            <div className="flex gap-2 mb-12">
              {infoSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentStep ? 'bg-neutral-900' : 'bg-neutral-300'
                  }`}
                />
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handleNext}
              className="bg-neutral-900 text-white px-8 py-3 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              {isLastStep
                ? isInfo
                  ? 'Go to login'
                  : 'Get started'
                : 'Next'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
