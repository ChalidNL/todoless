import { useEffect, useState } from 'react'
import { useAuth } from '../store/auth'

type ApiToken = {
  id: number
  name: string
  user_id: number
  created_by: number
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  revoked: boolean
  token_preview: string
}

type User = {
  id: number
  username: string
  email: string
  role: string
}

export default function ApiTokens() {
  const { user } = useAuth()
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    name: '',
    user_id: 0,
    expires_at: ''
  })

  const loadTokens = async () => {
    try {
      const res = await fetch('/api/tokens', {
        credentials: 'include'
      })
      if (!res.ok) {
        if (res.status === 403) {
          setError('Admin access required')
          return
        }
        throw new Error('Failed to load tokens')
      }
      const data = await res.json()
      setTokens(data.items || [])
    } catch (err) {
      setError(String(err))
    }
  }

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to load users')
      const data = await res.json()
      setUsers(data.items || [])
      // Set default user_id to current user
      if (user && data.items.length > 0) {
        const currentUser = data.items.find((u: User) => u.username === user.username)
        if (currentUser) {
          setCreateForm(prev => ({ ...prev, user_id: currentUser.id }))
        }
      }
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([loadTokens(), loadUsers()])
      setLoading(false)
    }
    load()
  }, [])

  const handleCreateToken = async () => {
    if (!createForm.name.trim()) {
      alert('Token name is required')
      return
    }
    if (!createForm.user_id) {
      alert('Please select a user')
      return
    }

    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: createForm.name.trim(),
          user_id: createForm.user_id,
          expires_at: createForm.expires_at || null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create token')
      }

      const data = await res.json()
      setNewToken(data.token)
      setCreateForm({ name: '', user_id: createForm.user_id, expires_at: '' })
      await loadTokens()
    } catch (err) {
      alert('Failed to create token: ' + String(err))
    }
  }

  const handleRevokeToken = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/tokens/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!res.ok) {
        throw new Error('Failed to revoke token')
      }

      await loadTokens()
    } catch (err) {
      alert('Failed to revoke token: ' + String(err))
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('✓ Token copied to clipboard!')
    }).catch(() => {
      alert('Failed to copy to clipboard')
    })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <h1 className="text-xl font-semibold">API Tokens</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <h1 className="text-xl font-semibold">API Tokens</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">API Tokens</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Token
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-6xl">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800 mb-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
              <div className="flex-1">
                <div className="font-semibold mb-1">About API Tokens</div>
                <div className="text-sm space-y-1">
                  <p>API tokens allow programmatic access to the TodoLess API. Use them for automation, integrations, and third-party apps.</p>
                  <p className="font-medium">Usage: Include the token in the Authorization header as <code className="bg-blue-100 px-1 rounded">Bearer tdl_...</code></p>
                  <p className="text-xs text-blue-700 mt-2">Note: Tokens bypass 2FA requirements and remain valid until revoked or expired.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tokens List */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Token Preview</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Used</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Expires</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                      No API tokens yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  tokens.map((token) => {
                    const tokenUser = users.find(u => u.id === token.user_id)
                    const isExpired = token.expires_at && new Date(token.expires_at) < new Date()
                    return (
                      <tr key={token.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{token.name}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{token.token_preview}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{tokenUser?.username || `#${token.user_id}`}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(token.created_at)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(token.last_used_at)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{token.expires_at ? formatDate(token.expires_at) : 'Never'}</td>
                        <td className="px-4 py-3">
                          {token.revoked ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 font-medium">Revoked</span>
                          ) : isExpired ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800 font-medium">Expired</span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!token.revoked && (
                            <button
                              onClick={() => handleRevokeToken(token.id)}
                              className="px-3 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors font-medium"
                              title="Revoke this token"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Token Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Create API Token</h2>
              <button
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
                onClick={() => setShowCreateModal(false)}
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Token Name *</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Home Assistant Integration"
                />
                <p className="text-xs text-gray-500 mt-1">A descriptive name to identify this token</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User *</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  value={createForm.user_id}
                  onChange={(e) => setCreateForm({ ...createForm, user_id: parseInt(e.target.value) })}
                >
                  <option value={0}>Select a user...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Token will have access as this user</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date (Optional)</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  value={createForm.expires_at}
                  onChange={(e) => setCreateForm({ ...createForm, expires_at: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for no expiration</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateToken}
                className="px-4 py-2 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Create Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Token Modal (shown only once after creation) */}
      {newToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-green-700">Token Created Successfully!</h2>
              <button
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
                onClick={() => setNewToken(null)}
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                  </svg>
                  <div className="flex-1">
                    <div className="font-semibold text-yellow-800 mb-1">Important: Save Your Token Now!</div>
                    <p className="text-sm text-yellow-700">This is the only time you will see this token. Copy it now and store it securely.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your API Token:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={newToken}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono bg-gray-50"
                  />
                  <button
                    onClick={() => copyToClipboard(newToken)}
                    className="px-4 py-2 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity text-sm font-medium whitespace-nowrap"
                  >
                    Copy Token
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-800 space-y-2">
                  <p className="font-semibold">Example Usage:</p>
                  <pre className="bg-blue-100 p-2 rounded text-xs overflow-x-auto">
{`curl -H "Authorization: Bearer ${newToken}" \\
     http://localhost:4000/api/tasks`}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
              <button
                onClick={() => setNewToken(null)}
                className="px-4 py-2 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity text-sm font-medium"
              >
                I've Saved My Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
