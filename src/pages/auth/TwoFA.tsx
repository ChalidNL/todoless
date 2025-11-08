import { useState } from 'react'
import { useAuth } from '../../store/auth'

export default function TwoFASettings() {
  const { user, enable2fa, verify2fa, disable2fa } = useAuth()
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')

  if (!user) return <div className="p-4">Not logged in</div>

  async function onEnable() {
    const res = await enable2fa(user.username)
    setQr(res.qr)
    setSecret(res.secret)
  }

  async function onVerify() {
    await verify2fa(user!.username, code)
    setQr(null); setSecret(null); setCode('')
  }

  async function onDisable() {
    await disable2fa(user!.username)
    setQr(null); setSecret(null); setCode('')
  }

  return (
    <div className="max-w-sm mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Two-Factor Authentication</h1>
      {user.twofa_enabled ? (
        <div className="flex flex-col gap-3">
          <div className="text-green-700">2FA is enabled</div>
          <button className="bg-gray-200 px-3 py-2 rounded" onClick={onDisable}>Disable 2FA</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {!qr ? (
            <button className="bg-blue-600 text-white px-3 py-2 rounded" onClick={onEnable}>Enable 2FA</button>
          ) : (
            <div className="flex flex-col gap-3">
              <img src={qr} className="w-48 h-48 self-center" />
              <input className="border rounded px-3 py-2" placeholder="Enter code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="bg-blue-600 text-white px-3 py-2 rounded" onClick={onVerify}>Verify</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
