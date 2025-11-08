import { Navigate } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { useEffect } from 'react'

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, me, ready } = useAuth()
  useEffect(() => {
    if (!ready) {
      me().catch(() => {})
    }
  }, [ready])
  if (!ready) return <div className="p-4 text-sm">Loading…</div>
  if (!user) return <Navigate to="/auth/login" replace />
  return children
}
