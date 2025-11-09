import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const API = (import.meta as any).env?.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000')

export default function AcceptInvitePage() {
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') || '')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string|null>(null)
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch(`${API}/api/auth/accept`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, username, email, password }) })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'failed')
      return
    }
    navigate('/auth/login')
  }

  return (
    <div className="max-w-sm mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Accept Invite</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className="border rounded px-3 py-2" placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} />
        <input className="border rounded px-3 py-2" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="border rounded px-3 py-2" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border rounded px-3 py-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="bg-blue-600 text-white px-3 py-2 rounded">Create account</button>
      </form>
    </div>
  )
}
