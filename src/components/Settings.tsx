import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from './AuthProvider';
import { ChevronDown, ChevronUp, Plus, Edit2, Trash2, X, LogOut, Lock, Eye, EyeOff, Upload, Archive, Share2, Copy, Moon, Sun, Globe, Bell, Mail, Smartphone, AlertTriangle, UserX } from 'lucide-react';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { LabelBadge } from './shared/LabelBadge';
import { FilterBuilder } from './shared/FilterBuilder';
import { ApiIntegrations } from './ApiIntegrations';
import { TopBar } from './shared/TopBar';
import { BulkImport } from './shared/BulkImport';
import { InviteManager } from './InviteManager';

export const Settings = () => {
  const { users, appSettings, updateAppSettings, updateUser, labels, addLabel, updateLabel, deleteLabel, shops, addShop, updateShop, deleteShop, filters, deleteFilter, sprints, createNewSprint, currentSprint, deleteSprint, tasks, archiveCompletedSprintTasks, archiveAllDoneTasks, deleteArchivedTasks, showCompletionMessage } = useApp();
  const { language, setLanguage } = useLanguage();
  const { signOut } = useAuth();
  const appVersion = import.meta.env.VITE_APP_VERSION || 'dev';
  const appCommit = import.meta.env.VITE_GIT_COMMIT || 'unknown';
  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showShops, setShowShops] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSprints, setShowSprints] = useState(false);
  const [showTeamMembers, setShowTeamMembers] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [filterBuilderType, setFilterBuilderType] = useState<'task' | 'item' | 'note'>('task');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');
  const [newShopName, setNewShopName] = useState('');
  const [newShopColor, setNewShopColor] = useState('#3b82f6');
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
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const currentUser = users.find(u => u.id === appSettings.currentUserId);

  const handlePasswordChange = () => {
    if (!currentUser || !newPassword) return;
    updateUser(currentUser.id, { password: newPassword });
    setNewPassword('');
    setEditingPassword(false);
    setShowPassword(false);
  };

  const handleRoleChange = (role: 'admin' | 'user' | 'child') => {
    if (!currentUser) return;
    updateUser(currentUser.id, { role });
  };

  const handleLogout = () => {
    signOut();
    window.location.reload();
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

  const handleDeleteFilter = (id: string) => {
    deleteFilter(id);
  };

  const handleDeleteSprint = (id: string) => {
    deleteSprint(id);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-neutral-600">Not logged in</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <TopBar />
      
      {/* Header */}
      <NewGlobalHeader />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* User Profile */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Your Profile</h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-neutral-200 flex items-center justify-center text-2xl font-semibold">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold">{currentUser.name}</p>
                <p className="text-sm text-neutral-600">{currentUser.email}</p>
                <p className="text-xs text-neutral-500 capitalize mt-1">
                  Role: {currentUser.role || 'user'}
                </p>
              </div>
            </div>

            {/* Role Selector */}
            <div>
              <label className="block text-sm text-neutral-600 mb-2">Change Role</label>
              {currentUser.role === 'admin' ? (
                <div className="p-3 bg-neutral-100 border border-neutral-200 rounded text-sm text-neutral-600">
                  <Lock className="w-4 h-4 inline mr-2" />
                  Admin users cannot change their own role
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRoleChange('user')}
                    className={`flex-1 px-3 py-2 rounded border text-sm ${
                      currentUser.role === 'user'
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-white border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    User
                  </button>
                  <button
                    onClick={() => handleRoleChange('child')}
                    className={`flex-1 px-3 py-2 rounded border text-sm ${
                      currentUser.role === 'child'
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-white border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    Child
                  </button>
                </div>
              )}
            </div>

            {/* Password Change */}
            <div>
              <label className="block text-sm text-neutral-600 mb-2">Password</label>
              {!editingPassword ? (
                <button
                  onClick={() => setEditingPassword(true)}
                  className="text-sm text-neutral-600 hover:text-neutral-900 flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Change password
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full px-3 py-2 pr-10 border border-neutral-200 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePasswordChange}
                      className="px-3 py-1.5 bg-neutral-900 text-white rounded text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingPassword(false);
                        setNewPassword('');
                        setShowPassword(false);
                      }}
                      className="px-3 py-1.5 border border-neutral-200 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="mb-6 border-b border-neutral-200 pb-6">
          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Preferences
            </h2>
            {showPreferences ? (
              <ChevronUp className="w-5 h-5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-500" />
            )}
          </button>

          {showPreferences && (
            <div className="space-y-4">
              {/* Theme */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Theme</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateAppSettings({ theme: 'light' })}
                    className={`flex-1 px-3 py-2 rounded border text-sm flex items-center justify-center gap-2 ${
                      appSettings.theme === 'light'
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-white border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    Light
                  </button>
                  <button
                    onClick={() => updateAppSettings({ theme: 'dark' })}
                    className={`flex-1 px-3 py-2 rounded border text-sm flex items-center justify-center gap-2 ${
                      appSettings.theme === 'dark'
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-white border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    Dark
                  </button>
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'fr' | 'nl' | 'de')}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                >
                  <option value="en">English</option>
                  <option value="nl">Nederlands</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              {/* Sprint Duration */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Sprint Duration</label>
                <select
                  value={appSettings.sprintDuration || '2weeks'}
                  onChange={(e) => updateAppSettings({ sprintDuration: e.target.value as '1week' | '2weeks' | '3weeks' | '4weeks' })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                >
                  <option value="1week">1 Week</option>
                  <option value="2weeks">2 Weeks</option>
                  <option value="3weeks">3 Weeks</option>
                  <option value="4weeks">4 Weeks</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Notification Settings */}
        <div className="mb-6 border-b border-neutral-200 pb-6">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </h2>
            {showNotifications ? (
              <ChevronUp className="w-5 h-5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-500" />
            )}
          </button>

          {showNotifications && (
            <div className="space-y-4">
              {/* Email Notifications */}
              <div className="flex items-center justify-between p-3 border border-neutral-200 rounded">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-neutral-500" />
                  <div>
                    <p className="text-sm font-medium">Email Notifications</p>
                    <p className="text-xs text-neutral-500">Receive task updates via email</p>
                  </div>
                </div>
                <button
                  aria-label="Toggle email notifications"
                  onClick={() => updateAppSettings({ notificationEmail: !appSettings.notificationEmail })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    appSettings.notificationEmail ? 'bg-neutral-900' : 'bg-neutral-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    appSettings.notificationEmail ? 'translate-x-5' : ''
                  }`} />
                </button>
              </div>

              {/* Push Notifications */}
              <div className="flex items-center justify-between p-3 border border-neutral-200 rounded">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-neutral-500" />
                  <div>
                    <p className="text-sm font-medium">Push Notifications</p>
                    <p className="text-xs text-neutral-500">Browser push notifications</p>
                  </div>
                </div>
                <button
                  aria-label="Toggle push notifications"
                  onClick={() => updateAppSettings({ notificationPush: !appSettings.notificationPush })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    appSettings.notificationPush ? 'bg-neutral-900' : 'bg-neutral-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    appSettings.notificationPush ? 'translate-x-5' : ''
                  }`} />
                </button>
              </div>

              {/* Task Reminders */}
              <div className="flex items-center justify-between p-3 border border-neutral-200 rounded">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-neutral-500" />
                  <div>
                    <p className="text-sm font-medium">Task Reminders</p>
                    <p className="text-xs text-neutral-500">Get reminded before due dates</p>
                  </div>
                </div>
                <button
                  aria-label="Toggle task reminders"
                  onClick={() => updateAppSettings({ taskReminders: !appSettings.taskReminders })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    appSettings.taskReminders ? 'bg-neutral-900' : 'bg-neutral-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    appSettings.taskReminders ? 'translate-x-5' : ''
                  }`} />
                </button>
              </div>

              {/* Reminder Minutes */}
              {appSettings.taskReminders && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Reminder Time</label>
                  <select
                    value={appSettings.reminderMinutes ?? 15}
                    onChange={(e) => updateAppSettings({ reminderMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded"
                  >
                    <option value={5}>5 minutes before</option>
                    <option value={15}>15 minutes before</option>
                    <option value={30}>30 minutes before</option>
                    <option value={60}>1 hour before</option>
                    <option value={1440}>1 day before</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Account Management */}
        <div className="mb-6 border-b border-neutral-200 pb-6">
          <button
            onClick={() => setShowAccount(!showAccount)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Account
            </h2>
            {showAccount ? (
              <ChevronUp className="w-5 h-5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-500" />
            )}
          </button>

          {showAccount && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-semibold text-red-900 mb-2">Danger Zone</h3>
                <p className="text-xs text-red-700 mb-4">
                  Deleting your account will permanently remove all your data including tasks, items, notes, and settings. This action cannot be undone.
                </p>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                      if (confirm('This is your final confirmation. All your data will be permanently deleted.')) {
                        // Sign out first, then clear local storage
                        signOut();
                        localStorage.clear();
                        window.location.href = '/';
                      }
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm"
                >
                  <UserX className="w-4 h-4" />
                  Delete Account
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
                  <Lock className="w-4 h-4 inline mr-2" />
                  Only administrators can invite new users. Contact your admin to get access.
                </div>
              )}

              <h3 className="text-sm font-semibold mb-3">Team Members</h3>
              <div className="space-y-3">
                {users.map(user => (
                  <div key={user.id} className="flex items-center gap-3 p-3 border border-neutral-200 rounded">
                    <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-semibold">
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-neutral-600">{user.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded capitalize ${
                      user.role === 'admin' ? 'bg-neutral-900 text-white' : 'bg-neutral-100'
                    }`}>
                      {user.role || 'user'}
                    </span>
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
                          setEditingLabelPrivate(label.private || false);
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

        {/* Filters Section */}
        <div className="mb-6 border-b border-neutral-200 pb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Filters
            </h2>
            {showFilters ? (
              <ChevronUp className="w-5 h-5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-500" />
            )}
          </button>

          {showFilters && (
            <>
              <button
                onClick={() => setShowFilterBuilder(true)}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 mb-4"
              >
                <Plus className="w-4 h-4" />
                Add Filter
              </button>

              <div className="space-y-3">
                {filters.map(filter => (
                  <div key={filter.id} className="flex items-center gap-3 p-3 border border-neutral-200 rounded">
                    <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-semibold">
                      {filter.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{filter.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeleteFilter(filter.id)}
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

        {/* API Integrations */}
        <div className="mb-6 border-b border-neutral-200 pb-6">
          <button
            onClick={() => setShowIntegrations(!showIntegrations)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-lg font-semibold">Integrations</h2>
            {showIntegrations ? (
              <ChevronUp className="w-5 h-5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-500" />
            )}
          </button>

          {showIntegrations && (
            <ApiIntegrations />
          )}
        </div>

        {/* Sprint */}
        <div className="mb-6 border-b border-neutral-200 pb-6">
          <button
            onClick={() => setShowSprints(!showSprints)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-lg font-semibold">Sprint</h2>
            {showSprints ? (
              <ChevronUp className="w-5 h-5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-500" />
            )}
          </button>

          {showSprints && (
            <>
              <button
                onClick={createNewSprint}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 mb-4"
              >
                <Plus className="w-4 h-4" />
                New Sprint
              </button>

              {/* Sprint Start Day Setting */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Sprint Start Day
                </label>
                <select
                  value={appSettings.sprintStartDay ?? 1}
                  onChange={(e) => updateAppSettings({ sprintStartDay: Number(e.target.value) as 0 | 1 | 2 | 3 | 4 | 5 | 6 })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
                <p className="text-xs text-neutral-500 mt-1">
                  New sprints will automatically start on the next {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][appSettings.sprintStartDay ?? 1]}
                </p>
              </div>
              
              {/* Current Sprint */}
              {currentSprint && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-neutral-700 mb-2">Current Sprint</p>
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm text-green-900">{currentSprint.name}</p>
                      <button
                        onClick={() => {
                          if (confirm(`Archive all completed tasks from "${currentSprint.name}"? This will permanently delete them.`)) {
                            archiveCompletedSprintTasks(currentSprint.id);
                            showCompletionMessage(`Completed tasks from ${currentSprint.name} have been archived`);
                          }
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-green-700 text-white text-xs rounded hover:bg-green-800"
                        title="Archive completed tasks"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clean Up
                      </button>
                    </div>
                    <p className="text-xs text-green-700">
                      {new Date(currentSprint.startDate).toLocaleDateString()} - {new Date(currentSprint.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      {tasks.filter(t => t.sprintId === currentSprint.id && t.status === 'done').length} completed tasks ready to archive
                    </p>
                  </div>
                </div>
              )}
              
              {/* All Sprints */}
              {sprints.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-700 mb-2">All Sprints ({sprints.length})</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {sprints.map(sprint => {
                      const completedTasksCount = tasks.filter(t => t.sprintId === sprint.id && t.status === 'done').length;
                      const totalTasksCount = tasks.filter(t => t.sprintId === sprint.id).length;
                      
                      return (
                        <div key={sprint.id} className="relative p-3 border border-neutral-200 rounded">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{sprint.name}</p>
                              <p className="text-xs text-neutral-500">
                                {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-neutral-600 mt-1">
                                {totalTasksCount} tasks ({completedTasksCount} done)
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {completedTasksCount > 0 && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Archive ${completedTasksCount} completed tasks from "${sprint.name}"? This will permanently delete them.`)) {
                                      archiveCompletedSprintTasks(sprint.id);
                                      showCompletionMessage(`${completedTasksCount} tasks archived from ${sprint.name}`);
                                    }
                                  }}
                                  className="p-1 hover:bg-neutral-100 rounded text-orange-600"
                                  title="Clean up completed tasks"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSprint(sprint.id)}
                                className="p-1 hover:bg-neutral-100 rounded text-red-500"
                                title="Delete sprint"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Archive */}
        <div className="mb-6 border-b border-neutral-200 pb-6">
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h2 className="text-lg font-semibold">Archive</h2>
            {showArchive ? (
              <ChevronUp className="w-5 h-5 text-neutral-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-500" />
            )}
          </button>

          {showArchive && (
            <>
              {/* Retention Period */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Retention Period
                </label>
                <select
                  value={appSettings.archiveRetention || 0}
                  onChange={(e) => updateAppSettings({ archiveRetention: Number(e.target.value) as 30 | 60 | 90 | 0 })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                >
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="0">Unlimited</option>
                </select>
                <p className="text-xs text-neutral-500 mt-1">
                  {appSettings.archiveRetention === 0 
                    ? 'Archived tasks will never be automatically deleted'
                    : `Archived tasks will be automatically deleted after ${appSettings.archiveRetention} days`}
                </p>
              </div>

              {/* Archive Stats */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded mb-4">
                <p className="text-sm text-neutral-700">
                  <span className="font-semibold">{tasks.filter(t => t.archived).length}</span> archived tasks
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {tasks.filter(t => t.archived && !t.archivedAt).length} tasks without archive date
                </p>
              </div>

              {/* Archive All Done Tasks */}
              <button
                onClick={() => {
                  const doneCount = tasks.filter(t => t.status === 'done' && !t.archived).length;
                  if (doneCount > 0 && confirm(`Archive ${doneCount} completed tasks?`)) {
                    archiveAllDoneTasks();
                    showCompletionMessage(`${doneCount} tasks archived`);
                  }
                }}
                className="w-full mb-3 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2"
                disabled={tasks.filter(t => t.status === 'done' && !t.archived).length === 0}
              >
                <Archive className="w-4 h-4" />
                Archive All Completed Tasks ({tasks.filter(t => t.status === 'done' && !t.archived).length})
              </button>

              {/* Delete All Archives */}
              <button
                onClick={() => {
                  const archiveCount = tasks.filter(t => t.archived).length;
                  if (archiveCount > 0 && confirm(`Permanently delete ${archiveCount} archived tasks? This cannot be undone.`)) {
                    deleteArchivedTasks();
                    showCompletionMessage(`${archiveCount} archived tasks deleted`);
                  }
                }}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                disabled={tasks.filter(t => t.archived).length === 0}
              >
                <Trash2 className="w-4 h-4" />
                Delete All Archived Tasks ({tasks.filter(t => t.archived).length})
              </button>
            </>
          )}
        </div>

        {/* Bulk Import */}
        <button
          onClick={() => setShowBulkImport(true)}
          className="w-full px-4 py-3 border-2 border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <Upload className="w-5 h-5" />
          Bulk Import
        </button>

        {/* App Info */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4 space-y-2" data-testid="app-info">
          <h3 className="text-sm font-semibold text-neutral-900">App Info</h3>
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
                  Add Label
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
                  Add Shop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Builder Modal */}
      {showFilterBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Filter</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilterBuilderType('task')}
                    className={`flex-1 px-3 py-2 rounded border text-sm ${
                      filterBuilderType === 'task'
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-white border-neutral-200'
                    }`}
                  >
                    Task
                  </button>
                  <button
                    onClick={() => setFilterBuilderType('item')}
                    className={`flex-1 px-3 py-2 rounded border text-sm ${
                      filterBuilderType === 'item'
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-white border-neutral-200'
                    }`}
                  >
                    Item
                  </button>
                  <button
                    onClick={() => setFilterBuilderType('note')}
                    className={`flex-1 px-3 py-2 rounded border text-sm ${
                      filterBuilderType === 'note'
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-white border-neutral-200'
                    }`}
                  >
                    Note
                  </button>
                </div>
              </div>

              <FilterBuilder 
                type={filterBuilderType} 
                onSave={() => setShowFilterBuilder(false)} 
              />

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowFilterBuilder(false)}
                  className="flex-1 px-4 py-2 border border-neutral-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowFilterBuilder(false)}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded"
                >
                  Add Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkImport onClose={() => setShowBulkImport(false)} />
      )}
    </div>
  );
};