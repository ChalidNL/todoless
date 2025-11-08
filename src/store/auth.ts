import { create } from 'zustand'
import { clearLocalData } from '../db/dexieClient'
import { syncTasksFromServer, startRealtimeSync, stopRealtimeSync, pushPendingTodos } from '../utils/syncTasks'

export type Role = 'adult' | 'child'
export interface UserInfo { id: number; username: string; email?: string | null; role: Role; twofa_enabled?: boolean }

interface AuthState {
  user: UserInfo | null
  loading: boolean
  error: string | null
  ready: boolean // true after first session check completes
  me: () => Promise<void>
  login: (payload: { username: string; password: string; code?: string }) => Promise<{ twofaRequired?: boolean } | void>
  logout: () => Promise<void>
  // Registration is disabled; use acceptInvite instead
  // register: (payload: { username: string; email?: string; password: string; role?: Role }) => Promise<void>
  acceptInvite: (payload: { code: string; username: string; email?: string; password: string }) => Promise<void>
  enable2fa: (username: string) => Promise<{ qr: string; secret: string }>
  verify2fa: (username: string, code: string) => Promise<void>
  disable2fa: (username: string) => Promise<void>
  // Invites (admin)
  listInvites: () => Promise<Invite[]>
  createInvite: (role?: Role) => Promise<Invite>
  revokeInvite: (code: string) => Promise<void>
  // Password reset (user + admin)
  requestReset: (usernameOrEmail: string) => Promise<void>
  listResetRequests: () => Promise<ResetRequest[]>
  approveReset: (id: string) => Promise<{ token: string; expires_at: string }>
  denyReset: (id: string) => Promise<void>
  completeReset: (token: string, newPassword: string) => Promise<void>
}

// Resolve API base: prefer explicit VITE_API_URL, otherwise use current host (works for LAN/mobile)
const API = (import.meta as any).env?.VITE_API_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:4000` : 'http://localhost:4000')

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(json.error || 'request_failed'), { response: json })
  return json
}

type Setter = (partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>)) => void
type Getter = () => AuthState

export const useAuth = create<AuthState>((set: Setter, get: Getter) => ({
  user: null,
  loading: false,
  error: null,
  ready: false,
  me: async () => {
    set({ loading: true, error: null })
    try {
      const { user } = await api('/api/auth/me')
      set({ user, loading: false, ready: true })
      // Sync tasks after we know who the user is
      if (user) {
        // Pull down server tasks then push any local-only items
        syncTasksFromServer(user).then(() => pushPendingTodos().catch(() => {})).catch(() => {})
        startRealtimeSync(user)
      } else {
        stopRealtimeSync()
      }
    } catch (e: any) {
      set({ error: e.message, user: null, loading: false, ready: true })
    }
  },
  login: async (payload: { username: string; password: string; code?: string }) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (res.status === 401) {
        const body = await res.json().catch(() => ({}))
        if (body.twofaRequired) {
          set({ loading: false })
          return { twofaRequired: true }
        }
      }
      if (!res.ok) throw new Error('login_failed')
      await get().me()
      set({ loading: false, ready: true })
    } catch (e: any) {
      set({ error: e.message, loading: false, ready: true })
    }
  },
  logout: async () => {
    await api('/api/auth/logout', { method: 'POST' })
    try { await clearLocalData() } catch (_) {}
    stopRealtimeSync()
    set({ user: null, ready: true })
  },
  acceptInvite: async (payload: { code: string; username: string; email?: string; password: string }) => {
    await api('/api/auth/accept', { method: 'POST', body: JSON.stringify(payload) })
  },
  enable2fa: async (username: string) => {
    return api('/api/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ username }) })
  },
  verify2fa: async (username: string, code: string) => {
    await api('/api/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ username, code }) })
    await get().me()
  },
  disable2fa: async (username: string) => {
    await api('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ username }) })
    await get().me()
  },
  // Invites (admin)
  listInvites: async () => {
    const { invites } = await api('/api/auth/admin/invites')
    return invites as Invite[]
  },
  createInvite: async (role?: Role) => {
    const res = await api('/api/auth/invite', { method: 'POST', body: JSON.stringify({ role }) })
    return res as Invite
  },
  revokeInvite: async (code: string) => {
    await api(`/api/auth/admin/invites/${encodeURIComponent(code)}/revoke`, { method: 'POST' })
  },
  // Password reset
  requestReset: async (usernameOrEmail: string) => {
    await api('/api/auth/reset/request', { method: 'POST', body: JSON.stringify({ usernameOrEmail }) })
  },
  listResetRequests: async () => {
    const { items } = await api('/api/auth/admin/reset-requests')
    return items as ResetRequest[]
  },
  approveReset: async (id: string) => {
    return api(`/api/auth/admin/reset-requests/${encodeURIComponent(id)}/approve`, { method: 'POST' })
  },
  denyReset: async (id: string) => {
    await api(`/api/auth/admin/reset-requests/${encodeURIComponent(id)}/deny`, { method: 'POST' })
  },
  completeReset: async (token: string, newPassword: string) => {
    await api('/api/auth/reset/complete', { method: 'POST', body: JSON.stringify({ token, newPassword }) })
  },
}))

// Types for admin/management features
export interface Invite {
  code: string
  role: Role
  created_by?: number
  created_at?: string
  expires_at?: string | null
  used_by?: number | null
  used_at?: string | null
}

export interface ResetRequest {
  id: string
  user_id: number
  username?: string
  status: 'pending' | 'approved' | 'denied' | 'done'
  created_at: string
  approved_by?: number | null
  approved_at?: string | null
  token?: string | null
  expires_at?: string | null
  used_at?: string | null
}
