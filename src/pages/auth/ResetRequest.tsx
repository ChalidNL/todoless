import { useState } from 'react'
import { useAuth } from '../../store/auth'

export default function ResetRequestPage() {
  const { requestReset } = useAuth()
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await requestReset(usernameOrEmail)
      setSubmitted(true)
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
          <div className="text-gray-500 text-sm">Request password reset</div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          {submitted ? (
            <div className="text-sm text-gray-700">Request sent. An adult (admin) must approve it. Once approved, you’ll receive a reset token from the admin.</div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username or email</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. admin or admin@example.com"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  autoFocus
                />
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors">Submit request</button>
            </form>
          )}
        </div>
        <div className="mt-3 text-center text-xs text-gray-500">Tip: ask an adult (admin) to review and approve your reset request.</div>
      </div>
    </div>
  )
}
