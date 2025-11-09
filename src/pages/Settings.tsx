import { useEffect, useState } from 'react'
import { useUserTheme } from '../hooks/useUserTheme'
import { Users } from '../db/dexieClient'
import { flushDatabase, importMockData } from '../utils/devTools'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { useAuth } from '../store/auth'

export default function Settings() {
  const { color, setColor } = useUserTheme()
  const [hideCompleted, setHideCompleted] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const { isInstallable, isInstalled, promptInstall } = useInstallPrompt()
  const { user, me } = useAuth()

  useEffect(() => {
    setHideCompleted(localStorage.getItem('hideCompleted') === '1')
    const isDark = localStorage.getItem('darkMode') === '1'
    setDarkMode(isDark)
    if (isDark) {
      document.documentElement.classList.add('dark')
    }
    ;(async () => {
      const us = await Users.list()
      const me = us.find((u) => u.id === 'local-user') || us[0]
      if (me) {
        setName(me.name || '')
        setEmail(me.email || '')
      }
    })()
  }, [])

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl space-y-4">
          
          {/* Install PWA Banner */}
          {isInstallable && !isInstalled && (
            <div className="bg-gradient-to-r from-accent to-blue-600 rounded-lg border border-accent p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/>
                    </svg>
                    Install TodoLess
                  </div>
                  <p className="text-sm text-white/90">
                    Use TodoLess as a standalone app without browser UI
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const installed = await promptInstall()
                    if (installed) {
                      alert('✓ App installed! You can now find TodoLess in your app menu.')
                    }
                  }}
                  className="px-4 py-2 bg-white text-accent rounded-lg font-medium hover:bg-gray-100 transition-colors whitespace-nowrap"
                >
                  Install
                </button>
              </div>
            </div>
          )}

          {isInstalled && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span className="font-medium">App installed as PWA</span>
              </div>
            </div>
          )}

          {/* Theme */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="mb-3 text-sm font-semibold">Theme</div>
            <div className="flex items-center gap-3">
              {/* Color changes are applied immediately via CSS variables in useUserTheme hook */}
              <input 
                type="color" 
                value={color} 
                onChange={(e) => setColor(e.target.value)} 
                className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
              />
              <span className="px-3 py-1 rounded-full text-sm border-2 border-accent bg-accent/10 text-accent font-medium">
                Preview
              </span>
            </div>
          </div>

          {/* Profile */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="mb-3 text-sm font-semibold flex items-center gap-3">Profile
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-xs font-semibold" title="Initial preview">
                {(name?.[0] || 'U').toUpperCase()}
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Name</label>
                <input 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Email</label>
                <input 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                />
              </div>
              <button
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-accent text-white hover:opacity-90 transition-opacity"
                title="Save"
                onClick={async () => {
                  // Update local Dexie cache immediately
                  await Users.update('local-user', { name: name || 'You', email: email || undefined })
                  // Also call server profile update so auth cookie reflects new username
                  try {
                    await fetch('/api/auth/profile', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ username: name || undefined, email: email || undefined })
                    })
                  } catch {}
                  // Rename any local user entries that match old server username to the new one to avoid duplicates
                  try {
                    const all = await Users.list()
                    const oldName = user?.username
                    if (oldName && name && oldName !== name) {
                      const matches = all.filter(u => (u.name || '').toLowerCase() === oldName.toLowerCase())
                      for (const u of matches) {
                        await Users.update(u.id, { name })
                      }
                    }
                  } catch {}
                  // Force refresh of auth user (so avatar initial updates)
                  await me().catch(() => {})
                  alert('Profile saved')
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Security - Password Change */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="mb-3 text-sm font-semibold">Security</div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Current Password</label>
                <input 
                  type="password"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40" 
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)} 
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">New Password</label>
                <input 
                  type="password"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Confirm New Password</label>
                <input 
                  type="password"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  placeholder="Re-enter new password"
                />
              </div>
              <button
                className="px-4 py-2 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                disabled={!currentPassword || !newPassword || !confirmPassword}
                onClick={async () => {
                  if (newPassword !== confirmPassword) {
                    alert('New passwords do not match')
                    return
                  }
                  if (newPassword.length < 6) {
                    alert('New password must be at least 6 characters')
                    return
                  }
                  try {
                    const res = await fetch('/api/auth/change-password', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ currentPassword, newPassword })
                    })
                    const data = await res.json()
                    if (!res.ok) {
                      if (data.error === 'invalid_current_password') {
                        alert('Current password is incorrect')
                      } else if (data.error === 'password_too_short') {
                        alert('New password must be at least 6 characters')
                      } else {
                        alert('Failed to change password: ' + (data.error || 'unknown error'))
                      }
                      return
                    }
                    alert('✓ Password changed successfully')
                    setCurrentPassword('')
                    setNewPassword('')
                    setConfirmPassword('')
                  } catch (e) {
                    alert('Failed to change password. Please try again.')
                  }
                }}
              >
                Change Password
              </button>
            </div>
          </div>
            {/* TEST-ONLY: 2FA Optie */}
            {/* TEST-ONLY: 2FA Optie (HOLD) - alleen zichtbaar in test/dev, niet in productie */}
            {import.meta.env.DEV && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="mb-3 text-sm font-semibold flex items-center gap-2">2FA (Twee-factor authenticatie)
                  <span className="px-2 py-0.5 text-[10px] rounded bg-yellow-100 text-yellow-800 border-yellow-200" title="Alleen zichtbaar in test/dev">TEST ONLY</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" disabled className="rounded" />
                    2FA inschakelen (hold)
                  </label>
                  <span className="text-xs text-gray-400">Functie staat on hold, backend volgt in toekomst</span>
                </div>
              </div>
            )}

          {/* Display */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="mb-3 text-sm font-semibold">Display</div>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={(e) => {
                    const v = e.target.checked
                    setDarkMode(v)
                    localStorage.setItem('darkMode', v ? '1' : '0')
                    if (v) {
                      document.documentElement.classList.add('dark')
                    } else {
                      document.documentElement.classList.remove('dark')
                    }
                  }}
                  className="rounded"
                />
                Dark mode
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hideCompleted}
                  onChange={(e) => {
                    const v = e.target.checked
                    setHideCompleted(v)
                    localStorage.setItem('hideCompleted', v ? '1' : '0')
                  }}
                  className="rounded"
                />
                Hide completed items
              </label>
            </div>
          </div>

          {/* Data Management */}
          {/* TEST-ONLY: Development data management tools - hidden in production */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="mb-3 text-sm font-semibold flex items-center gap-2">Data <span className="px-2 py-0.5 text-[10px] rounded bg-yellow-100 text-yellow-800 border border-yellow-200" title="Only visible in development builds">TEST ONLY</span></div>
            {import.meta.env.DEV ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50"
                onClick={async () => {
                  const ok = confirm('This will remove ALL local data (labels, todos, notes, views, etc.). Continue?')
                  if (!ok) return
                  await flushDatabase()
                  alert('Database flushed. Minimal defaults restored.')
                }}
                title="Remove all local data"
              >
                Flush database
              </button>
              <button
                className="px-3 py-2 rounded-md border text-sm bg-accent text-white hover:opacity-90"
                onClick={async () => {
                  const ok = confirm('Import mock data? This will clear existing local data first.')
                  if (!ok) return
                  await importMockData()
                  alert('Mock data imported!')
                }}
                title="Clear and load mock data"
              >
                Import mock data
              </button>
            </div>
            ) : (
              <p className="text-xs text-gray-400">Test data tools hidden in production.</p>
            )}
            {import.meta.env.DEV && <p className="mt-2 text-xs text-gray-500">These actions only affect your local browser database (IndexedDB). Remote/server data is not touched.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
