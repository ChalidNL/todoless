import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { Onboarding } from './components/Onboarding';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { InboxBacklog } from './components/InboxBacklog';
import { TasksView } from './components/TasksView';
import { GroceriesView } from './components/groceries/GroceriesView';
import { Notes } from './components/Notes';
import { Settings } from './components/Settings';
import { Calendar } from './components/Calendar';
import { Rewards } from './components/Rewards';
import { Dashboard } from './components/Dashboard';
import { ProjectsView } from './components/ProjectsView';
import { MobileHome } from './components/MobileHome';
import { TabletDashboard } from './components/TabletDashboard';
import { pb } from './lib/pocketbase';
import { api } from './lib/pocketbase-client';
import { Inbox as InboxIcon, CheckSquare, ShoppingCart, FileText, Settings as SettingsIcon, CalendarDays, RefreshCw, FolderOpen, LayoutDashboard } from 'lucide-react';
import { getOnboardingMode, OnboardingMode } from './lib/onboarding-gate';
import { fetchSetupStatus } from './lib/bootstrap-status';

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
            <h1 className="text-xl font-bold mb-2">App Error</h1>
            <p className="text-neutral-600 mb-6 text-sm">
              Something went wrong. Reset all data to continue.
            </p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Reset All Data & Restart
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
  const { completionMessage } = useApp();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkFirstRun = async () => {
      if (loading) return;

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

      if (mode === 'info') {
        setOnboardingMode('info');
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
        <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin" />
      </div>
    );
  }

  if (appScreen === 'onboarding') {
    return (
      <Onboarding
        mode={onboardingMode}
        onComplete={() => {
          localStorage.setItem(ONBOARDING_SEEN_KEY, getOnboardingSeenValueForUser((user as any)?.id ?? null));

          if (onboardingMode === 'info') {
            setAppScreen('login');
          } else {
            setAppScreen('app');
          }
        }}
      />
    );
  }

  if (appScreen === 'register') {
    return <Register onRegister={() => { setAppScreen('app'); navigate('/'); }} />;
  }

  if (appScreen === 'login') {
    return <Login onLogin={() => { setAppScreen('app'); navigate('/'); }} onSwitchToRegister={() => setAppScreen('register')} />;
  }

  if (!pb.authStore.isValid) {
    return <Login onLogin={() => { setAppScreen('app'); navigate('/'); }} onSwitchToRegister={() => setAppScreen('register')} />;
  }

  const navItems: { to: string; label: string; icon: React.ReactNode; mobileOnly?: boolean }[] = [
    { to: '/', label: 'Inbox', icon: <InboxIcon className="w-5 h-5" /> },
    { to: '/tasks', label: 'Tasks', icon: <CheckSquare className="w-5 h-5" /> },
    { to: '/calendar', label: 'Calendar', icon: <CalendarDays className="w-5 h-5" /> },
    { to: '/items', label: 'Groceries', icon: <ShoppingCart className="w-5 h-5" /> },
    { to: '/notes', label: 'Notes', icon: <FileText className="w-5 h-5" /> },
    { to: '/settings', label: 'Settings', icon: <SettingsIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <main>
        <Routes>
          <Route path="/home" element={<MobileHome />} />
          <Route path="/" element={<InboxBacklog />} />
          <Route path="/tasks" element={<TasksView />} />
          <Route path="/items" element={<GroceriesView />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tablet" element={<TabletDashboard />} />
          <Route path="/projects" element={<ProjectsView />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>

      {completionMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-white px-4 py-2 rounded-lg shadow-lg border border-neutral-200">
            <p className="text-sm text-neutral-600">{completionMessage}</p>
          </div>
        </div>
      )}

      <nav className={`fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-neutral-200 z-40 ${location.pathname === '/tablet' ? 'hidden' : ''}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        <div className="max-w-lg mx-auto flex justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-h-[48px] transition-all active:scale-95 ${
                  isActive
                    ? 'text-neutral-900'
                    : 'text-neutral-400 hover:text-neutral-600'
                }`
              }
            >
              {item.icon}
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
