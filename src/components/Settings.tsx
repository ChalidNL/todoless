import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';
import { userDisplayName } from '../types';
import { t } from '../i18n/translations';
import { Link } from 'react-router-dom';
import { ChevronRight, LogOut, Copy, RefreshCw, ExternalLink, Camera, Users, UserCircle2, Tag, SlidersHorizontal, Bell, Store, BookOpen } from 'lucide-react';
import { AppHeader } from './shared/NewGlobalHeader';
import { Button } from './ui/AppButton';

import { fetchLatestAppVersion, forceRefreshApp, getNormalizedAppVersion, shouldShowUpdateButton } from '../lib/app-update';
import { copyTextToClipboard } from '../lib/clipboard';
import { resolveDocsUrl } from '../lib/docs-url';

// Version polling: check on mount and on focus/visibility only, throttled to at most
// once per VERSION_CHECK_MIN_INTERVAL_MS instead of a fixed 60s background poll (GH#78).
const VERSION_CHECK_MIN_INTERVAL_MS = 5 * 60_000;

export const Settings = () => {
  const { users, appSettings, labels, shops, showCompletionMessage } = useApp();
  const { signOut } = useAuth();
  const appVersion = __APP_VERSION__;
  const appCommitRaw = __APP_COMMIT__;
  const appBuildId = __APP_BUILD_ID__;
  const appCommit = appCommitRaw === 'local' ? 'local' : appCommitRaw.slice(0, 7);
  const currentAppVersion = useMemo(() => getNormalizedAppVersion({ version: appVersion, commit: appCommitRaw, buildId: appBuildId }), [appBuildId, appCommitRaw, appVersion]);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);

  const currentUser = users.find(u => u.id === appSettings.currentUserId);

  const lastVersionCheckRef = useRef(0);

  const checkForAppUpdate = useCallback(async () => {
    const latestAppVersion = await fetchLatestAppVersion();
    setUpdateAvailable(shouldShowUpdateButton(currentAppVersion, latestAppVersion));
  }, [currentAppVersion]);

  useEffect(() => {
    const checkVersionIfStale = () => {
      const now = Date.now();
      if (now - lastVersionCheckRef.current < VERSION_CHECK_MIN_INTERVAL_MS) return;
      lastVersionCheckRef.current = now;
      void checkForAppUpdate();
    };

    checkVersionIfStale();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkVersionIfStale();
      }
    };

    const handleFocus = () => {
      checkVersionIfStale();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkForAppUpdate]);

  const handleLogout = () => {
    signOut();
    window.location.reload();
  };

  const handleCopyAppInfo = async () => {
    const payload = `App Info\nVersion: ${appVersion}\nCommit: ${appCommit}`;

    const ok = await copyTextToClipboard(payload);
    showCompletionMessage(ok ? t('common.copied') : t('settings.copyFailed'));
  };

  const handleUpdateApp = async () => {
    try {
      setUpdatingApp(true);
      await forceRefreshApp();
    } catch {
      setUpdatingApp(false);
      showCompletionMessage(t('common.error'));
    }
  };


  if (!currentUser) {
    return (
      <div className="app-shell-bg min-h-screen flex items-center justify-center">
        <p className="text-neutral-600">{t('common.noData')}</p>
      </div>
    );
  }

  const displayName = userDisplayName(currentUser);
  const initials = `${currentUser.firstName?.[0] || ''}${currentUser.lastName?.[0] || ''}`.toUpperCase() || displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CT';
  const docsUrl = resolveDocsUrl(import.meta.env.VITE_DOCS_URL);
  const settingsItems = [
    { href: '/settings/profile', icon: UserCircle2, color: '#8b5cf6', label: t('settings.yourProfile'), sub: currentUser.email },
    { href: '/settings/members', icon: Users, color: '#06b6d4', label: t('members.title'), sub: `${users.length} ${t('members.title')}` },
    { href: '/settings/labels', icon: Tag, color: '#eab308', label: t('settings.labels'), sub: `${labels.length} ${t('settings.labels')}` },
    { href: '/settings/shops', icon: Store, color: '#ec4899', label: t('settings.shops'), sub: `${shops.length} ${t('settings.shops')}` },
    { href: '/settings/preferences', icon: SlidersHorizontal, color: '#f97316', label: t('settings.preferences'), sub: t('settings.firstDayOfWeek') },
    { href: '/settings/notifications', icon: Bell, color: '#22c55e', label: t('settings.notifications'), sub: null },
    { href: docsUrl, icon: BookOpen, color: '#0ea5e9', label: t('settings.documentation'), sub: t('settings.apiDocumentation'), external: true },
  ];

  return (
    <>
      <AppHeader screen="instellingen" showSearch={false} showFilters={false} showAdd={false} />

      <div className="mx-auto max-w-2xl pb-6 pt-3">
        <Link to="/settings/profile" className="relative mx-4 mb-3 flex flex-col items-center gap-3 overflow-hidden rounded-[28px] px-6 py-8 text-center shadow-[0_16px_40px_rgba(99,102,241,0.28)] active:scale-[0.99]" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)' }}>
          <span className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
          <span className="relative grid h-[84px] w-[84px] place-items-center rounded-full border-[3px] border-white/60 bg-white/25 text-[32px] font-black text-white shadow-lg">
            {initials}
            <span className="absolute bottom-0 right-0 grid h-[26px] w-[26px] place-items-center rounded-full bg-white text-indigo-600 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
              <Camera className="h-[13px] w-[13px]" strokeWidth={2.5} />
            </span>
          </span>
          <span className="relative text-center text-white">
            <span className="block text-xl font-black tracking-[-0.01em]">{displayName}</span>
            <span className="mt-1 block text-sm font-semibold text-white/80">{currentUser.email}</span>
          </span>
        </Link>

        <div className="mx-4 mb-3 overflow-hidden rounded-[var(--app-radius-card)] bg-[var(--app-surface)] shadow-[var(--app-shadow-card)]">
          {settingsItems.map((item, index) => {
            const Icon = item.icon;
            const itemClassName = "flex min-h-[64px] items-center gap-3 px-4 py-3 text-left active:scale-[0.99]";
            const borderStyle = { borderBottom: index < settingsItems.length - 1 ? '1px solid var(--app-border-subtle)' : 'none' };
            const inner = (
              <>
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[var(--app-radius-md)]" style={{ background: `${item.color}15`, color: item.color }}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-[var(--app-text)]">{item.label}</span>
                  {item.sub && <span className="mt-0.5 block truncate text-xs font-medium text-[var(--app-text-muted)]">{item.sub}</span>}
                </span>
                {item.external ? <ExternalLink className="h-[15px] w-[15px] text-[var(--app-text-soft)]" /> : <ChevronRight className="h-[15px] w-[15px] text-[var(--app-text-soft)]" />}
              </>
            );
            if (item.external) {
              return (
                <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className={itemClassName} style={borderStyle}>
                  {inner}
                </a>
              );
            }
            return (
              <Link key={item.href} to={item.href} className={itemClassName} style={borderStyle}>
                {inner}
              </Link>
            );
          })}
        </div>

        <div className="mx-4 mb-3 rounded-[var(--app-radius-card)] bg-[var(--app-surface)] px-4 py-3 shadow-[var(--app-shadow-card)]" data-testid="app-info">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 text-sm font-semibold text-[var(--app-text-muted)]">{t('settings.appInfo')}</div>
              <div className="truncate text-xs font-medium text-[var(--app-text-soft)]">{t('settings.version')}: {appVersion} · {appCommit}</div>
            </div>
            <button onClick={handleCopyAppInfo} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[var(--app-border-subtle)] bg-[var(--app-bg)] px-3 text-xs font-semibold text-[var(--app-text-muted)]" aria-label={t('settings.copyAppInfo')}>
              <Copy className="h-3 w-3" /> {t('settings.copyAppInfo')}
            </button>
          </div>
          {updateAvailable && (
            <button onClick={handleUpdateApp} disabled={updatingApp} className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--app-primary-soft)] px-3 text-xs font-bold text-[var(--app-primary)] disabled:opacity-60">
              <RefreshCw className={`h-3 w-3 ${updatingApp ? 'animate-spin' : ''}`} />
              {updatingApp ? t('common.loading') : t('settings.update')}
            </button>
          )}
        </div>

        <div className="mx-4 mb-8">
          <Button label={t('settings.logOut')} icon={LogOut} onClick={handleLogout} variant="destructive" />
        </div>
      </div>
    </>
  );
};