import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { MembersView } from './components/MembersView';
import { LabelsView } from './components/LabelsView';
import { ShopsView } from './components/ShopsView';
import { ProfileView } from './components/ProfileView';
import { SettingsPreferences } from './components/SettingsPreferences';
import { NotificationsView } from './components/NotificationsView';
import { pb } from './lib/pocketbase';
import { api } from './lib/pocketbase-client';
import { Inbox as InboxIcon, ShoppingCart, Settings as SettingsIcon, RefreshCw, CalendarDays, CheckSquare } from 'lucide-react';
import { SplashScreen } from './components/shared/SplashScreen';
import { getOnboardingMode, OnboardingMode } from './lib/onboarding-gate';
import { fetchSetupStatus } from './lib/bootstrap-status';
import { t } from './i18n/translations';
import { AppShell } from './components/layout/AppShell';
import { BottomNavigation, type BottomNavItem } from './components/layout/BottomNavigation';

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
  const hasInitializedRef = useRef(false);
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

      const onboardingSeenValue = localStorage.getItem(ONBOARDING_SEEN_KEY);
      const expectedOnboardingSeenValue = getOnboardingSeenValueForUser((user as any)?.id ?? null);
      const hasCompletedOnboarding =
        onboardingSeenValue === expectedOnboardingSeenValue ||
        (onboardingSeenValue === 'true' && !user);

      // Fast path: if localStorage says onboarding already done, skip all APi checks
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

  const navItems: BottomNavItem[] = [
    { to: '/', label: 'Inbox', icon: <InboxIcon className="h-[22px] w-[22px]" />, activeColor: '#3b82f6', activeBg: '#eff6ff' },
    { to: '/tasks', label: 'Taken', icon: <CheckSquare className="h-[22px] w-[22px]" />, activeColor: '#22c55e', activeBg: '#f0fdf4' },
    { to: '/calendar', label: 'Agenda', icon: <CalendarDays className="h-[22px] w-[22px]" />, activeColor: '#f97316', activeBg: '#fff7ed' },
    { to: '/groceries', label: 'Shop', icon: <ShoppingCart className="h-[22px] w-[22px]" />, activeColor: '#ec4899', activeBg: '#fdf2f8' },
    { to: '/settings', label: 'Instellingen', icon: <SettingsIcon className="h-[22px] w-[22px]" />, activeColor: '#6366f1', activeBg: '#eef2ff' },
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
