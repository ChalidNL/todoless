import { useEffect, useState } from 'react'
import { useAuth } from '../../store/auth'
import { useLocation, useNavigate } from 'react-router-dom'

function useQuery() {
  const { search } = useLocation()
  return new URLSearchParams(search)
}

export default function ResetCompletePage() {
  const { completeReset } = useAuth()
  const q = useQuery()
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const t = q.get('token')
    if (t) setToken(t)
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token) return setError('Missing token')
    if (!password || password.length < 6) return setError('Password must be at least 6 characters')
    if (password !== confirm) return setError('Passwords do not match')
    try {
      await completeReset(token, password)
      setDone(true)
      setTimeout(() => navigate('/auth/login'), 1200)
    } catch (e: any) {
      setError(e?.message || 'reset_failed')
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="mt-2 text-gray-800 text-lg font-semibold">TodoLess</div>
          <div className="text-gray-500 text-sm">Wachtwoord resetten</div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          {done ? (
            <div className="text-sm text-green-700">Password changed. Redirecting to sign in…</div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reset token</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Paste the token from the admin"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors">Change password</button>
            </form>
          )}
        </div>
        <div className="mt-3 text-center text-xs text-gray-500">Ask your admin for a reset token if you don’t have one yet.</div>
      </div>
    </div>
  )
}
