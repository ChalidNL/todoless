import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';
import { User, ApiToken, userDisplayName, Agent } from '../types';
import { t } from '../i18n/translations';
import { ChevronDown, ChevronUp, Plus, Edit2, Trash2, X, LogOut, Eye, EyeOff, Copy, Check, Lock, ExternalLink, Plug, Bot } from 'lucide-react';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { LabelBadge } from './shared/LabelBadge';
import { InviteManager } from './InviteManager';
import { api } from '../lib/pocketbase-client';
import { pb } from '../lib/pocketbase';

export const Settings = () => {
  const { users, appSettings, updateAppSettings, updateUser, deleteUser, labels, addLabel, updateLabel, deleteLabel, shops, addShop, updateShop, deleteShop, tasks, filters, deleteFilter, showCompletionMessage } = useApp();
  const { signOut } = useAuth();
  const appVersion = import.meta.env.VITE_APP_VERSION || 'dev';
  const appCommitRaw = import.meta.env.VITE_GIT_COMMIT || 'local';
  const appCommit = appCommitRaw === 'local' ? 'local' : appCommitRaw.slice(0, 7);
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
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');
  const [newShopName, setNewShopName] = useState('');
  const [newShopColor, setNewShopColor] = useState('#3b82f6');
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState('');
  const [editingLabelColor, setEditingLabelColor] = useState('');
  const [editingLabelPrivate, setEditingLabelPrivate] = useState(false);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [editingShopName, setEditingShopName] = useState('');
  const [editingShopColor, setEditingShopColor] = useState('');
  const [showAddLabelModal, setShowAddLabelModal] = useState(false);
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [showAgentApproval, setShowAgentApproval] = useState(false);
  const [pendingAgents, setPendingAgents] = useState<{id: string; email: string; name: string; created: string}[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [approvingAgentId, setApprovingAgentId] = useState<string | null>(null);
  const [rejectingAgentId, setRejectingAgentId] = useState<string | null>(null);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [pendingAgentsCount, setPendingAgentsCount] = useState(0);
  const [approvedAgentsCount, setApprovedAgentsCount] = useState(0);

  // Full Agents management
  const [showAgents, setShowAgents] = useState(false);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [loadingAllAgents, setLoadingAllAgents] = useState(false);
  const [revokingAgentId, setRevokingAgentId] = useState<string | null>(null);

  const currentUser = users.find(u => u.id === appSettings.currentUserId);

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
    setEditDisplayName(currentUser.displayName || '');
    setEditingProfile(true);
  };

  const handleProfileSave = async () => {
    if (!currentUser) return;
    setProfileError('');
    if (!editFirstName.trim() && !editLastName.trim() && !editDisplayName.trim()) {
      setProfileError(t('common.error'));
      return;
    }
    const fullName = [editFirstName.trim(), editLastName.trim()].filter(Boolean).join(' ');
    const success = await updateUser(currentUser.id, {
      name: fullName || currentUser.name,
      firstName: editFirstName.trim() || undefined,
      lastName: editLastName.trim() || undefined,
      displayName: editDisplayName.trim() || undefined,
    } as Partial<User>);
    if (success) {
      setEditingProfile(false);
      showCompletionMessage('Profiel opgeslagen');
    } else {
      setProfileError(t('settings.profileSaveFailed'));
    }
  };

  const handleCancelProfileEdit = () => {
    setEditingProfile(false);
  };

  const handleRoleChange = (role: 'owner' | 'admin' | 'member' | 'agent') => {
    if (!currentUser) return;
    updateUser(currentUser.id, { role });
  };

  const handleToggleMemberActive = async (user: User) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    await updateUser(user.id, { active: !(user.active ?? true) } as Partial<User>);
  };

  const handleDeleteMember = async (user: User) => {
    if (!currentUser || currentUser.role !== 'admin') return;
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

  const handleAddLabel = () => {
    if (!newLabelName) return;
    addLabel({ name: newLabelName, color: newLabelColor });
    setNewLabelName('');
    setNewLabelColor('#3b82f6');
    setShowAddLabelModal(false);
  };

  const handleEditLabel = () => {
    if (!editingLabelId || !editingLabelName) return;
    updateLabel(editingLabelId, { name: editingLabelName, color: editingLabelColor, isPrivate: editingLabelPrivate });
    setEditingLabelId(null);
    setEditingLabelName('');
    setEditingLabelColor('');
    setEditingLabelPrivate(false);
    setShowLabels(false);
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
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-neutral-600">{t('common.noData')}</p>
      </div>
    );
  }

  return (
    <>
      
      {/* Header */}
      <div className="sticky top-0 z-40">
        <NewGlobalHeader />
      </div>

              <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 space-y-6">
        {/* User Profile */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold mb-4">{t('settings.yourProfile')}</h2>
          
          {profileError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {profileError}
            </div>
          )}

          {!editingProfile ? (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-neutral-200 flex items-center justify-center text-2xl font-semibold shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{currentUser.name}</p>
                    <button
                      onClick={handleProfileEdit}
                      className="p-1.5 hover:bg-neutral-100 rounded transition-colors shrink-0"
                      title={t('settings.editProfile')}
                    >
                      <Edit2 className="w-4 h-4 text-neutral-500" />
                    </button>
                  </div>
                  <p className="text-sm text-neutral-500">{currentUser.firstName || currentUser.lastName
                    ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ')
                    : t('common.unknown')}</p>
                  <p className="text-sm text-neutral-600 truncate">{currentUser.email}</p>
                  <p className="text-xs text-neutral-500 capitalize mt-1">
                    {t('settings.role')}: {currentUser.role || t('settings.member')}
                  </p>
                </div>
              </div>

              {/* Password Change */}
              <div>
                <label className="block text-sm text-neutral-600 mb-2">{t('settings.password')}</label>
                {passwordError && (
                  <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {passwordError}
                  </div>
                )}
                {!editingPassword ? (
                  <button
                    onClick={() => { setEditingPassword(true); setPasswordError(''); }}
                    className="text-sm text-neutral-600 hover:text-neutral-900 flex items-center gap-2"
                  >
                    {t('settings.changePassword')}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t('settings.currentPassword')}
                      className="w-full px-3 py-2 border border-neutral-200 rounded text-sm"
                    />
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t('settings.newPassword')}
                        className="w-full px-3 py-2 pr-10 border border-neutral-200 rounded text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t('settings.confirmPassword')}
                      className="w-full px-3 py-2 border border-neutral-200 rounded text-sm"
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          setEditingPassword(false);
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                          setShowPassword(false);
                          setPasswordError('');
                        }}
                        className="px-3 py-1.5 border border-neutral-200 rounded text-sm flex-1"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={handlePasswordChange}
                        className="px-3 py-1.5 bg-neutral-900 text-white rounded text-sm flex-1"
                      >
                        {t('settings.update')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Profile Edit Form */
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-neutral-200 flex items-center justify-center text-2xl font-semibold shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm text-neutral-500">{currentUser.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('settings.name')}</label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder={t('settings.name')}
                  className="w-full px-3 py-2 border border-neutral-200 rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('settings.name')}</label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder={t('settings.name')}
                  className="w-full px-3 py-2 border border-neutral-200 rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">{t('settings.name')}</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder={t('settings.name')}
                  className="w-full px-3 py-2 border border-neutral-200 rounded text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCancelProfileEdit}
                  className="flex-1 px-4 py-2 border border-neutral-200 rounded text-sm"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleProfileSave}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded text-sm"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Team Members */}
        <div className="mb-6 border-b border-neutral-200 pb-6">
          <button
            onClick={() => setShowTeamMembers(!showTeamMembers)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-lg font-semibold">{t('members.title')}</h2>
            {showTeamMembers ? (
              <ChevronUp className="w-5 h-5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-500" />
            )}
          </button>

          {showTeamMembers && (
            <>
              {/* Invite Manager - only for admins */}
              {currentUser?.role === 'admin' && (
                <div className="mb-6 p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <h3 className="text-sm font-semibold mb-3">{t('members.inviteMember')}</h3>
                  <InviteManager />
                </div>
              )}

              {currentUser?.role !== 'admin' && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  🔒
                  {t('members.noMembers')}
                </div>
              )}

              <h3 className="text-sm font-semibold mb-3">{t('settings.teamMembers')}</h3>

              {/* Admin max-1 warning */}
              {users.filter(u => u.role === 'admin').length > 1 && currentUser?.role === 'admin' && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  ⚠️ Er zijn {users.filter(u => u.role === 'admin').length} admins. Maximaal 1 admin toegestaan. Demote de extra admins naar user.
                </div>
              )}

              <div className="space-y-3">
                {users.map(user => (
                  <div key={user.id} className="p-3 border border-neutral-200 rounded">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-semibold shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{user.name}</p>
                        <p className="text-xs text-neutral-600 truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded capitalize ${
                        user.role === 'admin' ? 'bg-neutral-900 text-white' : user.role === 'agent' ? 'bg-blue-100 text-blue-700' : user.role === 'owner' ? 'bg-purple-100 text-purple-700' : 'bg-neutral-100'
                      }`}>
                        {user.role === 'owner' ? t('settings.owner') : user.role === 'admin' ? t('settings.member') : user.role === 'agent' ? t('settings.member') : t('settings.member')}
                      </span>
                      {(user.active ?? true) ? (
                        <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">{t('settings.active')}</span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">{t('settings.blocked')}</span>
                      )}
                    </div>

                    {currentUser?.role === 'admin' && currentUser.id !== user.id && user.role !== 'admin' && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleToggleMemberActive(user)}
                          className="text-xs px-2 py-1 rounded border border-neutral-200 hover:bg-neutral-50"
                        >
                          {(user.active ?? true) ? t('settings.blocked') : t('settings.active')}
                        </button>
                        <button
                          onClick={() => handleDeleteMember(user)}
                          className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    )}
                    {currentUser?.role === 'admin' && currentUser.id !== user.id && user.role === 'admin' && users.filter(u => u.role === 'admin').length > 1 && (
                      <div className="mt-2">
                        <button
                          onClick={async () => {
                            try {
                              await updateUser(user.id, { role: 'member' });
                              showCompletionMessage(`${user.name} gedemote naar member`);
                            } catch (e: any) {
                              showCompletionMessage(String(e.message || e));
                            }
                          }}
                          className="text-xs px-2 py-1 rounded border border-orange-200 text-orange-600 hover:bg-orange-50"
                        >
                          {t('settings.demoteToMember')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Labels Section */}
        <div className="mb-6 border-b border-neutral-200 pb-6">
          <button
            onClick={() => setShowLabels(!showLabels)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {t('settings.labels')}
            </h2>
            {showLabels ? (
              <ChevronUp className="w-5 h-5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-500" />
            )}
          </button>

          {showLabels && (
            <>
              <button
                onClick={() => setShowAddLabelModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 mb-4"
              >
                <Plus className="w-4 h-4" />
                {t('settings.addLabel')}
              </button>

              <div className="space-y-3">
                {labels.map(label => (
                  <div key={label.id} className="flex items-center gap-3 p-3 border border-neutral-200 rounded">
                    <LabelBadge label={label} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{label.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingLabelId(label.id);
                          setEditingLabelName(label.name);
                          setEditingLabelColor(label.color);
                          setEditingLabelPrivate(label.isPrivate || false);
                        }}
                        className="p-1 hover:bg-neutral-100 rounded"
                        title={t('common.edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLabel(label.id)}
                        className="p-1 hover:bg-neutral-100 rounded text-red-500"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Shops Section */}
        <div className="mb-6 border-b border-neutral-200 pb-6">
          <button
            onClick={() => setShowShops(!showShops)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {t('settings.shops')}
            </h2>
            {showShops ? (
              <ChevronUp className="w-5 h-5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-500" />
            )}
          </button>

          {showShops && (
            <>
              <button
                onClick={() => setShowAddShopModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 mb-4"
              >
                <Plus className="w-4 h-4" />
                {t('settings.addShop')}
              </button>

              <div className="space-y-3">
                {shops.map(shop => (
                  <div key={shop.id} className="flex items-center gap-3 p-3 border border-neutral-200 rounded">
                    <LabelBadge label={shop} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{shop.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingShopId(shop.id);
                          setEditingShopName(shop.name);
                          setEditingShopColor(shop.color);
                        }}
                        className="p-1 hover:bg-neutral-100 rounded"
                        title={t('common.edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteShop(shop.id)}
                        className="p-1 hover:bg-neutral-100 rounded text-red-500"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Filter Views */}
        <div className="mb-6 border-b border-neutral-200 pb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-lg font-semibold">{t('settings.filterViews')}</h2>
            {showFilters ? (
              <ChevronUp className="w-5 h-5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-500" />
            )}
          </button>

          {showFilters && (
            <>
              {filters.length === 0 ? (
                <p className="text-sm text-neutral-500">{t('settings.noSavedFilters')}</p>
              ) : (
                <div className="space-y-2">
                  {filters.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 border border-neutral-200 rounded">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{f.name}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${f.type === 'task' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {f.type === 'task' ? t('common.tasks') : t('common.items')}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {f.chipFilters?.length || f.labelIds.length || 0} condition{f.chipFilters?.length !== 1 ? 's' : ''}
                          {f.chipFilters?.map(cf => (
                            <span key={cf.id} className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ backgroundColor: cf.color ? `${cf.color}20` : '#f3f4f6', color: cf.color || '#6b7280' }}
                            >{cf.label || cf.id}</span>
                          ))}
                        </p>
                      </div>
                      <button
                        onClick={() => { deleteFilter(f.id); showCompletionMessage(t('common.success')); }}
                        className="p-1.5 text-neutral-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>


        {/* Integration Section */}
          <div className="mb-6 border-b border-neutral-200 pb-6">
            <button
              onClick={toggleIntegrationsSection}
              className="flex items-center justify-between w-full mb-3"
            >
              <h2 className="text-lg font-semibold">
                {t('settings.integration')}
              </h2>
              {showIntegrations ? (
                <ChevronUp className="w-5 h-5 text-neutral-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-500" />
              )}
            </button>

            {showIntegrations && (
              <div className="space-y-4">
                {/* API Documentation */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">{t('settings.apiDocumentation')}</h3>
                  <a
                    href="/api/swagger"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t('settings.openSwaggerDocs')}
                  </a>
                </div>

                {/* Agent Pending Summary + API Tokens + Agents inline */}

                {/* Agent Status Summary */}
                {approvedAgentsCount > 0 || pendingAgentsCount > 0 ? (
                  <div className="flex items-center gap-3 text-sm">
                    {pendingAgentsCount > 0 && (
                      <span className="text-orange-600 font-medium">{pendingAgentsCount} {t('settings.pendingCount')}</span>
                    )}
                    {approvedAgentsCount > 0 && (
                      <span className="text-green-600 font-medium">{approvedAgentsCount} {t('settings.approvedCount')}</span>
                    )}
                  </div>
                ) : null}

                {/* API Tokens */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">{t('settings.apiTokens')}</h3>

                  {apiTokens.length === 0 ? (
                    <p className="text-sm text-neutral-600">{t('settings.noApiTokensYet')}</p>
                  ) : (
                    <div className="space-y-3">
                      {apiTokens.map(token => (
                        <div key={token.id} className="p-3 border border-neutral-200 rounded">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{token.name}</p>
                              <p className="text-xs text-neutral-500 mt-0.5">
                                {token.permissions?.join(', ') || t('settings.noPermissions')}
                              </p>
                              {token.expires_at && (
                                <p className="text-xs text-neutral-400 mt-0.5">
                                  {t('settings.expires')}: {new Date(token.expires_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleToggleToken(token.id, !token.enabled)}
                                className={`text-xs px-2 py-1 rounded ${
                                  token.enabled
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-neutral-100 text-neutral-500'
                                }`}
                              >
                                {token.enabled ? t('settings.enabled') : t('settings.disabled')}
                              </button>
                              <button
                                onClick={() => handleDeleteToken(token.id)}
                                className="p-1 hover:bg-red-50 rounded text-red-500"
                                title={t('settings.revokeToken')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3">{t('settings.agentApproval')}</h3>
                  {loadingAgents ? (
                    <p className="text-sm text-neutral-600 py-4 text-center">{t('common.loading')}</p>
                  ) : pendingAgents.length === 0 ? (
                    <p className="text-sm text-neutral-600 py-4 text-center">{t('settings.noPendingAgents')}</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingAgents.map(agent => (
                        <div key={agent.id} className="p-4 border border-neutral-200 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-sm font-semibold text-orange-700 shrink-0">
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{agent.name || t('settings.unnamed')}</p>
                              <p className="text-xs text-neutral-600 truncate">{agent.email}</p>
                              <p className="text-xs text-neutral-400 mt-0.5">
                                {t('settings.requested')}: {new Date(agent.created).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleApproveAgent(agent.id)}
                              disabled={approvingAgentId === agent.id || rejectingAgentId === agent.id}
                              className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              {approvingAgentId === agent.id ? (
                                <span>{t('settings.approving')}</span>
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  {t('settings.approve')}
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleRejectAgent(agent.id)}
                              disabled={approvingAgentId === agent.id || rejectingAgentId === agent.id}
                              className="flex-1 px-3 py-1.5 border border-red-200 text-red-600 rounded text-sm hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              {rejectingAgentId === agent.id ? (
                                <span>{t('settings.rejecting')}</span>
                              ) : (
                                <>
                                  <X className="w-4 h-4" />
                                  {t('settings.reject')}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3">{t('settings.agents')}</h3>
                  {loadingAllAgents ? (
                    <p className="text-sm text-neutral-600 py-4 text-center">{t('common.loading')}</p>
                  ) : allAgents.length === 0 ? (
                    <p className="text-sm text-neutral-600 py-4 text-center">{t('settings.noRegisteredAgents')}</p>
                  ) : (
                    <div className="space-y-3">
                      {allAgents.map(agent => (
                        <div key={agent.id} className="p-4 border border-neutral-200 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                              agent.status === 'approved' ? 'bg-green-100 text-green-700' :
                              agent.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{agent.name || t('settings.unnamed')}</p>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  agent.status === 'approved' ? 'bg-green-100 text-green-700' :
                                  agent.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {agent.status}
                                </span>
                              </div>
                              <p className="text-xs text-neutral-600 truncate">{agent.email}</p>
                              <p className="text-xs text-neutral-400 mt-0.5">
                                {t('settings.created')}: {new Date(agent.created).toLocaleDateString()}
                                {agent.updated && ` • ${t('settings.updated')}: ${new Date(agent.updated).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>

                          {agent.status === 'approved' && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => handleRevokeAgent(agent.id)}
                                disabled={revokingAgentId === agent.id}
                                className="flex-1 px-3 py-1.5 border border-red-200 text-red-600 rounded text-sm hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-1.5"
                              >
                                {revokingAgentId === agent.id ? (
                                  <span>{t('settings.revoking')}</span>
                                ) : (
                                  <>
                                    <Trash2 className="w-4 h-4" />
                                    {t('settings.revokeToken')}
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        {/* App Info */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4 space-y-2" data-testid="app-info">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">{t('settings.appInfo')}</h3>
            <button
              onClick={handleCopyAppInfo}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs border border-neutral-200 rounded hover:bg-neutral-50"
              aria-label={t('settings.copyAppInfo')}
            >
              <Copy className="w-3.5 h-3.5" />
              {t('settings.copyAppInfo')}
            </button>
          </div>
          <div className="text-sm text-neutral-600">
            <p><span className="font-medium text-neutral-800">{t('settings.version')}:</span> <code>{appVersion}</code></p>
            <p><span className="font-medium text-neutral-800">{t('settings.commit')}:</span> <code>{appCommit}</code></p>

          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full px-4 py-3 border-2 border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          {t('settings.logOut')}
        </button>
      </div>

      {/* Add Label Modal */}
      {showAddLabelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Label</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Name</label>
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Label Name"
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Color</label>
                <input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAddLabelModal(false)}
                  className="flex-1 px-4 py-2 border border-neutral-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddLabel}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded"
                >
                  Add
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
            <h3 className="text-lg font-semibold mb-4">Add Shop</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Name</label>
                <input
                  type="text"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  placeholder="Shop Name"
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Color</label>
                <input
                  type="color"
                  value={newShopColor}
                  onChange={(e) => setNewShopColor(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAddShopModal(false)}
                  className="flex-1 px-4 py-2 border border-neutral-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddShop}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded"
                >
                  Add
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
            <h3 className="text-lg font-semibold mb-4">Edit Label</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Name</label>
                <input
                  type="text"
                  value={editingLabelName}
                  onChange={(e) => setEditingLabelName(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Color</label>
                <input
                  type="color"
                  value={editingLabelColor}
                  onChange={(e) => setEditingLabelColor(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
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
                  Cancel
                </button>
                <button
                  onClick={handleEditLabel}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded"
                >
                  Save
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
            <h3 className="text-lg font-semibold mb-4">Edit Shop</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Name</label>
                <input
                  type="text"
                  value={editingShopName}
                  onChange={(e) => setEditingShopName(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Color</label>
                <input
                  type="color"
                  value={editingShopColor}
                  onChange={(e) => setEditingShopColor(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
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
                  Cancel
                </button>
                <button
                  onClick={handleEditShop}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};
