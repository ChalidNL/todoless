import React, { useState, useCallback, useEffect } from 'react';
import { Sparkles, ShoppingCart, Check, Eye, EyeOff, UserPlus, Users, Globe, CheckCircle2, ArrowRight, ChevronLeft, ChevronRight, ListTodo, CalendarDays, Star, StickyNote, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';
import { api } from '../lib/pocketbase-client';
import { pb } from '../lib/pocketbase';
import { AppLogo, AppMark } from './shared/AppLogo';
import { useLanguage } from '../context/LanguageContext';
import { SUPPORTED_UI_LANGUAGES, type SupportedUiLanguage } from '../i18n/translations';

// ── Types ──────────────────────────────────────────────────────────────────

interface OnboardingProps {
  mode: 'admin' | 'user' | 'info';
  onComplete: () => void;
}

type StepTheme = {
  bg: string;
  gradient: string;
  accent: string;
  accentText: string;
  dot: string;
  card: string;
  cardBorder: string;
  text: string;
  textMuted: string;
};

// ── Module showcase data ───────────────────────────────────────────────────

type ModuleId = 'tasks' | 'groceries' | 'calendar' | 'rewards' | 'notes' | 'sprint';

interface ModulePreview {
  id: ModuleId;
  title: string;
  tagline: string;
  color: string;
  colorBg: string;
  preview: React.ReactNode;
}

// ── Mini-mockups (reuse actual app component styling) ─────────────────────

const TaskPreview = () => (
  <div className="space-y-2">
    <div className="bg-white rounded-xl p-3 shadow-sm border border-neutral-100">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 rounded border-2 border-violet-400 flex-shrink-0" />
        <span className="text-xs font-medium text-neutral-800">Weekboodschappen plannen</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">Persoonlijk</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700">Boodschappen</span>
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700">
          <span className="inline-block w-2 h-2">🔺</span>Hoog
        </span>
      </div>
    </div>
    <div className="bg-white rounded-xl p-3 shadow-sm border border-neutral-100">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded border-2 border-neutral-300 flex-shrink-0" />
        <span className="text-xs text-neutral-500 line-through">Design-review afronden</span>
      </div>
    </div>
  </div>
);

const GroceriesPreview = () => (
  <div className="space-y-1.5">
    <div className="bg-white rounded-xl p-2.5 shadow-sm border border-neutral-100 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded border-2 border-emerald-400 flex-shrink-0" />
        <span className="text-xs text-neutral-700">Volkoren brood</span>
      </div>
      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">AH</span>
    </div>
    <div className="bg-white rounded-xl p-2.5 shadow-sm border border-neutral-100 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded border-2 border-neutral-300 flex-shrink-0" />
        <span className="text-xs text-neutral-500">Bananen (6 stuks)</span>
      </div>
      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Markt</span>
    </div>
    <div className="bg-white rounded-xl p-2.5 shadow-sm border border-neutral-100 flex items-center gap-2">
      <div className="w-4 h-4 rounded border-2 border-neutral-300 flex-shrink-0" />
      <span className="text-xs text-neutral-500">Halfvolle melk (2L)</span>
    </div>
  </div>
);

const CalendarPreview = () => (
  <div className="bg-white rounded-xl p-2 shadow-sm border border-neutral-100">
    <div className="grid grid-cols-7 gap-0.5 mb-1.5">
      {['M', 'D', 'W', 'D', 'V', 'Z', 'Z'].map((d, i) => (
        <span key={i} className="text-[9px] text-neutral-400 text-center">{d}</span>
      ))}
    </div>
    <div className="grid grid-cols-7 gap-0.5">
      {Array.from({ length: 14 }).map((_, i) => {
        const isToday = i === 5;
        const hasEvent = i === 3 || i === 8 || i === 11;
        return (
          <div key={i} className={`text-[10px] text-center py-0.5 rounded ${isToday ? 'bg-violet-500 text-white font-medium' : hasEvent ? 'relative' : 'text-neutral-600'}`}>
            {i + 1}
            {hasEvent && !isToday && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-violet-400 rounded-full" />}
          </div>
        );
      })}
    </div>
  </div>
);

const RewardsPreview = () => (
  <div className="space-y-1.5">
    <div className="bg-white rounded-xl p-2.5 shadow-sm border border-neutral-100 flex items-center gap-3">
      <span className="text-lg">⭐</span>
      <div className="flex-1">
        <span className="text-xs font-medium text-neutral-700">12 punten verzameld</span>
        <div className="w-full h-1.5 bg-neutral-100 rounded-full mt-1">
          <div className="w-3/4 h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" />
        </div>
      </div>
    </div>
    <div className="bg-white rounded-xl p-2.5 shadow-sm border border-neutral-100 flex items-center gap-3 opacity-60">
      <span className="text-lg">🏆</span>
      <span className="text-xs text-neutral-500">Volgende: Gouden streak (20 punten)</span>
    </div>
  </div>
);

const NotesPreview = () => (
  <div className="space-y-1.5">
    <div className="bg-white rounded-xl p-3 shadow-sm border border-neutral-100">
      <span className="text-[10px] text-neutral-400">Vandaag 14:30</span>
      <p className="text-xs text-neutral-700 mt-0.5">Ideeën voor verjaardagscadeau Lisa — misschien dat nieuwe bordspel?</p>
    </div>
    <div className="bg-white rounded-xl p-3 shadow-sm border border-neutral-100">
      <span className="text-[10px] text-neutral-400">Gisteren</span>
      <p className="text-xs text-neutral-500 mt-0.5">Vergeet niet: vuilnis aan de straat dinsdagavond</p>
    </div>
  </div>
);

const SprintPreview = () => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[10px] font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded">Sprint · Week 26</span>
      <span className="text-[10px] text-neutral-400">3/7 gedaan</span>
    </div>
    {['Kick-off meeting ✓', 'API integratie ✅', 'Frontend redesign', 'Database migratie'].map((item, i) => (
      <div key={i} className={`bg-white rounded-lg p-1.5 shadow-sm border border-neutral-100 flex items-center gap-2 ${i < 2 ? 'opacity-60' : ''}`}>
        <div className={`w-3 h-3 rounded border-2 flex-shrink-0 ${i < 1 ? 'bg-emerald-400 border-emerald-400 flex items-center justify-center' : i < 2 ? 'bg-neutral-300 border-neutral-300' : 'border-neutral-300'}`}>
          {i < 1 && <span className="text-[6px] text-white">✓</span>}
        </div>
        <span className={`text-[10px] ${i < 2 ? 'line-through text-neutral-400' : 'text-neutral-700'}`}>{item}</span>
      </div>
    ))}
  </div>
);

const MODULES: ModulePreview[] = [
  {
    id: 'tasks',
    title: 'Taken',
    tagline: 'Slimme takenlijsten met prioriteiten, labels en subtaken',
    color: 'violet',
    colorBg: 'from-violet-500/10 to-purple-500/5',
    preview: <TaskPreview />,
  },
  {
    id: 'groceries',
    title: 'Boodschappen',
    tagline: 'Georganiseerd per winkel, met hoeveelheden en categorieën',
    color: 'emerald',
    colorBg: 'from-emerald-500/10 to-teal-500/5',
    preview: <GroceriesPreview />,
  },
  {
    id: 'calendar',
    title: 'Agenda',
    tagline: 'Week-, dag- en maandweergave met kleurcodering',
    color: 'sky',
    colorBg: 'from-sky-500/10 to-blue-500/5',
    preview: <CalendarPreview />,
  },
  {
    id: 'rewards',
    title: 'Rewards',
    tagline: 'Verdien punten en blijf gemotiveerd met gamification',
    color: 'amber',
    colorBg: 'from-amber-500/10 to-yellow-500/5',
    preview: <RewardsPreview />,
  },
  {
    id: 'notes',
    title: 'Notities',
    tagline: 'Snelle notities en ideeën, altijd bij de hand',
    color: 'rose',
    colorBg: 'from-rose-500/10 to-pink-500/5',
    preview: <NotesPreview />,
  },
  {
    id: 'sprint',
    title: 'Sprint',
    tagline: 'Plan je week met sprint-planning en voortgangsweergave',
    color: 'indigo',
    colorBg: 'from-indigo-500/10 to-violet-500/5',
    preview: <SprintPreview />,
  },
];

// ── Theme colors per step ──────────────────────────────────────────────────

const STEP_THEMES: Record<string, StepTheme> = {
  welcome: {
    bg: 'from-violet-600 via-purple-600 to-indigo-700',
    gradient: 'bg-gradient-to-br',
    accent: 'bg-violet-500',
    accentText: 'text-violet-600',
    dot: 'bg-violet-400',
    card: 'bg-white/90 backdrop-blur-xl',
    cardBorder: 'border-white/20',
    text: 'text-white',
    textMuted: 'text-white/80',
  },
  showcase: {
    bg: 'from-slate-900 via-slate-800 to-slate-900',
    gradient: 'bg-gradient-to-b',
    accent: 'bg-violet-500',
    accentText: 'text-violet-400',
    dot: 'bg-violet-400',
    card: 'bg-white/95 backdrop-blur-md',
    cardBorder: 'border-neutral-200/50',
    text: 'text-white',
    textMuted: 'text-white/70',
  },
  workspace: {
    bg: 'from-indigo-600 via-blue-600 to-cyan-700',
    gradient: 'bg-gradient-to-br',
    accent: 'bg-indigo-500',
    accentText: 'text-indigo-600',
    dot: 'bg-indigo-400',
    card: 'bg-white/15 backdrop-blur-2xl',
    cardBorder: 'border-white/15',
    text: 'text-white',
    textMuted: 'text-white/80',
  },
  account: {
    bg: 'from-emerald-600 via-teal-600 to-green-700',
    gradient: 'bg-gradient-to-br',
    accent: 'bg-emerald-500',
    accentText: 'text-emerald-600',
    dot: 'bg-emerald-400',
    card: 'bg-white/15 backdrop-blur-2xl',
    cardBorder: 'border-white/15',
    text: 'text-white',
    textMuted: 'text-white/80',
  },
  language: {
    bg: 'from-amber-500 via-orange-500 to-rose-600',
    gradient: 'bg-gradient-to-br',
    accent: 'bg-amber-500',
    accentText: 'text-amber-600',
    dot: 'bg-amber-400',
    card: 'bg-white/15 backdrop-blur-2xl',
    cardBorder: 'border-white/15',
    text: 'text-white',
    textMuted: 'text-white/80',
  },
  done: {
    bg: 'from-violet-600 via-purple-600 to-indigo-700',
    gradient: 'bg-gradient-to-br',
    accent: 'bg-violet-500',
    accentText: 'text-violet-600',
    dot: 'bg-violet-400',
    card: 'bg-white/90 backdrop-blur-xl',
    cardBorder: 'border-white/20',
    text: 'text-white',
    textMuted: 'text-white/80',
  },
};

// ── Shared components ──────────────────────────────────────────────────────

const StepTransition: React.FC<{ children: React.ReactNode; stepKey: string }> = ({ children, stepKey }) => (
  <div
    key={stepKey}
    className="animate-in"
    style={{
      animation: 'onboardingSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    }}
  >
    {children}
  </div>
);

const GlowButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, disabled, children, className = '' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`relative px-8 py-3.5 rounded-2xl font-semibold text-white transition-all duration-300 
      bg-violet-500 hover:bg-violet-400 
      shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:shadow-[0_0_45px_rgba(139,92,246,0.6)]
      active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed
      ${className}`}
  >
    {children}
  </button>
);

const ProgressDots: React.FC<{ total: number; current: number; theme: StepTheme }> = ({ total, current, theme }) => (
  <div className="flex gap-2">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={`w-2 h-2 rounded-full transition-all duration-500 ${
          i === current
            ? `${theme.dot} w-6`
            : i < current
            ? `${theme.dot} opacity-60`
            : 'bg-white/20'
        }`}
      />
    ))}
  </div>
);

// ── Language selector labels ──────────────────────────────────────────────

const LANG_LABELS: Record<SupportedUiLanguage, string> = {
  nl: 'Nederlands',
  fr: 'Français',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
};

// ── Main component ────────────────────────────────────────────────────────

export const Onboarding = ({ mode, onComplete }: OnboardingProps) => {
  const { updateAppSettings } = useApp();
  const { t, setLanguage } = useLanguage();

  // ── State ──
  const [currentStep, setCurrentStep] = useState(0);
  const [moduleIndex, setModuleIndex] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [languageSelected, setLanguageSelected] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const isAdmin = mode === 'admin';
  const isInfo = mode === 'info';

  // ── Step definitions ──
  // Steps vary by mode:
  // admin: welcome → showcase → workspace → account → language → done
  // user:  welcome → showcase → language → done
  // info:  welcome → showcase → language → done

  type StepId = 'welcome' | 'showcase' | 'workspace' | 'account' | 'language' | 'done';

  const adminSteps: StepId[] = ['welcome', 'showcase', 'workspace', 'account', 'language', 'done'];
  const simpleSteps: StepId[] = ['welcome', 'showcase', 'language', 'done'];
  const steps = isAdmin ? adminSteps : simpleSteps;

  const stepId = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const theme = STEP_THEMES[stepId];

  // ── Navigation ──
  const goNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setTransitioning(true);
      setTimeout(() => {
        setCurrentStep((s) => s + 1);
        setTransitioning(false);
      }, 50);
    }
  }, [currentStep, steps.length]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setTransitioning(true);
      setTimeout(() => {
        setCurrentStep((s) => s - 1);
        setTransitioning(false);
      }, 50);
    }
  }, [currentStep]);

  // ── Module showcase carousel ──
  const nextModule = () => setModuleIndex((i) => (i + 1) % MODULES.length);
  const prevModule = () => setModuleIndex((i) => (i - 1 + MODULES.length) % MODULES.length);

  // ── Admin creation handlers ──
  const handleWorkspaceNext = () => {
    if (!familyName.trim()) {
      setError('Voer een werkruimte naam in');
      return;
    }
    setError('');
    if (!lastName.trim()) setLastName(familyName.trim());
    goNext();
  };

  const handleCreateAdmin = async () => {
    if (!firstName.trim()) { setError('Voer uw voornaam in'); return; }
    if (!email.trim()) { setError('Voer uw e-mailadres in'); return; }
    if (!password) { setError('Voer een wachtwoord in'); return; }
    if (password.length < 8) { setError('Wachtwoord moet minimaal 8 tekens bevatten'); return; }
    if (!passwordConfirm) { setError('Bevestig uw wachtwoord'); return; }
    if (password !== passwordConfirm) { setError('Wachtwoorden komen niet overeen'); return; }
    if (!familyName.trim()) { setError('Werkruimte naam ontbreekt'); return; }

    setError('');
    setIsSubmitting(true);

    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      await api.registerAdmin(email, password, fullName, familyName.trim());
      await api.markOnboardingSeen(true);
      updateAppSettings({ hasCompletedOnboarding: true, setupComplete: true });
      goNext(); // → language step
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('already')) {
        setError('Dit e-mailadres is al in gebruik. Probeer in te loggen.');
      } else if (msg.toLowerCase().includes('password')) {
        setError('Wachtwoord voldoet niet aan de vereisten.');
      } else {
        setError(msg || 'Account aanmaken mislukt. Probeer het opnieuw.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Language select ──
  const handleSelectLanguage = (lang: SupportedUiLanguage) => {
    setLanguage(lang);
    setLanguageSelected(true);
  };

  // ── Final actions ──
  const handleDone = () => {
    if (isInfo) {
      onComplete(); // → login
    } else if (mode === 'user') {
      api.markOnboardingSeen(false);
      updateAppSettings({ hasCompletedOnboarding: true });
      onComplete();
    } else {
      // admin — account already created, go to app
      onComplete();
    }
  };

  const handleSkip = () => {
    if (isInfo || isAdmin) onComplete();
    else {
      api.markOnboardingSeen(false);
      updateAppSettings({ hasCompletedOnboarding: true });
      onComplete();
    }
  };

  // ── Render helpers ──
  const renderInput = (label: string, value: string, onChange: (v: string) => void, opts: {
    type?: string;
    placeholder?: string;
    autoFocus?: boolean;
    suffix?: React.ReactNode;
  } = {}) => (
    <div className="group">
      <label className="block text-sm text-white/80 mb-1.5 font-medium">{label}</label>
      <div className="relative">
        <input
          type={opts.type || 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={opts.placeholder}
          autoFocus={opts.autoFocus}
          className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-xl text-white placeholder:text-white/30 
            focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent
            backdrop-blur-sm transition-all duration-200"
        />
        {opts.suffix}
      </div>
    </div>
  );

  // ── Step: Welcome ──
  const renderWelcome = () => (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="mb-8 relative">
        <div className="absolute inset-0 bg-violet-400/30 blur-3xl rounded-full -m-8" />
        <AppMark className="w-20 h-20 relative z-10 drop-shadow-2xl" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
        Welkom bij todoless
      </h1>
      <p className="text-lg text-white/70 max-w-xs mb-10 leading-relaxed">
        Jouw gezinsassistent voor taken, boodschappen en meer — simpel en overzichtelijk.
      </p>
      <GlowButton onClick={goNext}>
        <span className="flex items-center gap-2">
          Ontdek de mogelijkheden
          <ArrowRight className="w-4 h-4" />
        </span>
      </GlowButton>
    </div>
  );

  // ── Step: Module showcase ──
  const renderShowcase = () => {
    const mod = MODULES[moduleIndex];
    const colorMap: Record<string, string> = {
      violet: 'text-violet-400',
      emerald: 'text-emerald-400',
      sky: 'text-sky-400',
      amber: 'text-amber-400',
      rose: 'text-rose-400',
      indigo: 'text-indigo-400',
    };

    return (
      <div className="flex flex-col items-center min-h-[70vh] px-6 pt-8">
        {/* Progress counter */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={prevModule} className="text-white/40 hover:text-white/80 transition-colors p-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-1.5">
            {MODULES.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i === moduleIndex ? 'bg-white w-4' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
          <button onClick={nextModule} className="text-white/40 hover:text-white/80 transition-colors p-1">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Module title */}
        <span className={`text-xs font-semibold uppercase tracking-widest mb-2 ${colorMap[mod.color] || 'text-white/60'}`}>
          {mod.title}
        </span>
        <p className="text-sm text-white/60 text-center max-w-xs mb-6 leading-relaxed">
          {mod.tagline}
        </p>

        {/* Mini-mockup */}
        <div className={`w-full max-w-[260px] rounded-2xl p-4 bg-gradient-to-br ${mod.colorBg} backdrop-blur-sm border border-white/10 mb-8 shadow-2xl`}>
          {mod.preview}
        </div>

        {/* CTA - only on last module or skip */}
        {moduleIndex === MODULES.length - 1 ? (
          <GlowButton onClick={goNext}>
            <span className="flex items-center gap-2">
              {isAdmin ? 'Aan de slag' : 'Verder'}
              <ArrowRight className="w-4 h-4" />
            </span>
          </GlowButton>
        ) : (
          <p className="text-xs text-white/30">Veeg of tik de pijlen om verder te gaan</p>
        )}
      </div>
    );
  };

  // ── Step: Workspace name (admin only) ──
  const renderWorkspace = () => (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className={`w-full max-w-sm ${theme.card} ${theme.cardBorder} border rounded-3xl p-8 shadow-2xl`}>
        <div className="flex justify-center mb-6">
          <div className={`w-14 h-14 rounded-2xl ${theme.accent} flex items-center justify-center`}>
            <Users className="w-7 h-7 text-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-2">Noem je werkruimte</h2>
        <p className="text-sm text-white/70 text-center mb-6">
          Dit is de gedeelde ruimte voor jouw huishouden. Alle leden zien dezelfde inhoud.
        </p>

        {renderInput('Werkruimte naam', familyName, (v) => { setFamilyName(v); setError(''); }, {
          placeholder: 'Familie Jansen',
          autoFocus: true,
        })}

        {error && (
          <p className="text-red-300 text-sm mt-3 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={goPrev} className="flex-1 py-3 rounded-2xl border border-white/20 text-white/70 hover:bg-white/10 transition-all font-medium text-sm">
            Terug
          </button>
          <button onClick={handleWorkspaceNext} className="flex-1 py-3 rounded-2xl bg-white text-indigo-600 hover:bg-white/90 transition-all font-semibold text-sm shadow-lg">
            Volgende
          </button>
        </div>
      </div>
    </div>
  );

  // ── Step: Admin account (admin only) ──
  const renderAccount = () => (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className={`w-full max-w-sm ${theme.card} ${theme.cardBorder} border rounded-3xl p-8 shadow-2xl`}>
        <div className="flex justify-center mb-6">
          <div className={`w-14 h-14 rounded-2xl ${theme.accent} flex items-center justify-center`}>
            <UserPlus className="w-7 h-7 text-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-2">Maak je account aan</h2>
        <p className="text-sm text-white/70 text-center mb-6">
          Dit is het beheerdersaccount voor jouw werkruimte.
        </p>

        <div className="space-y-4">
          {renderInput('Voornaam *', firstName, setFirstName, { placeholder: 'Jan', autoFocus: true })}
          {renderInput('Achternaam', lastName, setLastName, { placeholder: 'Jansen' })}
          {renderInput('E-mailadres', email, setEmail, { type: 'email', placeholder: 'jan@voorbeeld.nl' })}
          {renderInput('Wachtwoord', password, setPassword, {
            type: showPassword ? 'text' : 'password',
            placeholder: 'Minimaal 8 tekens',
            suffix: (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            ),
          })}
          {renderInput('Bevestig wachtwoord', passwordConfirm, setPasswordConfirm, {
            type: showPassword ? 'text' : 'password',
            placeholder: 'Herhaal wachtwoord',
          })}
        </div>

        {error && (
          <p className="text-red-300 text-sm mt-4 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={goPrev} className="flex-1 py-3 rounded-2xl border border-white/20 text-white/70 hover:bg-white/10 transition-all font-medium text-sm">
            Terug
          </button>
          <button
            onClick={handleCreateAdmin}
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-2xl bg-white text-emerald-600 hover:bg-white/90 transition-all font-semibold text-sm shadow-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Bezig...' : 'Account aanmaken'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Step: Language ──
  const renderLanguage = () => (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className={`w-full max-w-sm ${theme.card} ${theme.cardBorder} border rounded-3xl p-8 shadow-2xl`}>
        <div className="flex justify-center mb-6">
          <div className={`w-14 h-14 rounded-2xl ${theme.accent} flex items-center justify-center`}>
            <Globe className="w-7 h-7 text-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-2">Kies je taal</h2>
        <p className="text-sm text-white/70 text-center mb-6">
          Selecteer je voorkeurstaal. Je kunt dit later altijd aanpassen.
        </p>

        <div className="space-y-2">
          {SUPPORTED_UI_LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => handleSelectLanguage(lang)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl 
                bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20
                transition-all duration-200 text-left group"
            >
              <span className="text-white font-medium text-sm">
                {LANG_LABELS[lang]}
              </span>
              <span className="text-xs text-white/40 uppercase font-mono group-hover:text-white/60 transition-colors">
                {lang}
              </span>
            </button>
          ))}
        </div>

        <button onClick={goNext} className="w-full mt-6 py-3 rounded-2xl bg-white text-amber-600 hover:bg-white/90 transition-all font-semibold text-sm shadow-lg">
          {languageSelected ? 'Volgende' : 'Overslaan'}
        </button>
      </div>
    </div>
  );

  // ── Step: Done ──
  const renderDone = () => (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="mb-6">
        <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto border border-white/20">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">
        {isInfo ? 'Je bent er klaar voor!' : isAdmin ? 'Alles staat klaar!' : 'Klaar om te beginnen!'}
      </h2>
      <p className="text-white/70 text-sm max-w-xs mb-10 leading-relaxed">
        {isInfo
          ? 'Log in om aan de slag te gaan met je werkruimte.'
          : 'Je werkruimte is ingesteld. Begin met het organiseren van je dagelijkse leven.'}
      </p>
      <GlowButton onClick={handleDone}>
        <span className="flex items-center gap-2">
          {isInfo ? 'Naar inloggen' : 'Open todoless'}
          <Sparkles className="w-4 h-4" />
        </span>
      </GlowButton>
    </div>
  );

  // ── Main render ──
  const renderStep = () => {
    switch (stepId) {
      case 'welcome': return renderWelcome();
      case 'showcase': return renderShowcase();
      case 'workspace': return renderWorkspace();
      case 'account': return renderAccount();
      case 'language': return renderLanguage();
      case 'done': return renderDone();
      default: return null;
    }
  };

  const showProgressDots = !['workspace', 'account'].includes(stepId);
  const showBack = currentStep > 0 && !['workspace', 'account', 'done'].includes(stepId);
  const infoStepsVisible = stepId !== 'workspace' && stepId !== 'account';

  return (
    <div className={`min-h-screen ${theme.gradient} ${theme.bg} flex flex-col overflow-hidden`}>
      {/* Global animation keyframes injected once */}
      <style>{`
        @keyframes onboardingSlideIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .animate-in {
          animation: onboardingSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Skip button */}
      {infoStepsVisible && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={handleSkip}
            className="text-sm text-white/50 hover:text-white/80 transition-colors px-3 py-1.5 rounded-full hover:bg-white/10"
          >
            {isInfo ? 'Naar inloggen' : 'Overslaan'}
          </button>
        </div>
      )}

      {/* Back button */}
      {showBack && (
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={goPrev}
            className="text-sm text-white/50 hover:text-white/80 transition-colors px-3 py-1.5 rounded-full hover:bg-white/10 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Terug
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 flex flex-col justify-center" style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 50ms' }}>
        <StepTransition stepKey={`${stepId}-${moduleIndex}`}>
          {renderStep()}
        </StepTransition>
      </div>

      {/* Progress dots */}
      {showProgressDots && (
        <div className="flex justify-center pb-10">
          <ProgressDots
            total={infoStepsVisible ? (steps.filter(s => s !== 'workspace' && s !== 'account').length) : steps.length}
            current={infoStepsVisible ? currentStep - steps.filter(s => s === 'workspace' || s === 'account' && steps.indexOf(s) < currentStep).length : currentStep}
            theme={theme}
          />
        </div>
      )}

      {/* Bottom safe area */}
      {['workspace', 'account'].includes(stepId) && <div className="h-4" />}
    </div>
  );
};
