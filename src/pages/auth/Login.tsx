import { useState } from 'react'
import { useAuth } from '../../store/auth'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [twofaRequired, setTwofaRequired] = useState(false)
  const { login, error } = useAuth()
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await login({ username, password, code: twofaRequired ? code : undefined })
    if ((res as any)?.twofaRequired) {
      setTwofaRequired(true)
      return
    }
  navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
  <div className="mb-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800">
            {/* Line icon: checkbox in a square */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="mt-2 text-gray-800 text-lg font-semibold">TodoLess</div>
          <div className="text-gray-500 text-sm">Secure local login</div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <h1 className="text-xl font-semibold mb-4">Sign in</h1>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            {twofaRequired && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">2FA code</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            )}
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors">Sign in</button>
            <div className="flex items-center justify-between text-sm text-gray-600 mt-1">
              <a href="/auth/reset" className="text-blue-600 hover:underline">Forgot password?</a>
              <a href="/auth/accept" className="text-blue-600 hover:underline">Accept invitation</a>
            </div>
          </form>
        </div>
        <div className="mt-3 text-center text-xs text-gray-500">
          Tip: first time? Sign in with <span className="font-semibold">admin</span> / <span className="font-semibold">admin123</span> (default), then change it.
        </div>
      </div>
    </div>
  )
}
