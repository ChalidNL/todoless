import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { Onboarding } from './components/Onboarding';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { InboxBacklog } from './components/InboxBacklog';
import { TasksView } from './components/TasksView';
import { CalendarView } from './components/calendar/CalendarView';
import { GroceriesView } from './components/groceries/GroceriesView';
import { Settings } from './components/Settings';
import { pb } from './lib/pocketbase';
import { api } from './lib/pocketbase-client';
import { Inbox as InboxIcon, ShoppingCart, Settings as SettingsIcon, RefreshCw, CalendarDays } from 'lucide-react';
import { AppMark } from './components/shared/AppLogo';
import { getOnboardingMode, OnboardingMode } from './lib/onboarding-gate';
import { fetchSetupStatus } from './lib/bootstrap-status';
import { t } from './i18n/translations';

const ONBOARDING_SEEN_KEY = 'todoless_onboarding_completed';

const getOnboardingSeenValueForUser = (userId?: string | null) =>
  userId ? `user:${userId}` : 'anon';

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
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold mb-2">{t('auth.appError')}</h1>
            <p className="text-neutral-600 mb-6 text-sm">
              {t('auth.appErrorDescription')}
            </p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              {t('auth.resetAllData')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const [appScreen, setAppScreen] = useState<'checking' | 'onboarding' | 'login' | 'register' | 'app'>('checking');
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>('none');
  const { completionMessage, tasks, items } = useApp();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();

  useEffect(() => {
    const checkFirstRun = async () => {
      if (loading) return;

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

      // Force onboarding as completed — disable onboarding flow
      localStorage.setItem(ONBOARDING_SEEN_KEY, getOnboardingSeenValueForUser((user as any)?.id ?? null));

      const onboardingSeenValue = localStorage.getItem(ONBOARDING_SEEN_KEY);
      const expectedOnboardingSeenValue = getOnboardingSeenValueForUser((user as any)?.id ?? null);
      const hasCompletedOnboarding =
        onboardingSeenValue === expectedOnboardingSeenValue ||
        (onboardingSeenValue === 'true' && !user);

      if (onboardingSeenValue && !hasCompletedOnboarding) {
        localStorage.removeItem(ONBOARDING_SEEN_KEY);
      }

      // Fast path: if localStorage says onboarding already done, skip all checks
      if (hasCompletedOnboarding) {
        const path = window.location.pathname.toLowerCase();
        if (path === '/register') {
          setAppScreen('register');
        } else if (!pb.authStore.isValid || !user) {
          setAppScreen('login');
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

      if (mode === 'info' || mode === 'admin') {
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
  }, [loading, user]);

  if (appScreen === 'checking') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-neutral-200">
          <AppMark className="w-8 h-8 text-neutral-900 animate-pulse" />
        </div>
      </div>
    );
  }

  if (appScreen === 'onboarding') {
    return (
      <Onboarding
        mode={onboardingMode as 'admin' | 'user' | 'info'}
        onComplete={() => {
          localStorage.setItem(ONBOARDING_SEEN_KEY, getOnboardingSeenValueForUser((user as any)?.id ?? null));

          if (onboardingMode === 'info' || onboardingMode === 'admin') {
            setAppScreen('login');
          } else {
            setAppScreen('app');
          }
        }}
      />
    );
  }

  if (appScreen === 'register') {
    return <Register onRegister={() => { setAppScreen('app'); }} />;
  }

  if (appScreen === 'login') {
    return <Login onLogin={() => { setAppScreen('app'); }} onSwitchToRegister={() => setAppScreen('register')} />;
  }

  if (!pb.authStore.isValid) {
    return <Login onLogin={() => { setAppScreen('app'); }} onSwitchToRegister={() => setAppScreen('register')} />;
  }

  const navItems: { to: string; label: string; icon: React.ReactNode }[] = [
    { to: '/', label: t('common.inbox', language), icon: <InboxIcon className="w-5 h-5" /> },
    { to: '/tasks', label: t('common.tasks', language), icon: <AppMark className="w-5 h-5" /> },
    { to: '/calendar', label: t('common.calendar', language), icon: <CalendarDays className="w-5 h-5" /> },
    { to: '/groceries', label: t('common.groceries', language), icon: <ShoppingCart className="w-5 h-5" /> },
    { to: '/settings', label: t('common.settings', language), icon: <SettingsIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-50">
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Routes>
          <Route path="/" element={<InboxBacklog />} />
          <Route path="/tasks" element={<TasksView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/groceries" element={<GroceriesView />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {completionMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-white px-4 py-2 rounded-lg shadow-lg border border-neutral-200">
            <p className="text-sm text-neutral-600">{completionMessage}</p>
          </div>
        </div>
      )}

      <nav className="flex-shrink-0 bg-white border-t border-neutral-200 z-40"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)' }}
      >
        <div className="max-w-xl mx-auto flex justify-around items-center">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0 py-1.5 px-3 min-h-[52px] transition-all active:scale-95 ${
                  isActive
                    ? 'text-neutral-900'
                    : 'text-neutral-400 hover:text-neutral-600'
                }`
              }
            >
              <div className="relative">
                {item.icon}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
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
