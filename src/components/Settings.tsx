import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';
import { ApiToken, userDisplayName, Agent, type Label, type LabelVisibility } from '../types';
import { t, type SupportedUiLanguage, SUPPORTED_UI_LANGUAGES } from '../i18n/translations';
import { changeAppLanguage } from '../i18n';
import { ChevronDown, ChevronUp, ChevronRight, Plus, Edit2, Trash2, X, LogOut, Eye, EyeOff, Copy, Check, Lock, ExternalLink, Plug, Bot, RefreshCw, Shield, Users, Home, User, UserCircle2, Tag, Sliders, Bell, ShoppingCart, Camera } from 'lucide-react';
import { AppHeader } from './shared/NewGlobalHeader';
import { AttributeChip } from './shared/AttributeChip';
import { getMemberDisplayName, getMemberInitials, canChangeMemberRole, isOnlyAdmin, isSystemAdminRole } from '../lib/member-role-utils';
import { buildFamilyMembershipView } from '../lib/member-family-utils';
import { entityBg, entityBorder, entityColor } from '../lib/entity-colors';
import { InviteManager } from './InviteManager';
import { api } from '../lib/pocketbase-client';
import { pb } from '../lib/pocketbase';
import { fetchLatestAppVersion, forceRefreshApp, getNormalizedAppVersion, shouldShowUpdateButton } from '../lib/app-update';
import { CalendarImportExport } from './CalendarImportExport';
import { sortLabelsByVisibility } from '../lib/label-utils';

function SettingsNavItem({ href, icon, title, subtitle, external }: { href: string; icon: React.ReactNode; title: string; subtitle: string; external?: boolean }) {
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className="flex min-h-[var(--app-touch-target)] items-center gap-3 rounded-[20px] px-3 py-3 transition hover:bg-[var(--app-surface-2)] active:scale-[0.97]">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--app-primary-soft)] text-[var(--app-primary)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-[var(--app-text)]">{title}</span>
        <span className="block truncate text-xs font-semibold text-[var(--app-text-muted)]">{subtitle}</span>
      </span>
      {external ? <ExternalLink className="h-5 w-5 text-[var(--app-text-soft)]" /> : <ChevronRight className="h-5 w-5 text-[var(--app-text-soft)]" />}
    </a>
  );
}

export const Settings = () => {
  const { users, appSettings, updateAppSettings, updateUser, deleteUser, labels, addLabel, updateLabel, deleteLabel, shops, addShop, updateShop, deleteShop, tasks, filters, deleteFilter, showCompletionMessage } = useApp();
  const { signOut } = useAuth();
  const appVersion = __APP_VERSION__;
  const appCommitRaw = __APP_COMMIT__;
  const appBuildId = __APP_BUILD_ID__;
  const appCommit = appCommitRaw === 'local' ? 'local' : appCommitRaw.slice(0, 7);
  const currentAppVersion = useMemo(() => getNormalizedAppVersion({ version: appVersion, commit: appCommitRaw, buildId: appBuildId }), [appBuildId, appCommitRaw, appVersion]);
  const [editingPassword, setEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [showAccount, setShowAccount] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showShops, setShowShops] = useState(false);
  const [showTeamMembers, setShowTeamMembers] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');
  const [newLabelVisibility, setNewLabelVisibility] = useState<LabelVisibility>('family');
  const [newLabelSharedWith, setNewLabelSharedWith] = useState<string[]>([]);
  const [newShopName, setNewShopName] = useState('');
  const [newShopColor, setNewShopColor] = useState('#3b82f6');
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState('');
  const [editingLabelColor, setEditingLabelColor] = useState('');
  const [editingLabelPrivate, setEditingLabelPrivate] = useState(false);
  const [editingLabelVisibility, setEditingLabelVisibility] = useState<LabelVisibility>('family');
  const [editingLabelSharedWith, setEditingLabelSharedWith] = useState<string[]>([]);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [editingShopName, setEditingShopName] = useState('');
  const [editingShopColor, setEditingShopColor] = useState('');
  const [showAddLabelModal, setShowAddLabelModal] = useState(false);
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editLanguage, setEditLanguage] = useState<SupportedUiLanguage>('en');
  const [showAgentApproval, setShowAgentApproval] = useState(false);
  const [pendingAgents, setPendingAgents] = useState<{id: string; email: string; name: string; created: string}[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [approvingAgentId, setApprovingAgentId] = useState<string | null>(null);
  const [rejectingAgentId, setRejectingAgentId] = useState<string | null>(null);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [pendingAgentsCount, setPendingAgentsCount] = useState(0);
  const [approvedAgentsCount, setApprovedAgentsCount] = useState(0);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [familyName, setFamilyName] = useState<string | undefined>(undefined);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Full Agents management
  const [showAgents, setShowAgents] = useState(false);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [loadingAllAgents, setLoadingAllAgents] = useState(false);
  const [revokingAgentId, setRevokingAgentId] = useState<string | null>(null);

  const currentUser = users.find(u => u.id === appSettings.currentUserId);
  const getLanguageLabel = (lang: SupportedUiLanguage) => ({ nl: 'Nederlands', fr: 'Français', en: 'English', de: 'Deutsch', es: 'Español' })[lang];
  const weekDays = [
    { value: 0, label: t('settings.sunday') },
    { value: 1, label: t('settings.monday') },
    { value: 2, label: t('settings.tuesday') },
    { value: 3, label: t('settings.wednesday') },
    { value: 4, label: t('settings.thursday') },
    { value: 5, label: t('settings.friday') },
    { value: 6, label: t('settings.saturday') },
  ] as const;
  const canManageMembers = currentUser?.role === 'admin' || currentUser?.role === 'owner';
  const humanFamilyMembers = users.filter((user) => user.id !== currentUser?.id && (user.member_type || 'human') === 'human');
  const labelVisibilityOptions: Array<{ value: LabelVisibility; label: string; description: string; icon: React.ElementType }> = [
    { value: 'family', label: t('labels.visibilityFamily'), description: t('labels.visibilityFamilyDescription'), icon: Home },
    { value: 'shared', label: t('labels.visibilityShared'), description: t('labels.visibilitySharedDescription'), icon: Users },
    { value: 'private', label: t('labels.visibilityPrivate'), description: t('labels.visibilityPrivateDescription'), icon: Lock },
  ];
  const getVisibilityLabel = (visibility?: LabelVisibility) => labelVisibilityOptions.find((option) => option.value === (visibility || 'family'))?.label || t('labels.visibilityFamily');
  const sortedLabels = useMemo(() => sortLabelsByVisibility(labels), [labels]);
  const VisibilityIcon = ({ visibility, className = 'w-3.5 h-3.5' }: { visibility?: LabelVisibility; className?: string }) => {
    const Icon = labelVisibilityOptions.find((option) => option.value === (visibility || 'family'))?.icon || Home;
    return <Icon className={className} />;
  };
  const familyMembershipView = useMemo(
    () => buildFamilyMembershipView(users, currentUser?.family_id, familyName),
    [currentUser?.family_id, familyName, users]
  );

  const checkForAppUpdate = useCallback(async () => {
    const latestAppVersion = await fetchLatestAppVersion();
    setUpdateAvailable(shouldShowUpdateButton(currentAppVersion, latestAppVersion));
  }, [currentAppVersion]);

  useEffect(() => {
    void checkForAppUpdate();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void checkForAppUpdate();
      }
    };

    const handleFocus = () => {
      void checkForAppUpdate();
    };

    const intervalId = window.setInterval(() => {
      void checkForAppUpdate();
    }, 60000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkForAppUpdate]);

  useEffect(() => {
    let cancelled = false;

    const loadFamilyName = async () => {
      if (!currentUser?.family_id) {
        setFamilyName(undefined);
        return;
      }

      try {
        const family = await api.getFamilyById(currentUser.family_id);
        if (!cancelled) {
          setFamilyName(family.name);
        }
      } catch {
        if (!cancelled) {
          setFamilyName(undefined);
        }
      }
    };

    void loadFamilyName();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.family_id]);

  const handlePasswordChange = async () => {
    setPasswordError('');
    if (!currentUser || !currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('settings.passwordRequired'));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t('settings.passwordMinLength').replace('{n}', '6'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.passwordMismatch'));
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError(t('settings.passwordSame'));
      return;
    }
    // Verify current password by attempting to re-authenticate
    try {
      await api.login(currentUser.email, currentPassword);
    } catch {
      setPasswordError(t('settings.currentPasswordIncorrect'));
      return;
    }
    // Update password via SDK
    const success = await updateUser(currentUser.id, {
      password: newPassword,
      passwordConfirm: newPassword,
    } as Partial<User>);
    if (success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setEditingPassword(false);
      setShowPassword(false);
      showCompletionMessage(t('settings.passwordUpdated'));
    } else {
      setPasswordError(t('common.error'));
    }
  };

  const handleProfileEdit = () => {
    if (!currentUser) return;
    setEditFirstName(currentUser.firstName || '');
    setEditLastName(currentUser.lastName || '');
    setEditLanguage(currentUser.language || 'en');
    setEditingProfile(true);
  };

  const handleProfileSave = async () => {
    if (!currentUser) return;
    setProfileError('');
    if (!editFirstName.trim() && !editLastName.trim()) {
      setProfileError(t('common.error'));
      return;
    }
    const fullName = [editFirstName.trim(), editLastName.trim()].filter(Boolean).join(' ');
    const success = await updateUser(currentUser.id, {
      name: fullName || currentUser.name,
      firstName: editFirstName.trim() || undefined,
      lastName: editLastName.trim() || undefined,
      language: editLanguage,
    } as Partial<User>);
    if (success) {
      await changeAppLanguage(editLanguage);
      setEditingProfile(false);
      showCompletionMessage(t('settings.updated'));
    } else {
      setProfileError(t('settings.profileSaveFailed'));
    }
  };

  const handleCancelProfileEdit = () => {
    setEditingProfile(false);
  };

  const handleRoleChange = async (userId: string, role: 'admin' | 'member') => {
    const success = await updateUser(userId, { role });
    if (success) {
      showCompletionMessage(role === 'admin' ? t('settings.adminUpdated') : t('settings.memberUpdated'));
    }
  };

  const handleToggleMemberActive = async (user: User) => {
    if (!canManageMembers) return;
    const nextActive = !(user.active ?? true);
    await updateUser(user.id, {
      active: nextActive,
      member_status: nextActive ? 'active' : 'blocked',
    } as Partial<User>);
  };

  const handleDeleteMember = async (user: User) => {
    if (!canManageMembers) return;
    if (!window.confirm(t('settings.deleteMemberConfirm'))) return;
    await deleteUser(user.id);
  };

  const handleLogout = () => {
    signOut();
    window.location.reload();
  };

  const handleCopyAppInfo = async () => {
    const payload = `App Info\nVersion: ${appVersion}\nCommit: ${appCommit}`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(payload);
        showCompletionMessage(t('common.copied'));
        return;
      }

      const textarea = document.createElement('textarea');
      textarea.value = payload;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();

      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (ok) {
        showCompletionMessage(t('common.copied'));
      } else {
        showCompletionMessage(t('settings.copyFailed'));
      }
    } catch {
      showCompletionMessage(t('settings.copyFailed'));
    }
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

  const generateRandomColor = () => {
    const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const openAddLabelModal = () => {
    setNewLabelColor(generateRandomColor());
    setNewLabelName('');
    setNewLabelVisibility('family');
    setNewLabelSharedWith([]);
    setShowAddLabelModal(true);
  };

  const openAddShopModal = () => {
    setNewShopColor(generateRandomColor());
    setNewShopName('');
    setShowAddShopModal(true);
  };

  const handleAddLabel = () => {
    if (!newLabelName) return;
    addLabel({
      name: newLabelName,
      color: newLabelColor,
      visibility: newLabelVisibility,
      isPrivate: newLabelVisibility === 'private',
      sharedWith: newLabelVisibility === 'shared' ? newLabelSharedWith : [],
    });
    setNewLabelName('');
    setNewLabelColor('#3b82f6');
    setNewLabelVisibility('family');
    setNewLabelSharedWith([]);
    setShowAddLabelModal(false);
  };

  const handleEditLabel = () => {
    if (!editingLabelId || !editingLabelName) return;
    updateLabel(editingLabelId, {
      name: editingLabelName,
      color: editingLabelColor,
      visibility: editingLabelVisibility,
      isPrivate: editingLabelVisibility === 'private',
      sharedWith: editingLabelVisibility === 'shared' ? editingLabelSharedWith : [],
    });
    setEditingLabelId(null);
    setEditingLabelName('');
    setEditingLabelColor('');
    setEditingLabelPrivate(false);
    setEditingLabelVisibility('family');
    setEditingLabelSharedWith([]);
    setShowLabels(false);
  };

  const startEditingLabel = (label: Label) => {
    setEditingLabelId(label.id);
    setEditingLabelName(label.name);
    setEditingLabelColor(label.color);
    setEditingLabelPrivate(label.isPrivate || false);
    setEditingLabelVisibility(label.visibility || (label.isPrivate ? 'private' : 'family'));
    setEditingLabelSharedWith(label.sharedWith || []);
  };

  const handleDeleteLabel = (id: string) => {
    deleteLabel(id);
  };

  const handleAddShop = () => {
    if (!newShopName) return;
    addShop({ name: newShopName, color: newShopColor });
    setNewShopName('');
    setNewShopColor('#3b82f6');
    setShowAddShopModal(false);
  };

  const handleEditShop = () => {
    if (!editingShopId || !editingShopName) return;
    updateShop(editingShopId, { name: editingShopName, color: editingShopColor });
    setEditingShopId(null);
    setEditingShopName('');
    setEditingShopColor('');
    setShowShops(false);
  };

  const handleDeleteShop = (id: string) => {
    deleteShop(id);
  };

  const loadApiTokens = async () => {
    const tokens = await api.getApiTokens();
    setApiTokens(tokens);
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!window.confirm(t('settings.revokeTokenConfirm'))) return;
    try {
      await api.deleteApiToken(tokenId);
      await loadApiTokens();
      showCompletionMessage(t('agent.tokenRevoked'));
    } catch (err: any) {
      showCompletionMessage(err.message || t('common.error'));
    }
  };

  const handleToggleToken = async (tokenId: string, enabled: boolean) => {
    try {
      await api.toggleApiToken(tokenId, enabled);
      await loadApiTokens();
    } catch (err: any) {
      showCompletionMessage(err.message || t('common.error'));
    }
  };

  const loadPendingAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await fetch('/api/agent/pending', {
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingAgents(data.agents || []);
      }
    } catch {
      showCompletionMessage(t('common.error'));
    } finally {
      setLoadingAgents(false);
    }
  };

  const toggleAgentApprovalSection = async () => {
    const next = !showAgentApproval;
    setShowAgentApproval(next);
    if (next && pendingAgents.length === 0) {
      await loadPendingAgents();
    }
  };

  const handleApproveAgent = async (agentId: string) => {
    setApprovingAgentId(agentId);
    try {
      const response = await fetch(`/api/agent/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
        body: JSON.stringify({ id: agentId }),
      });
      const data = await response.json();
      if (response.ok) {
        setPendingAgents(prev => prev.filter(a => a.id !== agentId));
        showCompletionMessage(t('agent.approved'));
      } else {
        showCompletionMessage(data.error || t('common.error'));
      }
    } catch {
      showCompletionMessage(t('common.error'));
    } finally {
      setApprovingAgentId(null);
    }
  };

  const handleRejectAgent = async (agentId: string) => {
    if (!window.confirm(t('settings.rejectAgentConfirm'))) return;
    setRejectingAgentId(agentId);
    try {
      const response = await fetch(`/api/agent/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
        body: JSON.stringify({ id: agentId }),
      });
      if (response.ok) {
        setPendingAgents(prev => prev.filter(a => a.id !== agentId));
        showCompletionMessage(t('agent.rejected'));
      } else {
        const data = await response.json();
        showCompletionMessage(data.error || t('common.error'));
      }
    } catch {
      showCompletionMessage(t('common.error'));
    } finally {
      setRejectingAgentId(null);
    }
  };

  const loadAgentCounts = async () => {
    try {
      const response = await fetch('/api/agent/counts', {
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingAgentsCount(data.pending || 0);
        setApprovedAgentsCount(data.approved || 0);
      }
    } catch {
      // Silently fail
    }
  };

  const toggleIntegrationsSection = async () => {
    const next = !showIntegrations;
    setShowIntegrations(next);
    if (next) {
      await loadAgentCounts();
    }
  };

  // Full Agents management functions
  const loadAllAgents = async () => {
    setLoadingAllAgents(true);
    try {
      const response = await fetch('/api/agent/list', {
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAllAgents(data.agents || []);
      } else {
        showCompletionMessage(t('common.error'));
      }
    } catch {
      showCompletionMessage(t('common.error'));
    } finally {
      setLoadingAllAgents(false);
    }
  };

  const toggleAgentsSection = async () => {
    const next = !showAgents;
    setShowAgents(next);
    if (next && allAgents.length === 0) {
      await loadAllAgents();
    }
  };

  const handleRevokeAgent = async (agentId: string) => {
    if (!window.confirm(t('agent.revokeConfirm'))) return;
    setRevokingAgentId(agentId);
    try {
      const response = await fetch(`/api/agent/${agentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      if (response.ok) {
        setAllAgents(prev => prev.filter(a => a.id !== agentId));
        showCompletionMessage(t('agent.tokenRevoked'));
      } else {
        const data = await response.json();
        showCompletionMessage(data.error || t('common.error'));
      }
    } catch {
      showCompletionMessage(t('common.error'));
    } finally {
      setRevokingAgentId(null);
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
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
  const settingsItems = [
    { href: '/settings/profile', icon: UserCircle2, color: '#8b5cf6', label: t('settings.yourProfile'), sub: currentUser.email },
    { href: '/settings/members', icon: Users, color: '#06b6d4', label: t('settings.teamMembers'), sub: `${users.length} ${t('members.title').toLowerCase()}` },
    { href: '/settings/labels', icon: Tag, color: '#eab308', label: t('settings.labels'), sub: `${labels.length} labels` },
    { href: '/settings/shops', icon: ShoppingCart, color: '#ec4899', label: 'Winkels', sub: `${shops.length} winkels` },
    { href: '/settings/preferences', icon: Sliders, color: '#f97316', label: t('settings.preferences'), sub: t('settings.firstDayOfWeek') },
    { href: '/settings/notifications', icon: Bell, color: '#22c55e', label: 'Notificaties', sub: null },
    { href: '/api/swagger', icon: Plug, color: '#0ea5e9', label: t('settings.integration'), sub: t('settings.apiDocumentation'), external: true },
  ];

  return (
    <>
      <AppHeader screen="instellingen" showSearch={false} showFilters={false} showAdd={false} count={users.length} />

      <div className="mx-auto max-w-2xl pb-24 pt-3">
        <a href="/settings/profile" className="relative mx-4 mb-3 flex flex-col items-center gap-3 overflow-hidden rounded-[28px] px-6 py-8 text-center shadow-[0_16px_40px_rgba(99,102,241,0.28)] active:scale-[0.99]" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)' }}>
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
        </a>

        <div className="mx-4 mb-3 overflow-hidden rounded-[var(--app-radius-card)] bg-[var(--app-surface)] shadow-[var(--app-shadow-card)]">
          {settingsItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className="flex min-h-[64px] items-center gap-3 px-4 py-3 text-left active:scale-[0.99]"
                style={{ borderBottom: index < settingsItems.length - 1 ? '1px solid var(--app-border-subtle)' : 'none' }}
              >
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[var(--app-radius-md)]" style={{ background: `${item.color}15`, color: item.color }}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-[var(--app-text)]">{item.label}</span>
                  {item.sub && <span className="mt-0.5 block truncate text-xs font-medium text-[var(--app-text-muted)]">{item.sub}</span>}
                </span>
                {item.external ? <ExternalLink className="h-[15px] w-[15px] text-[var(--app-text-soft)]" /> : <ChevronRight className="h-[15px] w-[15px] text-[var(--app-text-soft)]" />}
              </a>
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

        <button onClick={handleLogout} className="mx-4 mb-8 flex min-h-[54px] w-[calc(100%-32px)] items-center justify-center gap-2.5 rounded-[var(--app-radius-xl)] border-[1.5px] border-red-200 bg-white px-4 text-base font-semibold text-red-500 shadow-[0_2px_8px_rgba(239,68,68,0.12)] active:scale-[0.97]">
          <LogOut className="h-[18px] w-[18px]" />
          {t('settings.logOut')}
        </button>
      </div>

      {/* Add Label Modal */}
      {showAddLabelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">{t('settings.addLabelTitle')}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('settings.name')}</label>
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder={t('settings.labelNamePlaceholder')}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('settings.color')}</label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-md border border-neutral-300 cursor-pointer flex-shrink-0"
                    style={{ backgroundColor: newLabelColor }}
                    onClick={() => {
                      const input = document.getElementById('label-color-input') as HTMLInputElement;
                      input?.click();
                    }}
                  />
                  <input
                    id="label-color-input"
                    type="color"
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                    className="sr-only"
                  />
                  <input
                    type="text"
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1 px-3 py-2 border border-neutral-200 rounded font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-neutral-200 p-3">
                <p className="text-sm font-medium text-neutral-700">Zichtbaarheid</p>
                {labelVisibilityOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <label key={option.value} className="flex items-start gap-3 rounded-lg p-2 hover:bg-neutral-50">
                      <input type="radio" name="new-label-visibility" value={option.value} checked={newLabelVisibility === option.value} onChange={() => setNewLabelVisibility(option.value)} className="mt-1" />
                      <Icon className="mt-0.5 h-4 w-4 text-neutral-600" />
                      <span><span className="block text-sm font-medium text-neutral-800">{option.label}</span><span className="block text-xs text-neutral-500">{option.description}</span></span>
                    </label>
                  );
                })}
                {newLabelVisibility === 'shared' && (
                  <div className="space-y-2 border-t border-neutral-100 pt-3">
                    <p className="text-xs font-medium text-neutral-500">{t('labels.sharedMembers')}</p>
                    {humanFamilyMembers.map((member) => (
                      <label key={member.id} className="flex items-center gap-2 text-sm text-neutral-700">
                        <input type="checkbox" checked={newLabelSharedWith.includes(member.id)} onChange={(e) => setNewLabelSharedWith(prev => e.target.checked ? [...prev, member.id] : prev.filter(id => id !== member.id))} />
                        {userDisplayName(member)}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAddLabelModal(false)}
                  className="flex-1 px-4 py-2 border border-neutral-200 rounded"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleAddLabel}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded"
                >
                  {t('common.add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Shop Modal */}
      {showAddShopModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">{t('settings.addShopTitle')}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('settings.name')}</label>
                <input
                  type="text"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  placeholder={t('settings.shopNamePlaceholder')}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('settings.color')}</label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-md border border-neutral-300 cursor-pointer flex-shrink-0"
                    style={{ backgroundColor: newShopColor }}
                    onClick={() => {
                      const input = document.getElementById('shop-color-input') as HTMLInputElement;
                      input?.click();
                    }}
                  />
                  <input
                    id="shop-color-input"
                    type="color"
                    value={newShopColor}
                    onChange={(e) => setNewShopColor(e.target.value)}
                    className="sr-only"
                  />
                  <input
                    type="text"
                    value={newShopColor}
                    onChange={(e) => setNewShopColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1 px-3 py-2 border border-neutral-200 rounded font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAddShopModal(false)}
                  className="flex-1 px-4 py-2 border border-neutral-200 rounded"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleAddShop}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded"
                >
                  {t('common.add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Label Modal */}
      {editingLabelId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">{t('settings.editLabelTitle')}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('settings.name')}</label>
                <input
                  type="text"
                  value={editingLabelName}
                  onChange={(e) => setEditingLabelName(e.target.value)}
                  placeholder={t('settings.labelNamePlaceholder')}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('settings.color')}</label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-md border border-neutral-300 cursor-pointer flex-shrink-0"
                    style={{ backgroundColor: editingLabelColor || '#3b82f6' }}
                    onClick={() => { const i = document.getElementById('edit-label-color') as HTMLInputElement; i?.click(); }}
                  />
                  <input id="edit-label-color" type="color" value={editingLabelColor} onChange={(e) => setEditingLabelColor(e.target.value)} className="sr-only" />
                  <input type="text" value={editingLabelColor} onChange={(e) => setEditingLabelColor(e.target.value)} placeholder="#3b82f6" className="flex-1 px-3 py-2 border border-neutral-200 rounded font-mono text-sm" />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-neutral-200 p-3">
                <p className="text-sm font-medium text-neutral-700">Zichtbaarheid</p>
                {labelVisibilityOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <label key={option.value} className="flex items-start gap-3 rounded-lg p-2 hover:bg-neutral-50">
                      <input type="radio" name="edit-label-visibility" value={option.value} checked={editingLabelVisibility === option.value} onChange={() => setEditingLabelVisibility(option.value)} className="mt-1" />
                      <Icon className="mt-0.5 h-4 w-4 text-neutral-600" />
                      <span><span className="block text-sm font-medium text-neutral-800">{option.label}</span><span className="block text-xs text-neutral-500">{option.description}</span></span>
                    </label>
                  );
                })}
                {editingLabelVisibility === 'shared' && (
                  <div className="space-y-2 border-t border-neutral-100 pt-3">
                    <p className="text-xs font-medium text-neutral-500">{t('labels.sharedMembers')}</p>
                    {humanFamilyMembers.map((member) => (
                      <label key={member.id} className="flex items-center gap-2 text-sm text-neutral-700">
                        <input type="checkbox" checked={editingLabelSharedWith.includes(member.id)} onChange={(e) => setEditingLabelSharedWith(prev => e.target.checked ? [...prev, member.id] : prev.filter(id => id !== member.id))} />
                        {userDisplayName(member)}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setEditingLabelId(null);
                    setEditingLabelName('');
                    setEditingLabelColor('');
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-200 rounded"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleEditLabel}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Shop Modal */}
      {editingShopId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">{t('settings.editShopTitle')}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('settings.name')}</label>
                <input
                  type="text"
                  value={editingShopName}
                  onChange={(e) => setEditingShopName(e.target.value)}
                  placeholder={t('settings.shopNamePlaceholder')}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('settings.color')}</label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-md border border-neutral-300 cursor-pointer flex-shrink-0"
                    style={{ backgroundColor: editingShopColor || '#3b82f6' }}
                    onClick={() => { const i = document.getElementById('edit-shop-color') as HTMLInputElement; i?.click(); }}
                  />
                  <input id="edit-shop-color" type="color" value={editingShopColor} onChange={(e) => setEditingShopColor(e.target.value)} className="sr-only" />
                  <input type="text" value={editingShopColor} onChange={(e) => setEditingShopColor(e.target.value)} placeholder="#3b82f6" className="flex-1 px-3 py-2 border border-neutral-200 rounded font-mono text-sm" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setEditingShopId(null);
                    setEditingShopName('');
                    setEditingShopColor('');
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-200 rounded"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleEditShop}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};
