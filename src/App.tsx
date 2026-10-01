import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { Onboarding } from './components/Onboarding';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ResetPassword } from './components/ResetPassword';
import { InboxBacklog } from './components/InboxBacklog';
import { TasksView } from './components/TasksView';

import { GroceriesView } from './components/groceries/GroceriesView';
import { Settings } from './components/Settings';

import { pb } from './lib/pocketbase';
import { api } from './lib/pocketbase-client';
import { Inbox as InboxIcon, ShoppingCart, Settings as SettingsIcon, RefreshCw, CalendarDays, CheckSquare } from 'lucide-react';
import { SplashScreen } from './components/shared/SplashScreen';
import { getOnboardingMode, OnboardingMode } from './lib/onboarding-gate';
import { fetchSetupStatus } from './lib/bootstrap-status';
import { t } from './i18n/translations';
import { AppShell } from './components/layout/AppShell';
import { BottomNavigation, type BottomNavItem } from './components/layout/BottomNavigation';

// Screens not needed at launch are split out of the startup bundle (the
// service worker precaches every chunk, so they still open offline).
const CalendarView = lazy(() => import('./components/calendar/CalendarView').then((m) => ({ default: m.CalendarView })));
const MembersView = lazy(() => import('./components/MembersView').then((m) => ({ default: m.MembersView })));
const LabelsView = lazy(() => import('./components/LabelsView').then((m) => ({ default: m.LabelsView })));
const ShopsView = lazy(() => import('./components/ShopsView').then((m) => ({ default: m.ShopsView })));
const ProfileView = lazy(() => import('./components/ProfileView').then((m) => ({ default: m.ProfileView })));
const SettingsPreferences = lazy(() => import('./components/SettingsPreferences').then((m) => ({ default: m.SettingsPreferences })));
const NotificationsView = lazy(() => import('./components/NotificationsView').then((m) => ({ default: m.NotificationsView })));

const ONBOARDING_SEEN_KEY = 'todoless_onboarding_completed';

const getOnboardingSeenValueForUser = (userId?: string | null) =>
  userId ? `user:${userId}` : 'anon';

/** Remember that this device has a signed-in user (invite registration and plain login included). */
const markDeviceOnboarded = () => {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, getOnboardingSeenValueForUser(pb.authStore.record?.id ?? null));
  } catch { /* storage unavailable: worst case the intro is shown again */ }
};

// Known top-level app routes (mirrors the <Routes> tree below). Used so the
// first-run/onboarding check can recognize an unmapped path and defer to the
// Router's own wildcard redirect instead of unconditionally showing onboarding.
const KNOWN_APP_PATHS = [
  '/',
  '/tasks',
  '/focus',
  '/calendar',
  '/groceries',
  '/settings',
  '/settings/profile',
  '/settings/preferences',
  '/settings/members',
  '/settings/labels',
  '/settings/shops',
  '/settings/notifications',
  '/register',
];

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-neutral-50 flex items-center justify-center p-4" role="alert">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold mb-2">{t('auth.appError')}</h1>
            <p className="text-neutral-600 mb-6 text-sm">
              {t('errors.unknown')}
            </p>
            {/* Reload first: a render crash rarely needs local state wiped. The
                reset (sign out + clear this device's settings; server data is
                untouched) stays available as the escape hatch. */}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[var(--app-touch-target)] w-full rounded-lg bg-[var(--app-primary)] px-4 py-3 font-medium text-white transition-colors"
            >
              {t('errors.reload')}
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="mt-2 min-h-[var(--app-touch-target)] w-full rounded-lg px-4 py-2 text-sm font-medium text-red-600"
            >
              {t('errors.resetLocal')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const [appScreen, setAppScreen] = useState<'checking' | 'onboarding' | 'login' | 'register' | 'reset' | 'app'>('checking');
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>('none');
  const hasInitializedRef = useRef(false);
  const { completionMessage, dataLoadState, loadError, retryLoad } = useApp();
  const { user, loading } = useAuth();
  const { language } = useLanguage();

  useEffect(() => {
    const checkFirstRun = async () => {
      if (loading) return;

      // Password reset link from the email (#68) always wins.
      if (window.location.pathname.toLowerCase() === '/reset-password') {
        setAppScreen('reset');
        return;
      }

      // INVITE FLOW: if URL has invite code, go directly to register
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('invite') || urlParams.has('code')) {
        const inviteCode = urlParams.get('invite') || urlParams.get('code') || '';
        if (inviteCode.trim()) {
          // Set invite code in localStorage so Register component can pick it up
          localStorage.setItem('pending_invite_code', inviteCode.trim());
          setAppScreen('register');
          return;
        }
      }

      // DEF-ROUTE-001 fix: an authenticated user hitting an unrecognized deep
      // link (e.g. a stale/bad URL) must never be routed into onboarding —
      // send them straight to 'app' so the Router's own wildcard route
      // (`<Route path="*" element={<Navigate to="/" replace />} />`) handles it.
      const currentPath = window.location.pathname.toLowerCase();
      const isKnownPath = KNOWN_APP_PATHS.includes(currentPath);
      if (!isKnownPath && pb.authStore.isValid && user) {
        setAppScreen('app');
        return;
      }

      const onboardingSeenValue = localStorage.getItem(ONBOARDING_SEEN_KEY);
      const expectedOnboardingSeenValue = getOnboardingSeenValueForUser((user as any)?.id ?? null);
      // Signed out on a device where someone already used the app (any stored
      // value): go straight to login, never back to the intro slides.
      const hasCompletedOnboarding =
        onboardingSeenValue === expectedOnboardingSeenValue ||
        (!!onboardingSeenValue && !user);

      // Fast path: if localStorage says onboarding already done, skip all APi checks
      if (hasCompletedOnboarding) {
        const path = window.location.pathname.toLowerCase();
        if (path === '/register') {
          setAppScreen('register');
        } else if (!pb.authStore.isValid || !user) {
          setAppScreen('login');
          // A server that was reset has no accounts: first-run setup, not a
          // login nobody can pass. Checked in the background (fast path).
          void fetchSetupStatus().then(({ hasUsers }) => {
            if (hasUsers === false) {
              localStorage.removeItem(ONBOARDING_SEEN_KEY);
              setOnboardingMode('admin');
              setAppScreen('onboarding');
            }
          }).catch(() => { /* offline: stay on login */ });
        } else {
          setAppScreen('app');
        }
        return;
      }

      const [setupStatus, hasSeenOnboarding] = await Promise.all([
        fetchSetupStatus(),
        (async () => {
          if (pb.authStore.isValid && user) {
            return api.hasUserSeenOnboarding();
          }
          return false;
        })(),
      ]);

      const { hasUsers, setupComplete } = setupStatus;

      const mode = getOnboardingMode({
        hasUsers,
        isAuthenticated: pb.authStore.isValid && !!user,
        hasUserSeenOnboarding: hasSeenOnboarding,
        setupComplete,
      });

      if (mode === 'admin') {
        setOnboardingMode('admin');
        setAppScreen('onboarding');
        return;
      }

      if (mode === 'user') {
        setOnboardingMode('user');
        setAppScreen('onboarding');
        return;
      }

      if (mode === 'info') {
        // First check for register route — invite links bypass info slides
        const path = window.location.pathname.toLowerCase();
        if (path === '/register') {
          setAppScreen('register');
          return;
        }
        setOnboardingMode(mode);
        setAppScreen('onboarding');
        return;
      }

      // mode === 'none'
      const path = window.location.pathname.toLowerCase();
      if (path === '/register') {
        setAppScreen('register');
        return;
      }

      if (!pb.authStore.isValid || !user) {
        setAppScreen('login');
        return;
      }

      setAppScreen('app');
    };

    void checkFirstRun();
    hasInitializedRef.current = true;
  }, [loading, user]);

  // Only show splash on cold start (first render before effect runs)
  if (appScreen === 'checking' && !hasInitializedRef.current) {
    return <SplashScreen />;
  }

  if (appScreen === 'onboarding') {
    return (
      <Onboarding
        mode={onboardingMode as 'admin' | 'user' | 'info'}
        onComplete={() => {
          localStorage.setItem(ONBOARDING_SEEN_KEY, getOnboardingSeenValueForUser((user as any)?.id ?? null));

          if (onboardingMode === 'info' || (onboardingMode === 'admin' && !pb.authStore.isValid)) {
            setAppScreen('login');
          } else {
            setAppScreen('app');
          }
        }}
      />
    );
  }

  if (appScreen === 'reset') {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    return <ResetPassword token={token} onDone={() => setAppScreen(pb.authStore.isValid ? 'app' : 'login')} />;
  }

  if (appScreen === 'register') {
    return <Register onRegister={() => { markDeviceOnboarded(); setAppScreen('app'); }} />;
  }

  if (appScreen === 'login') {
    return <Login onLogin={() => { markDeviceOnboarded(); setAppScreen('app'); }} onSwitchToRegister={() => setAppScreen('register')} />;
  }

  if (!pb.authStore.isValid) {
    return <Login onLogin={() => { markDeviceOnboarded(); setAppScreen('app'); }} onSwitchToRegister={() => setAppScreen('register')} />;
  }

  if (dataLoadState === 'loading') {
    return (
      <main className="app-shell-bg grid min-h-dvh place-items-center p-6" role="status" aria-live="polite">
        <div className="app-surface flex items-center gap-3 rounded-[var(--app-radius-xl)] px-5 py-4 text-[var(--app-text-muted)]">
          <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span>{t('common.loading', language)}</span>
        </div>
      </main>
    );
  }

  if (dataLoadState === 'error') {
    return (
      <main className="app-shell-bg grid min-h-dvh place-items-center p-6">
        <section className="app-surface w-full max-w-md rounded-[var(--app-radius-xl)] p-6 text-center" role="alert">
          <h1 className="text-xl font-bold text-[var(--app-text)]">{t('common.error', language)}</h1>
          <p className="mt-2 text-sm text-[var(--app-text-muted)]">{loadError || t('errors.unknown', language)}</p>
          <button
            type="button"
            onClick={() => void retryLoad()}
            className="mt-5 min-h-[var(--app-touch-target)] rounded-[var(--app-radius-xl)] bg-[var(--app-primary)] px-5 font-bold text-white"
          >
            {t('common.retry', language)}
          </button>
        </section>
      </main>
    );
  }

  const navItems: BottomNavItem[] = [
    { to: '/', label: t('nav.inbox', language), icon: <InboxIcon className="h-[22px] w-[22px]" />, activeColor: '#3b82f6', activeBg: '#eff6ff' },
    { to: '/tasks', label: t('nav.tasks', language), icon: <CheckSquare className="h-[22px] w-[22px]" />, activeColor: '#22c55e', activeBg: '#f0fdf4' },
    { to: '/calendar', label: t('nav.calendar', language), icon: <CalendarDays className="h-[22px] w-[22px]" />, activeColor: '#f97316', activeBg: '#fff7ed' },
    { to: '/groceries', label: t('nav.groceries', language), icon: <ShoppingCart className="h-[22px] w-[22px]" />, activeColor: '#ec4899', activeBg: '#fdf2f8' },
    { to: '/settings', label: t('nav.settings', language), icon: <SettingsIcon className="h-[22px] w-[22px]" />, activeColor: '#6366f1', activeBg: '#eef2ff' },
  ];

  const toast = completionMessage ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="app-surface px-4 py-2">
        <p className="text-sm text-[var(--app-text-muted)]">{completionMessage}</p>
      </div>
    </div>
  ) : null;

  return (
    <AppShell toast={toast} bottomNav={<BottomNavigation items={navItems} />}>
        <Suspense fallback={<div className="grid min-h-full place-items-center p-6 text-[var(--app-text-muted)]" role="status" aria-live="polite"><RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" /></div>}>
        <Routes>
          <Route path="/" element={<InboxBacklog />} />
          <Route path="/tasks" element={<TasksView />} />
          <Route path="/focus" element={<Navigate to="/tasks" replace />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/groceries" element={<GroceriesView />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/profile" element={<ProfileView />} />
          <Route path="/settings/preferences" element={<SettingsPreferences />} />
          <Route path="/settings/members" element={<MembersView />} />
          <Route path="/settings/labels" element={<LabelsView />} />
          <Route path="/settings/shops" element={<ShopsView />} />
          <Route path="/settings/notifications" element={<NotificationsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
