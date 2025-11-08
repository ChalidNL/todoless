import { useState } from 'react'
import { useAuth } from '../../store/auth'
import { useNavigate } from 'react-router-dom'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'adult'|'child'>('adult')
  const { register, error } = useAuth()
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await register({ username, email, password, role })
    navigate('/auth/login')
  }

  return (
    <div className="max-w-sm mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Register</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className="border rounded px-3 py-2" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="border rounded px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border rounded px-3 py-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <input type="radio" checked={role==='adult'} onChange={() => setRole('adult')} /> Adult
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={role==='child'} onChange={() => setRole('child')} /> Child
          </label>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="bg-blue-600 text-white px-3 py-2 rounded">Create account</button>
      </form>
    </div>
  )
}
