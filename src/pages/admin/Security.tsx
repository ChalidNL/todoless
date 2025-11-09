import { useEffect, useMemo, useState } from 'react'
import { Invite, ResetRequest, Role, useAuth } from '../../store/auth'
import { Navigate } from 'react-router-dom'

function Badge({ color, children }: { color: 'yellow'|'green'|'red'|'gray'|'blue'; children: any }) {
  const map: Record<string, string> = {
    yellow: 'bg-yellow-100 text-yellow-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[color]}`}>{children}</span>
}

export default function SecurityCenterPage() {
  const { user, listInvites, createInvite, revokeInvite, listResetRequests, approveReset, denyReset, listUsers, blockUser } = useAuth()
  const [tab, setTab] = useState<'invites'|'resets'|'users'>('invites')
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [invites, setInvites] = useState<Invite[]>([])
  const [loadingInv, setLoadingInv] = useState(false)
  const [items, setItems] = useState<ResetRequest[]>([])
  const [loadingRes, setLoadingRes] = useState(false)
  const [creating, setCreating] = useState(false)
  const [role, setRole] = useState<Role>('child')
  const [justApproved, setJustApproved] = useState<{ id: string; token: string; expires_at: string } | null>(null)

  useEffect(() => {
  if (tab === 'invites') refreshInvites()
  if (tab === 'resets') refreshResets()
  if (tab === 'users') refreshUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function refreshInvites() {
    setLoadingInv(true)
    try { setInvites(await listInvites()) } finally { setLoadingInv(false) }
  }
  async function refreshResets() {
    setLoadingRes(true)
    try { setItems(await listResetRequests()) } finally { setLoadingRes(false) }
  }

  async function refreshUsers() {
    setLoadingUsers(true)
    try { setUsers(await listUsers()) } finally { setLoadingUsers(false) }
  }

  async function onCreate() {
    setCreating(true)
    try {
      await createInvite(role)
      await refreshInvites()
    } finally { setCreating(false) }
  }

  if (!user) return <div className="p-4">Loading…</div>
  if (user.role !== 'adult') return <Navigate to="/" replace />

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Security Center</h1>
      <div className="flex gap-2 mb-4">
        <button className={`px-3 py-1.5 rounded border ${tab==='invites'?'bg-gray-900 text-white':'hover:bg-gray-50'}`} onClick={() => setTab('invites')}>Invites</button>
        <button className={`px-3 py-1.5 rounded border ${tab==='resets'?'bg-gray-900 text-white':'hover:bg-gray-50'}`} onClick={() => setTab('resets')}>Reset requests</button>
        <button className={`px-3 py-1.5 rounded border ${tab==='users'?'bg-gray-900 text-white':'hover:bg-gray-50'}`} onClick={() => setTab('users')}>Users</button>
      </div>
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2">ID</th>
                  <th className="p-2">Username</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Status</th>
                  <th className="p-2"/>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td className="p-2" colSpan={6}>Loading…</td></tr>
                ) : users.length === 0 ? (
                  <tr><td className="p-2" colSpan={6}>No users</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2 font-mono text-xs break-all">{u.id}</td>
                    <td className="p-2">{u.username}</td>
                    <td className="p-2">{u.email || '-'}</td>
                    <td className="p-2">{u.role}</td>
                    <td className="p-2">{u.blocked ? <Badge color="red">blocked</Badge> : <Badge color="green">active</Badge>}</td>
                    <td className="p-2 text-right">
                      <button className="px-2 py-1 text-xs rounded border hover:bg-gray-50 disabled:opacity-50" disabled={u.blocked} onClick={async ()=>{ await blockUser(u.id); await refreshUsers() }}>Block</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'invites' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select className="border rounded px-2 py-1" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="child">child</option>
              <option value="adult">adult</option>
            </select>
            <button className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-60" onClick={onCreate} disabled={creating}>{creating?'Please wait…':'New invite'}</button>
          </div>
          <div className="border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2">Code</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Expires</th>
                  <th className="p-2">Used by</th>
                  <th className="p-2"/>
                </tr>
              </thead>
              <tbody>
                {loadingInv ? (
                  <tr><td className="p-2" colSpan={6}>Loading…</td></tr>
                ) : invites.length === 0 ? (
                  <tr><td className="p-2" colSpan={6}>No invites</td></tr>
                ) : invites.map(inv => (
                  <tr key={inv.code} className="border-t">
                    <td className="p-2 font-mono text-xs break-all">{inv.code}</td>
                    <td className="p-2">{inv.role}</td>
                    <td className="p-2">{inv.created_at?.slice(0,19).replace('T',' ')}</td>
                    <td className="p-2">{inv.expires_at ? inv.expires_at.slice(0,19).replace('T',' ') : '-'}</td>
                    <td className="p-2">{inv.used_by ? <Badge color="green">used</Badge> : <Badge color="blue">open</Badge>}</td>
                    <td className="p-2 text-right">
                      <button className="px-2 py-1 text-xs rounded border hover:bg-gray-50 mr-2" onClick={() => navigator.clipboard?.writeText(inv.code || '')}>Copy</button>
                      <button className="px-2 py-1 text-xs rounded border hover:bg-gray-50 disabled:opacity-50" disabled={!!inv.used_by} onClick={async ()=>{ await revokeInvite(inv.code); await refreshInvites() }}>Revoke</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'resets' && (
        <div className="space-y-4">
          {justApproved && (
            <div className="p-3 rounded bg-green-50 text-green-800 text-sm">
              Token generated for request {justApproved.id}. Token (copy and share with the user):
              <div className="mt-1 font-mono text-xs break-all">{justApproved.token}</div>
              <div className="text-xs">Expires: {new Date(justApproved.expires_at).toLocaleString()}</div>
              <div className="mt-2">
                <button className="px-2 py-1 text-xs rounded border hover:bg-gray-50" onClick={() => navigator.clipboard?.writeText(justApproved.token)}>Copy token</button>
              </div>
            </div>
          )}
          <div className="border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2">ID</th>
                  <th className="p-2">User</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Expires</th>
                  <th className="p-2"/>
                </tr>
              </thead>
              <tbody>
                {loadingRes ? (
                  <tr><td className="p-2" colSpan={6}>Loading…</td></tr>
                ) : items.length === 0 ? (
                  <tr><td className="p-2" colSpan={6}>No requests</td></tr>
                ) : items.map(it => (
                  <tr key={it.id} className="border-t">
                    <td className="p-2 font-mono text-xs break-all">{it.id}</td>
                    <td className="p-2">{it.username || it.user_id}</td>
                    <td className="p-2">
                      {it.status === 'pending' && <Badge color="yellow">pending</Badge>}
                      {it.status === 'approved' && <Badge color="green">approved</Badge>}
                      {it.status === 'denied' && <Badge color="red">denied</Badge>}
                      {it.status === 'done' && <Badge color="gray">done</Badge>}
                    </td>
                    <td className="p-2">{it.created_at ? it.created_at.slice(0,19).replace('T',' ') : '-'}</td>
                    <td className="p-2">{it.expires_at ? it.expires_at.slice(0,19).replace('T',' ') : '-'}</td>
                    <td className="p-2 text-right space-x-2">
                      {it.status === 'pending' && (
                        <>
                          <button className="px-2 py-1 text-xs rounded border hover:bg-gray-50" onClick={async ()=>{ const res = await approveReset(it.id); setJustApproved({ id: it.id, token: res.token, expires_at: res.expires_at }); await refreshResets() }}>Approve</button>
                          <button className="px-2 py-1 text-xs rounded border hover:bg-gray-50" onClick={async ()=>{ await denyReset(it.id); await refreshResets() }}>Deny</button>
                        </>
                      )}
                      {it.status === 'approved' && it.token && (
                        <button className="px-2 py-1 text-xs rounded border hover:bg-gray-50" onClick={() => navigator.clipboard?.writeText(it.token!)}>Copy token</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
