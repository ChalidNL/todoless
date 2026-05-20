import React, { useState } from 'react';
import { Brain, Inbox, Calendar, Check, Eye, EyeOff, ShoppingCart, StickyNote, UserPlus, Sparkles, Users } from 'lucide-react';
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
      icon: <Inbox className="w-16 h-16 text-neutral-900" />,
      title: 'Brain Dump & Inbox',
      description: 'Capture everything in Inbox. Quick brain dumps convert to Tasks, Items or Notes with one click.',
    },
    {
      icon: <Calendar className="w-16 h-16 text-neutral-900" />,
      title: 'Tasks & Sprint Planning',
      description: 'Organize tasks with labels, due dates, priority and assignments. Create sprints to focus on what matters now.',
    },
    {
      icon: <Check className="w-16 h-16 text-neutral-900" />,
      title: 'Checked Out System',
      description: 'Completed items and tasks automatically move to "Checked Out" sections. Check them back in or use "Check In All" to restore.',
    },
    {
      icon: <ShoppingCart className="w-16 h-16 text-neutral-900" />,
      title: 'Items & Shopping',
      description: 'Track groceries with quantities and stores. Convert tasks to items instantly when needed.',
    },
    {
      icon: <StickyNote className="w-16 h-16 text-neutral-900" />,
      title: 'Notes & Knowledge',
      description: 'Create standalone notes or pin important notes at the top. Link notes to tasks for context.',
    },
  ];

  const adminSteps = [
    ...infoSteps,
    {
      icon: <Users className="w-16 h-16 text-neutral-900" />,
      title: 'Name Your Family',
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
        setError('Vul een familienaam in');
        return;
      }
      setError('');
      // Pre-fill lastName with family name when proceeding to admin form
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
      setError('Vul je voornaam in');
      return;
    }
    if (!email.trim()) {
      setError('Vul je e-mailadres in');
      return;
    }
    if (!password) {
      setError('Vul een wachtwoord in');
      return;
    }
    if (password.length < 8) {
      setError('Wachtwoord moet minimaal 8 tekens zijn');
      return;
    }
    if (!passwordConfirm) {
      setError('Vul het wachtwoord opnieuw in ter bevestiging');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Wachtwoorden komen niet overeen');
      return;
    }
    if (!familyName.trim()) {
      setError('Familienaam ontbreekt — ga terug en vul hem in');
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
        setError('Dit e-mailadres is al in gebruik. Probeer in te loggen.');
      } else if (msg.toLowerCase().includes('password')) {
        setError('Wachtwoord voldoet niet aan de eisen: min 8 tekens');
      } else {
        setError(msg || 'Account aanmaken mislukt. Probeer het opnieuw.');
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
          {isInfo ? 'Ga naar inloggen' : 'Overslaan'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {showAdminForm ? (
          // Admin account aanmaken
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
                <label className="block text-sm text-neutral-600 mb-1">Voornaam *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="Jan"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Achternaam</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="Jansen"
                />
                <p className="text-xs text-neutral-500 mt-1">Vooraf ingevuld met je familienaam, maar je kunt het aanpassen</p>
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">E-mailadres</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="admin@voorbeeld.nl"
                />
              </div>

              <div className="relative">
                <label className="block text-sm text-neutral-600 mb-1">Wachtwoord</label>
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
                <label className="block text-sm text-neutral-600 mb-1">Wachtwoord bevestigen</label>
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
                {isSubmitting ? 'Bezig met aanmaken…' : 'Account aanmaken'}
              </button>

              <p className="text-xs text-neutral-500 text-center">
                Dit is het enige account met rechten om nieuwe gebruikers uit te nodigen.
              </p>
            </div>
          </div>
        ) : showFamilyForm ? (
          // Familie naam stap
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
                <label className="block text-sm text-neutral-600 mb-1">Familienaam</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => { setFamilyName(e.target.value); setError(''); }}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="Familie Jansen"
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
                Volgende
              </button>
            </div>
          </div>
        ) : (
          // Reguliere onboarding slides
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

            {/* Progress dots — only for info slides (not family/admin form steps) */}
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
                  ? 'Ga naar inloggen'
                  : 'Aan de slag'
                : 'Volgende'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
