import React, { useCallback, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  ListTodo,
  NotebookPen,
  ShoppingCart,
  Sparkles,
  Star,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../lib/pocketbase-client';
import { pb } from '../lib/pocketbase';
import { AppMark } from './shared/AppLogo';
import { useLanguage } from '../context/LanguageContext';
import { SUPPORTED_UI_LANGUAGES, type SupportedUiLanguage } from '../i18n/translations';

interface OnboardingProps {
  mode: 'admin' | 'user' | 'info';
  onComplete: () => void;
}

type StepId = 'language' | 'welcome' | 'showcase' | 'workspace' | 'account' | 'done';
type Translate = (key: string) => string;

const LANG_LABELS: Record<SupportedUiLanguage, string> = {
  nl: 'Nederlands',
  fr: 'Français',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
};

const MODULES = [
  { id: 'tasks', icon: ListTodo, color: '#8b5cf6' },
  { id: 'groceries', icon: ShoppingCart, color: '#10b981' },
  { id: 'calendar', icon: CalendarDays, color: '#0ea5e9' },
  { id: 'rewards', icon: Star, color: '#f59e0b' },
  { id: 'notes', icon: NotebookPen, color: '#f43f5e' },
  { id: 'sprint', icon: Zap, color: '#6366f1' },
] as const;

function GlowButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="onboarding-primary-button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="onboarding-progress" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index === current ? 'is-active' : index < current ? 'is-complete' : ''} />
      ))}
    </div>
  );
}

function ShowcasePreview({ moduleIndex, t }: { moduleIndex: number; t: Translate }) {
  const module = MODULES[moduleIndex];
  const Icon = module.icon;
  return (
    <section className="onboarding-showcase-card" style={{ '--onboarding-module': module.color } as React.CSSProperties}>
      <div className="onboarding-showcase-icon"><Icon aria-hidden="true" /></div>
      <p className="onboarding-eyebrow">{t(`onboarding.module.${module.id}.title`)}</p>
      <h2>{t(`onboarding.module.${module.id}.tagline`)}</h2>
      <div className="onboarding-mockup" aria-hidden="true">
        <span /><span /><span />
      </div>
    </section>
  );
}

export function Onboarding({ mode, onComplete }: OnboardingProps) {
  const { updateAppSettings } = useApp();
  const { language, setLanguage, t } = useLanguage();
  const isAdmin = mode === 'admin';
  const isInfo = mode === 'info';
  const steps: StepId[] = isAdmin
    ? ['language', 'welcome', 'showcase', 'workspace', 'account', 'done']
    : ['language', 'welcome', 'showcase', 'done'];

  const [currentStep, setCurrentStep] = useState(0);
  const [moduleIndex, setModuleIndex] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedUiLanguage>(language);
  const [languageSelected, setLanguageSelected] = useState(false);
  const [isPersistingLanguage, setIsPersistingLanguage] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const stepId = steps[currentStep];

  const moveTo = useCallback((nextStep: number) => {
    setTransitioning(true);
    window.setTimeout(() => {
      setCurrentStep(nextStep);
      setTransitioning(false);
    }, 50);
  }, []);

  const goNext = useCallback(() => {
    if (currentStep < steps.length - 1) moveTo(currentStep + 1);
  }, [currentStep, moveTo, steps.length]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) moveTo(currentStep - 1);
  }, [currentStep, moveTo]);

  const selectLanguage = async (nextLanguage: SupportedUiLanguage) => {
    setSelectedLanguage(nextLanguage);
    setLanguageSelected(true);
    setLanguage(nextLanguage);
    setError('');

    const userId = pb.authStore.record?.id;
    if (mode === 'user' && userId) {
      setIsPersistingLanguage(true);
      try {
        await api.updateUser(userId, { language: nextLanguage });
      } catch {
        setError(t('onboarding.languageSaveFailed'));
      } finally {
        setIsPersistingLanguage(false);
      }
    }
  };

  const handleWorkspaceNext = () => {
    if (!familyName.trim()) {
      setError(t('onboarding.pleaseEnterWorkspaceName'));
      return;
    }
    setError('');
    if (!lastName.trim()) setLastName(familyName.trim());
    goNext();
  };

  const handleCreateAdmin = async () => {
    if (!firstName.trim()) { setError(t('onboarding.pleaseEnterFirstName')); return; }
    if (!email.trim()) { setError(t('onboarding.pleaseEnterEmail')); return; }
    if (!password) { setError(t('onboarding.pleaseEnterPassword')); return; }
    if (password.length < 8) { setError(t('onboarding.passwordMinLength')); return; }
    if (!passwordConfirm) { setError(t('onboarding.pleaseConfirmPassword')); return; }
    if (password !== passwordConfirm) { setError(t('onboarding.passwordsDoNotMatch')); return; }
    if (!familyName.trim()) { setError(t('onboarding.workspaceNameMissing')); return; }

    setError('');
    setIsSubmitting(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      await api.registerAdmin(email, password, fullName, familyName.trim(), selectedLanguage);
      await api.markOnboardingSeen(true);
      updateAppSettings({ hasCompletedOnboarding: true, setupComplete: true });
      goNext();
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : '';
      if (/email|already/i.test(message)) setError(t('onboarding.emailAlreadyInUse'));
      else if (/password/i.test(message)) setError(t('onboarding.passwordDoesNotMeetRequirements'));
      else setError(message || t('onboarding.accountCreationFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const finish = async () => {
    if (mode === 'user') {
      await api.markOnboardingSeen(false);
      updateAppSettings({ hasCompletedOnboarding: true });
    }
    onComplete();
  };

  const skip = async () => {
    if (mode === 'user') {
      await api.markOnboardingSeen(false);
      updateAppSettings({ hasCompletedOnboarding: true });
    }
    onComplete();
  };

  const renderLanguage = () => (
    <div className="onboarding-centered">
      <section className="onboarding-glass-card onboarding-language-card">
        <div className="onboarding-step-icon"><Globe aria-hidden="true" /></div>
        <h1>{t('onboarding.languageStepTitle')}</h1>
        <p>{t('onboarding.languageStepDesc')}</p>
        <div className="onboarding-language-options">
          {SUPPORTED_UI_LANGUAGES.map((option) => (
            <button
              type="button"
              key={option}
              aria-pressed={languageSelected && selectedLanguage === option}
              className={languageSelected && selectedLanguage === option ? 'is-selected' : ''}
              onClick={() => void selectLanguage(option)}
            >
              <span>{LANG_LABELS[option]}</span><small>{option}</small>
            </button>
          ))}
        </div>
        {error && <p className="onboarding-error" role="alert">{error}</p>}
        <button
          type="button"
          className="onboarding-light-button"
          disabled={!languageSelected || isPersistingLanguage}
          onClick={goNext}
        >
          {isPersistingLanguage ? t('common.loading') : t('onboarding.next')}
        </button>
      </section>
    </div>
  );

  const renderWelcome = () => (
    <div className="onboarding-centered onboarding-welcome">
      <div className="onboarding-logo-glow"><AppMark /></div>
      <h1>{t('onboarding.welcome')}</h1>
      <p>{t('onboarding.welcomeDescription')}</p>
      <GlowButton onClick={goNext}>
        <span>{t('onboarding.discoverFeatures')}</span><ArrowRight aria-hidden="true" />
      </GlowButton>
    </div>
  );

  const renderShowcase = () => (
    <div className="onboarding-centered onboarding-showcase">
      <div className="onboarding-carousel-controls">
        <button type="button" aria-label={t('common.previous')} onClick={() => setModuleIndex((moduleIndex - 1 + MODULES.length) % MODULES.length)}><ChevronLeft /></button>
        <div>{MODULES.map((module, index) => <span key={module.id} className={index === moduleIndex ? 'is-active' : ''} />)}</div>
        <button type="button" aria-label={t('common.next')} onClick={() => setModuleIndex((moduleIndex + 1) % MODULES.length)}><ChevronRight /></button>
      </div>
      <ShowcasePreview moduleIndex={moduleIndex} t={t} />
      {moduleIndex === MODULES.length - 1 ? (
        <GlowButton onClick={goNext}><span>{isAdmin ? t('onboarding.getStarted') : t('onboarding.next')}</span><ArrowRight /></GlowButton>
      ) : <p className="onboarding-hint">{t('onboarding.showcaseHint')}</p>}
    </div>
  );

  const input = (
    label: string,
    value: string,
    setValue: (value: string) => void,
    options: { type?: string; placeholder?: string; suffix?: React.ReactNode } = {},
  ) => (
    <label className="onboarding-field">
      <span>{label}</span>
      <span className="onboarding-input-wrap">
        <input
          type={options.type ?? 'text'}
          value={value}
          placeholder={options.placeholder}
          onChange={(event) => { setValue(event.target.value); setError(''); }}
        />
        {options.suffix}
      </span>
    </label>
  );

  const renderWorkspace = () => (
    <div className="onboarding-centered">
      <section className="onboarding-glass-card">
        <div className="onboarding-step-icon"><Users /></div>
        <h1>{t('onboarding.step3Title')}</h1>
        <p>{t('onboarding.workspaceDescription')}</p>
        {input(t('onboarding.workspaceName'), familyName, setFamilyName, { placeholder: t('onboarding.exampleFamilyName') })}
        {error && <p className="onboarding-error" role="alert">{error}</p>}
        <div className="onboarding-form-actions">
          <button type="button" className="onboarding-outline-button" onClick={goPrev}>{t('common.back')}</button>
          <button type="button" className="onboarding-light-button" onClick={handleWorkspaceNext}>{t('onboarding.next')}</button>
        </div>
      </section>
    </div>
  );

  const passwordToggle = (
    <button type="button" className="onboarding-password-toggle" aria-label={t(showPassword ? 'onboarding.hidePassword' : 'onboarding.showPassword')} onClick={() => setShowPassword(!showPassword)}>
      {showPassword ? <EyeOff /> : <Eye />}
    </button>
  );

  const renderAccount = () => (
    <div className="onboarding-centered">
      <section className="onboarding-glass-card">
        <div className="onboarding-step-icon"><UserPlus /></div>
        <h1>{t('onboarding.step4Title')}</h1>
        <p>{t('onboarding.accountDescription')}</p>
        <div className="onboarding-fields">
          {input(t('onboarding.firstName'), firstName, setFirstName, { placeholder: t('onboarding.firstNamePlaceholder') })}
          {input(t('onboarding.lastName'), lastName, setLastName, { placeholder: t('onboarding.lastNamePlaceholder') })}
          {input(t('onboarding.email'), email, setEmail, { type: 'email', placeholder: t('onboarding.emailPlaceholder') })}
          {input(t('onboarding.password'), password, setPassword, { type: showPassword ? 'text' : 'password', placeholder: t('onboarding.passwordPlaceholder'), suffix: passwordToggle })}
          {input(t('onboarding.confirmPassword'), passwordConfirm, setPasswordConfirm, { type: showPassword ? 'text' : 'password', placeholder: t('onboarding.confirmPasswordPlaceholder') })}
        </div>
        {error && <p className="onboarding-error" role="alert">{error}</p>}
        <div className="onboarding-form-actions">
          <button type="button" className="onboarding-outline-button" onClick={goPrev}>{t('common.back')}</button>
          <button type="button" className="onboarding-light-button" disabled={isSubmitting} onClick={() => void handleCreateAdmin()}>
            {isSubmitting ? t('onboarding.creatingAccount') : t('onboarding.createAccount')}
          </button>
        </div>
      </section>
    </div>
  );

  const renderDone = () => {
    const title = isInfo ? t('onboarding.doneInfoTitle') : isAdmin ? t('onboarding.doneAdminTitle') : t('onboarding.doneUserTitle');
    const description = isInfo ? t('onboarding.doneInfoDescription') : t('onboarding.doneWorkspaceDescription');
    return (
      <div className="onboarding-centered onboarding-done">
        <div className="onboarding-done-icon"><CheckCircle2 /></div>
        <h1>{title}</h1>
        <p>{description}</p>
        <GlowButton onClick={() => void finish()}>
          <span>{isInfo ? t('onboarding.goToLogin') : t('onboarding.openApp')}</span><Sparkles />
        </GlowButton>
      </div>
    );
  };

  const renderStep = () => {
    if (stepId === 'language') return renderLanguage();
    if (stepId === 'welcome') return renderWelcome();
    if (stepId === 'showcase') return renderShowcase();
    if (stepId === 'workspace') return renderWorkspace();
    if (stepId === 'account') return renderAccount();
    return renderDone();
  };

  return (
    <main className={`onboarding-shell onboarding-theme-${stepId}`}>
      <button type="button" className="onboarding-skip" onClick={() => void skip()}>
        {isInfo ? t('onboarding.goToLogin') : t('onboarding.skip')}
      </button>
      {currentStep > 0 && !['workspace', 'account', 'done'].includes(stepId) && (
        <button type="button" className="onboarding-back" onClick={goPrev}><ChevronLeft />{t('common.back')}</button>
      )}
      <div className={`onboarding-transition ${transitioning ? 'is-transitioning' : ''}`} key={`${stepId}-${moduleIndex}`}>
        {renderStep()}
      </div>
      {!['workspace', 'account'].includes(stepId) && <ProgressDots current={currentStep} total={steps.length} />}
    </main>
  );
}
