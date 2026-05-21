import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';
import { User, ApiToken, userDisplayName, Agent } from '../types';
import { ChevronDown, ChevronUp, Plus, Edit2, Trash2, X, LogOut, Eye, EyeOff, Copy, Check, Lock, ExternalLink, Plug, Bot } from 'lucide-react';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { LabelBadge } from './shared/LabelBadge';
import { TopBar } from './shared/TopBar';
import { InviteManager } from './InviteManager';
import { api } from '../lib/pocketbase-client';
import { pb } from '../lib/pocketbase';

export const Settings = () => {
  const { users, appSettings, updateAppSettings, updateUser, deleteUser, labels, addLabel, updateLabel, deleteLabel, shops, addShop, updateShop, deleteShop, tasks, showCompletionMessage } = useApp();
  const { signOut } = useAuth();
  const appVersion = 'dev';
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
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');
  const [newShopName, setNewShopName] = useState('');
  const [newShopColor, setNewShopColor] = useState('#3b82f6');
  const [showApiTokens, setShowApiTokens] = useState(false);
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [showAddTokenModal, setShowAddTokenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenPermissions, setNewTokenPermissions] = useState<string[]>(['*']);
  const [newTokenExpiry, setNewTokenExpiry] = useState('');
  const [showAdvancedTokenOptions, setShowAdvancedTokenOptions] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
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
  const [approvedToken, setApprovedToken] = useState<{agentId: string; token: string} | null>(null);
  const [showIntegrations, setShowIntegrations] = useState(false);
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
      setPasswordError('All password fields are required');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }
    // Verify current password by attempting to re-authenticate
    try {
      await api.login(currentUser.email, currentPassword);
    } catch {
      setPasswordError('Current password is incorrect');
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
      showCompletionMessage('Password updated successfully');
    } else {
      setPasswordError('Failed to update password');
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
      setProfileError('At least one field is required');
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
      setProfileError('Failed to save profile');
    }
  };

  const handleCancelProfileEdit = () => {
    setEditingProfile(false);
  };

  const handleRoleChange = (role: 'admin' | 'user' | 'child') => {
    if (!currentUser) return;
    updateUser(currentUser.id, { role });
  };

  const handleToggleMemberActive = async (user: User) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    await updateUser(user.id, { active: !(user.active ?? true) } as Partial<User>);
  };

  const handleDeleteMember = async (user: User) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (!window.confirm(`Delete ${user.name}? This cannot be undone.`)) return;
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
        showCompletionMessage('App info copied');
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
        showCompletionMessage('App info copied');
      } else {
        showCompletionMessage('Copy failed');
      }
    } catch {
      showCompletionMessage('Copy failed');
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

  const toggleApiTokenSection = async () => {
    const next = !showApiTokens;
    setShowApiTokens(next);
    if (next && apiTokens.length === 0) {
      await loadApiTokens();
    }
  };

  const handleCreateToken = async () => {
    if (!newTokenName) return;
    try {
      // Default permissions and 1-year expiry
      const defaultPermissions = ['tasks:read', 'tasks:write', 'groceries:read', 'groceries:write'];
      const permissions = newTokenPermissions.length > 0 ? newTokenPermissions : defaultPermissions;
      const expiry = newTokenExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const result = await api.createApiToken(newTokenName, permissions, expiry);
      setCreatedToken(result.token);
      setNewTokenName('');
      setNewTokenPermissions([]);
      setNewTokenExpiry('');
      setShowAdvancedTokenOptions(false);
      await loadApiTokens();
    } catch (err: any) {
      showCompletionMessage(err.message || 'Failed to create token');
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!window.confirm('Revoke this API token? This cannot be undone.')) return;
    try {
      await api.deleteApiToken(tokenId);
      await loadApiTokens();
      showCompletionMessage('Token revoked');
    } catch (err: any) {
      showCompletionMessage(err.message || 'Failed to revoke token');
    }
  };

  const handleToggleToken = async (tokenId: string, enabled: boolean) => {
    try {
      await api.toggleApiToken(tokenId, enabled);
      await loadApiTokens();
    } catch (err: any) {
      showCompletionMessage(err.message || 'Failed to toggle token');
    }
  };

  const togglePermission = (perm: string) => {
    setNewTokenPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleCopyToken = async (token: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(token);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = token;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showCompletionMessage('Token copied to clipboard');
    } catch {
      showCompletionMessage('Copy failed');
    }
  };

  const loadPendingAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await fetch('/api/todoless/agent/pending', {
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingAgents(data.agents || []);
      }
    } catch {
      showCompletionMessage('Failed to load pending agents');
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
      const response = await fetch(`/api/todoless/agent/approve/${agentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setPendingAgents(prev => prev.filter(a => a.id !== agentId));
        setApprovedToken({ agentId, token: data.token });
        showCompletionMessage('Agent approved');
      } else {
        showCompletionMessage(data.error || 'Failed to approve agent');
      }
    } catch {
      showCompletionMessage('Failed to approve agent');
    } finally {
      setApprovingAgentId(null);
    }
  };

  const handleRejectAgent = async (agentId: string) => {
    if (!window.confirm('Reject this agent? This cannot be undone.')) return;
    setRejectingAgentId(agentId);
    try {
      const response = await fetch(`/api/todoless/agent/reject/${agentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      if (response.ok) {
        setPendingAgents(prev => prev.filter(a => a.id !== agentId));
        showCompletionMessage('Agent rejected');
      } else {
        const data = await response.json();
        showCompletionMessage(data.error || 'Failed to reject agent');
      }
    } catch {
      showCompletionMessage('Failed to reject agent');
    } finally {
      setRejectingAgentId(null);
    }
  };

  const handleCopyAgentToken = async (token: string) => {
    await handleCopyToken(token);
  };

  const loadAgentCounts = async () => {
    try {
      const response = await fetch('/api/todoless/agent/counts', {
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingAgents(data.pending || []);
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
      const response = await fetch('/api/todoless/agent/list', {
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAllAgents(data.agents || []);
      } else {
        showCompletionMessage('Failed to load agents');
      }
    } catch {
      showCompletionMessage('Failed to load agents');
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
    if (!window.confirm('Revoke this agent token? The agent will lose access.')) return;
    setRevokingAgentId(agentId);
    try {
      const response = await fetch(`/api/todoless/agent/${agentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
      });
      if (response.ok) {
        setAllAgents(prev => prev.filter(a => a.id !== agentId));
        showCompletionMessage('Agent token revoked');
      } else {
        const data = await response.json();
        showCompletionMessage(data.error || 'Failed to revoke agent');
      }
    } catch {
      showCompletionMessage('Failed to revoke agent');
    } finally {
      setRevokingAgentId(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-neutral-600">Not logged in</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-[calc(env(safe-area-inset-bottom,0px)+112px)]">
      <TopBar />
      
      {/* Header */}
      <NewGlobalHeader />

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-10 space-y-6">
        {/* User Profile */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Your Profile</h2>
          
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
                      title="Edit profile"
                    >
                      <Edit2 className="w-4 h-4 text-neutral-500" />
                    </button>
                  </div>
                  <p className="text-sm text-neutral-500">{currentUser.firstName || currentUser.lastName
                    ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ')
                    : 'No display name'}</p>
                  <p className="text-sm text-neutral-600 truncate">{currentUser.email}</p>
                  <p className="text-xs text-neutral-500 capitalize mt-1">
                    Role: {currentUser.role || 'user'}
                  </p>
                </div>


              {/* Password Change */}
              <div>
                <label className="block text-sm text-neutral-600 mb-2">Password</label>
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
                    Change password
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full px-3 py-2 border border-neutral-200 rounded text-sm"
                    />
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password"
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
                      placeholder="Confirm new password"
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
                        Cancel
                      </button>
                      <button
                        onClick={handlePasswordChange}
                        className="px-3 py-1.5 bg-neutral-900 text-white rounded text-sm flex-1"
                      >
                        Update
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
                <label className="block text-sm text-neutral-600 mb-1">First name</label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full px-3 py-2 border border-neutral-200 rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Last name</label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full px-3 py-2 border border-neutral-200 rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Display name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Display name"
                  className="w-full px-3 py-2 border border-neutral-200 rounded text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCancelProfileEdit}
                  className="flex-1 px-4 py-2 border border-neutral-200 rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProfileSave}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded text-sm"
                >
                  Save
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
            <h2 className="text-lg font-semibold">Members</h2>
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
                  <h3 className="text-sm font-semibold mb-3">Invite Codes</h3>
                  <InviteManager />
                </div>
              )}

              {currentUser?.role !== 'admin' && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  🔒
                  Only administrators can invite new users. Contact your admin to get access.
                </div>
              )}

              <h3 className="text-sm font-semibold mb-3">Team Members</h3>
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
                        user.role === 'admin' ? 'bg-neutral-900 text-white' : user.role === 'assistant' ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100'
                      }`}>
                        {user.role || 'user'}
                      </span>
                      {(user.active ?? true) ? (
                        <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">active</span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">blocked</span>
                      )}
                    </div>

                    {currentUser?.role === 'admin' && currentUser.id !== user.id && user.role !== 'admin' && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleToggleMemberActive(user)}
                          className="text-xs px-2 py-1 rounded border border-neutral-200 hover:bg-neutral-50"
                        >
                          {(user.active ?? true) ? 'Block' : 'Unblock'}
                        </button>
                        <button
                          onClick={() => handleDeleteMember(user)}
                          className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Delete
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
              Labels
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
                Add Label
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
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLabel(label.id)}
                        className="p-1 hover:bg-neutral-100 rounded text-red-500"
                        title="Delete"
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
              Shops
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
                Add Shop
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
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteShop(shop.id)}
                        className="p-1 hover:bg-neutral-100 rounded text-red-500"
                        title="Delete"
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

        {/* API Tokens Section */}
        {currentUser?.role === 'admin' && (
          <div className="mb-6 border-b border-neutral-200 pb-6">
            <button
              onClick={toggleApiTokenSection}
              className="flex items-center justify-between w-full mb-3"
            >
              <h2 className="text-lg font-semibold flex items-center gap-2">
                API Tokens
              </h2>
              {showApiTokens ? (
                <ChevronUp className="w-5 h-5 text-neutral-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-500" />
              )}
            </button>

            {showApiTokens && (
              <>
                <button
                  onClick={() => setShowAddTokenModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 mb-4"
                >
                  <Plus className="w-4 h-4" />
                  Create API Token
                </button>

                {/* Created token display */}
                {createdToken && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-semibold text-blue-800 mb-2">
                      Token created — copy it now. It will not be shown again.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white border border-blue-200 rounded p-2 break-all select-all">
                        {createdToken}
                      </code>
                      <button
                        onClick={() => handleCopyToken(createdToken!)}
                        className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 shrink-0"
                        title="Copy token"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => setCreatedToken(null)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {apiTokens.length === 0 ? (
                  <p className="text-sm text-neutral-600">No API tokens yet.</p>
                ) : (
                  <div className="space-y-3">
                    {apiTokens.map(token => (
                      <div key={token.id} className="p-3 border border-neutral-200 rounded">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{token.name}</p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              {token.permissions?.join(', ') || 'No permissions'}
                            </p>
                            {token.expires_at && (
                              <p className="text-xs text-neutral-400 mt-0.5">
                                Expires: {new Date(token.expires_at).toLocaleDateString()}
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
                              {token.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                            <button
                              onClick={() => handleDeleteToken(token.id)}
                              className="p-1 hover:bg-red-50 rounded text-red-500"
                              title="Revoke token"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Integrations Section - Admin only */}
        {currentUser?.role === 'admin' && (
          <div className="mb-6 border-b border-neutral-200 pb-6">
            <button
              onClick={toggleIntegrationsSection}
              className="flex items-center justify-between w-full mb-3"
            >
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plug className="w-5 h-5" />
                Integrations
              </h2>
              {showIntegrations ? (
                <ChevronUp className="w-5 h-5 text-neutral-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-500" />
              )}
            </button>

            {showIntegrations && (
              <div className="space-y-4">
                <div className="p-4 bg-white border border-neutral-200 rounded-lg space-y-3">
                  <h3 className="text-sm font-semibold">API Documentation</h3>
                  <p className="text-xs text-neutral-600">Explore the API endpoints, request/response schemas, and authentication details.</p>
                  <a
                    href="/api/todoless/swagger"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Swagger Docs
                  </a>
                </div>

                <div className="p-4 bg-white border border-neutral-200 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-neutral-600" />
                    <h3 className="text-sm font-semibold">Agent Status</h3>
                  </div>
                  <p className="text-xs text-neutral-600">Connect external AI agents to interact with your tasks and groceries.</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-orange-600 font-medium">
                      {pendingAgents.length} pending
                    </span>
                    <span className="text-green-600 font-medium">
                      {approvedAgentsCount} approved
                    </span>
                  </div>
                  <button
                    onClick={toggleAgentApprovalSection}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Manage agents →
                  </button>
                </div>

                <div className="p-4 bg-white border border-neutral-200 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Plug className="w-4 h-4 text-neutral-600" />
                    <h3 className="text-sm font-semibold">Connect External App</h3>
                  </div>
                  <p className="text-xs text-neutral-600">
                    To connect an external application, create an API token with the required permissions.
                    The app will use this token to authenticate API requests.
                  </p>
                  <button
                    onClick={() => {
                      setShowAddTokenModal(true);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Create API token →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Agent Approval Section - Admin only */}
        {currentUser?.role === 'admin' && (
          <div className="mb-6 border-b border-neutral-200 pb-6">
            <button
              onClick={toggleAgentApprovalSection}
              className="flex items-center justify-between w-full mb-3"
            >
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Agent Approval
                {pendingAgents.length > 0 && (
                  <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                    {pendingAgents.length}
                  </span>
                )}
              </h2>
              {showAgentApproval ? (
                <ChevronUp className="w-5 h-5 text-neutral-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-500" />
              )}
            </button>

            {showAgentApproval && (
              <>
                {loadingAgents ? (
                  <p className="text-sm text-neutral-600 py-4 text-center">Loading...</p>
                ) : pendingAgents.length === 0 ? (
                  <p className="text-sm text-neutral-600 py-4 text-center">No pending agents.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingAgents.map(agent => (
                      <div key={agent.id} className="p-4 border border-neutral-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-sm font-semibold text-orange-700 shrink-0">
                            {agent.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{agent.name || 'Unnamed'}</p>
                            <p className="text-xs text-neutral-600 truncate">{agent.email}</p>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              Requested: {new Date(agent.created).toLocaleDateString()}
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
                              <span>Approving...</span>
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                Approve
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleRejectAgent(agent.id)}
                            disabled={approvingAgentId === agent.id || rejectingAgentId === agent.id}
                            className="flex-1 px-3 py-1.5 border border-red-200 text-red-600 rounded text-sm hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {rejectingAgentId === agent.id ? (
                              <span>Rejecting...</span>
                            ) : (
                              <>
                                <X className="w-4 h-4" />
                                Reject
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Approved token display - shown once after approval */}
                {approvedToken && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-semibold text-green-800 mb-2">
                      Agent approved — copy the token now. It will not be shown again.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white border border-green-200 rounded p-2 break-all select-all">
                        {approvedToken.token}
                      </code>
                      <button
                        onClick={() => handleCopyApprovedToken(approvedToken.token)}
                        className="p-2 bg-green-600 text-white rounded hover:bg-green-700 shrink-0"
                        title="Copy token"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => setApprovedToken(null)}
                      className="mt-2 text-xs text-green-600 hover:text-green-800"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Full Agents Section - Admin only */}
        {currentUser?.role === 'admin' && (
          <div className="mb-6 border-b border-neutral-200 pb-6">
            <button
              onClick={toggleAgentsSection}
              className="flex items-center justify-between w-full mb-3"
            >
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Agents
              </h2>
              {showAgents ? (
                <ChevronUp className="w-5 h-5 text-neutral-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-500" />
              )}
            </button>

            {showAgents && (
              <>
                {loadingAllAgents ? (
                  <p className="text-sm text-neutral-600 py-4 text-center">Loading...</p>
                ) : allAgents.length === 0 ? (
                  <p className="text-sm text-neutral-600 py-4 text-center">No registered agents.</p>
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
                              <p className="font-medium text-sm truncate">{agent.name || 'Unnamed'}</p>
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
                              Created: {new Date(agent.created).toLocaleDateString()}
                              {agent.updated && ` • Updated: ${new Date(agent.updated).toLocaleDateString()}`}
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
                                <span>Revoking...</span>
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4" />
                                  Revoke Token
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg border border-neutral-200 p-4 space-y-2" data-testid="app-info">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">App Info</h3>
            <button
              onClick={handleCopyAppInfo}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs border border-neutral-200 rounded hover:bg-neutral-50"
              aria-label="Copy app info"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          </div>
          <div className="text-sm text-neutral-600">
            <p><span className="font-medium text-neutral-800">Version:</span> <code>{appVersion}</code></p>
            <p><span className="font-medium text-neutral-800">Commit:</span> <code>{appCommit}</code></p>

          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full px-4 py-3 border-2 border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Log Out
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

      {/* Create API Token Modal */}
      {showAddTokenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create API Token</h3>
              <button onClick={() => setShowAddTokenModal(false)} className="p-1 hover:bg-neutral-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Name</label>
                <input
                  type="text"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="My Agent Token"
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-2">Permissions</label>
                <div className="space-y-2">
                  {[
                    { id: 'tasks:read', label: 'Tasks: Read' },
                    { id: 'tasks:write', label: 'Tasks: Write' },
                    { id: 'groceries:read', label: 'Groceries: Read' },
                    { id: 'groceries:write', label: 'Groceries: Write' },
                    { id: 'notes:read', label: 'Notes: Read' },
                    { id: 'notes:write', label: 'Notes: Write' },
                    { id: '*', label: 'Full Access (all)' },
                  ].map((perm) => (
                    <label
                      key={perm.id}
                      className="flex items-center gap-3 p-2 border border-neutral-200 rounded cursor-pointer hover:bg-neutral-50"
                    >
                      <input
                        type="checkbox"
                        checked={newTokenPermissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">
                  Expiry <span className="text-neutral-400">(optional)</span>
                </label>
                <input
                  type="date"
                  value={newTokenExpiry}
                  onChange={(e) => setNewTokenExpiry(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowAddTokenModal(false);
                    setNewTokenName('');
                    setNewTokenPermissions([]);
                    setNewTokenExpiry('');
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleCreateToken();
                    setShowAddTokenModal(false);
                  }}
                  disabled={!newTokenName || newTokenPermissions.length === 0}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
