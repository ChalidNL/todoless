import { useState } from 'react'
import { useAuth } from '../../store/auth'
import { useNavigate } from 'react-router-dom'

const APP_VERSION = '0.0.1' // Sync with package.json

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [twofaRequired, setTwofaRequired] = useState(false)
  const { login, error } = useAuth()
  const navigate = useNavigate()
  /* TEST-ONLY: Debug state for login API */
  const [debug, setDebug] = useState<any>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const userFromForm = (fd.get('username') as string | null)?.trim() || ''
    const passFromForm = (fd.get('password') as string | null) || ''
    const codeFromForm = (fd.get('code') as string | null) || ''
    const u = userFromForm || username
    const p = passFromForm || password
    const c = (twofaRequired ? (codeFromForm || code) : undefined) as string | undefined

    /* TEST-ONLY: Debug info for login request */
    if (import.meta.env.DEV) {
      setDebug({
        request: { username: u, password: p, code: c },
        started: new Date().toISOString(),
      })
    }
    let res, debugInfo = {}
    try {
      res = await fetch(import.meta.env.DEV ? 'http://192.168.2.123:4000/api/auth/login' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: u, password: p, code: c }),
      })
      debugInfo = {
        status: res.status,
        ok: res.ok,
        url: res.url,
        headers: Object.fromEntries(res.headers.entries()),
      }
      let body
      try { body = await res.clone().json() } catch { body = await res.clone().text() }
      debugInfo.body = body
    } catch (err) {
      debugInfo = { error: String(err) }
    }
    if (import.meta.env.DEV) setDebug((d: any) => ({ ...d, response: debugInfo, ended: new Date().toISOString() }))
    if (res && res.ok) {
      setTwofaRequired(false)
      navigate('/dashboard', { replace: true })
    } else if (res && res.status === 401 && debugInfo.body?.twofaRequired) {
      setTwofaRequired(true)
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* TEST-ONLY: Debug overlay for login API */}
        {import.meta.env.DEV && debug && (
          <div style={{position:'fixed',top:10,right:10,zIndex:1000,maxWidth:400,background:'#fff',border:'2px solid #f00',borderRadius:8,padding:12,fontSize:12,boxShadow:'0 2px 8px #0002'}}>
            <div style={{fontWeight:'bold',color:'#d00'}}>TEST-ONLY: Login Debug</div>
            <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-word',fontSize:11}}>{JSON.stringify(debug,null,2)}</pre>
            <button style={{marginTop:8,padding:'2px 8px',fontSize:12}} onClick={()=>setDebug(null)}>Sluiten</button>
          </div>
        )}
  <div className="mb-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800">
            {/* Line icon: checkbox in a square */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="mt-2 text-gray-800 text-lg font-semibold">TodoLess</div>
          {/* TEST-ONLY: Development environment version and test indicator */}
          {import.meta.env.DEV && (
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-[10px] text-gray-500">v{APP_VERSION}</span>
              <span className="text-[10px] font-bold text-red-600 tracking-wide">TEST</span>
            </div>
          )}
          <div className="text-gray-500 text-sm">Secure local login</div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <h1 className="text-xl font-semibold mb-4">Sign in</h1>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                name="username"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  name="password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
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
                  name="code"
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
      </div>
    </div>
  )
}
