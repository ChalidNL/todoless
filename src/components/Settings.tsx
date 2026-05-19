import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';
import { User } from '../types';
import { ChevronDown, ChevronUp, Plus, Edit2, Trash2, X, LogOut, Eye, EyeOff, Copy } from 'lucide-react';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { LabelBadge } from './shared/LabelBadge';
import { TopBar } from './shared/TopBar';
import { InviteManager } from './InviteManager';

export const Settings = () => {
  const { users, appSettings, updateAppSettings, updateUser, deleteUser, labels, addLabel, updateLabel, deleteLabel, shops, addShop, updateShop, deleteShop, tasks, showCompletionMessage } = useApp();
  const { signOut } = useAuth();
  const appVersion = 'dev';
  const appCommitRaw = import.meta.env.VITE_GIT_COMMIT || 'local';
  const appCommit = appCommitRaw === 'local' ? 'local' : appCommitRaw.slice(0, 7);
  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showShops, setShowShops] = useState(false);
  const [showTeamMembers, setShowTeamMembers] = useState(false);
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

  const currentUser = users.find(u => u.id === appSettings.currentUserId);

  const handlePasswordChange = () => {
    if (!currentUser || !newPassword) return;
    updateUser(currentUser.id, { password: newPassword } as Partial<User>);
    setNewPassword('');
    setEditingPassword(false);
    setShowPassword(false);
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

            {/* Role Display */}
            <div>
              <label className="block text-sm text-neutral-600 mb-2">Role</label>
              {currentUser.role === 'admin' ? (
                <div className="p-3 bg-neutral-100 border border-neutral-200 rounded text-sm text-neutral-600">
                  Admin
                </div>
              ) : currentUser.role === 'assistant' ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                  Assistant
                </div>
              ) : (
                <div className="p-3 bg-neutral-100 border border-neutral-200 rounded text-sm text-neutral-600">
                  User
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
                        <span className="text-[11px] px-2 py-1 rounded bg-green-100 text-green-700">active</span>
                      ) : (
                        <span className="text-[11px] px-2 py-1 rounded bg-red-100 text-red-700">blocked</span>
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

        {/* App Info */}
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
    </div>
  );
};
