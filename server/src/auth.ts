import { Router, type Request, type Response } from 'express'
import { db, UserRow } from './db'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { generateTOTPSecret, toDataURL, verifyTOTP } from './utils/totp'
import rateLimit from 'express-rate-limit'
import { logger } from './logger'
import { requireAuth, requireRole } from './middleware'

export function authRouter(secret: string) {
  const router = Router()

  const limiter = rateLimit({ windowMs: 60_000, max: 5 })

  function issueCookie(res: any, payload: any) {
    const token = jwt.sign(payload, secret, { expiresIn: '7d' })
    const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production'
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
  }

  // Disable open registration. Only allow if there are no users (initial install), which we seed anyway.
  router.post('/register', async (_req, res) => {
    return res.status(403).json({ error: 'registration_disabled' })
  })

  router.post('/login', limiter, async (req, res) => {
    const { username, password, code } = req.body as { username: string; password: string; code?: string }
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
    if (!user) return res.status(401).json({ error: 'invalid_credentials' })
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' })

    if (user.twofa_enabled) {
      if (!code || !user.twofa_secret || !verifyTOTP(user.twofa_secret, code)) {
        // Signal 2FA required
        return res.status(401).json({ twofaRequired: true })
      }
    }

    issueCookie(res, { id: user.id, username: user.username, role: user.role, twofa_enabled: !!user.twofa_enabled, twofa_verified: !!user.twofa_enabled })
    logger.info('auth:login', { username })
    return res.json({ ok: true })
  })

  router.post('/logout', (req, res) => {
    res.clearCookie('token', { path: '/' })
    logger.info('auth:logout', {})
    return res.json({ ok: true })
  })

  router.get('/me', (req, res) => {
    try {
      const token = req.cookies?.token
      if (!token) return res.json({ user: null })
      const data = jwt.verify(token, secret) as any
      const u = db.prepare('SELECT id, username, email, role, twofa_enabled FROM users WHERE id = ?').get(data.id) as any
      if (!u) return res.json({ user: null })
      return res.json({ user: { id: u.id, username: u.username, email: u.email, role: u.role, twofa_enabled: !!u.twofa_enabled } })
    } catch {
      return res.json({ user: null })
    }
  })

  // Create invite (adult only)
  router.post('/invite', requireAuth(secret), requireRole('adult'), (req, res) => {
    const { role } = req.body as { role?: 'adult'|'child' }
    const code = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
    const now = new Date()
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
    db.prepare('INSERT INTO invites (code, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(code, role || 'child', (req as any).user!.id, now.toISOString(), expires.toISOString())
    logger.info('auth:invite_created', { by: (req as any).user!.id, role: role || 'child' })
    return res.json({ code, role: role || 'child', expires_at: expires.toISOString() })
  })

  // Accept invite → create account
  router.post('/accept', async (req, res) => {
    const { code, username, email, password } = req.body as { code: string; username: string; email?: string; password: string }
    if (!code || !username || !password) return res.status(400).json({ error: 'missing_fields' })
    const inv = db.prepare('SELECT * FROM invites WHERE code = ?').get(code) as any
    if (!inv) return res.status(400).json({ error: 'invalid_code' })
    if (inv.used_by) return res.status(400).json({ error: 'invite_used' })
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(400).json({ error: 'invite_expired' })
    const hash = await bcrypt.hash(password, 12)
    try {
      const info = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)')
        .run(username, email || null, hash, inv.role)
      db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?').run(info.lastInsertRowid, new Date().toISOString(), code)
      logger.info('auth:accept_invite', { username, role: inv.role })
      return res.json({ ok: true })
    } catch (e: any) {
      return res.status(400).json({ error: 'user_exists' })
    }
  })

  // List invites (adult only)
  router.get('/admin/invites', requireAuth(secret), requireRole('adult'), (_req: Request, res: Response) => {
    const rows = db.prepare('SELECT * FROM invites ORDER BY created_at DESC').all() as any[]
    return res.json({ invites: rows })
  })

  // Revoke invite (adult only): set expires_at to now
  router.post('/admin/invites/:code/revoke', requireAuth(secret), requireRole('adult'), (req: Request, res: Response) => {
    const { code } = req.params
    const inv = db.prepare('SELECT * FROM invites WHERE code = ?').get(code) as any
    if (!inv) return res.status(404).json({ error: 'not_found' })
    db.prepare('UPDATE invites SET expires_at = ? WHERE code = ?').run(new Date().toISOString(), code)
    return res.json({ ok: true })
  })

  // Password reset: user requests reset (creates pending request)
  router.post('/reset/request', (req: Request, res: Response) => {
    const { usernameOrEmail } = req.body as { usernameOrEmail: string }
    if (!usernameOrEmail) return res.status(400).json({ error: 'missing_field' })
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(usernameOrEmail, usernameOrEmail) as UserRow | undefined
    if (!user) return res.status(200).json({ ok: true }) // do not leak existence
    const id = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
    const now = new Date().toISOString()
    db.prepare('INSERT INTO reset_requests (id, user_id, status, created_at) VALUES (?, ?, ?, ?)')
      .run(id, user.id, 'pending', now)
    logger.info('auth:reset_requested', { user_id: user.id })
    return res.json({ ok: true })
  })

  // Admin: list reset requests
  router.get('/admin/reset-requests', requireAuth(secret), requireRole('adult'), (_req: Request, res: Response) => {
    const rows = db.prepare('SELECT rr.*, u.username FROM reset_requests rr JOIN users u ON u.id = rr.user_id ORDER BY created_at DESC').all() as any[]
    return res.json({ items: rows })
  })

  // Admin: approve reset → generate token (30 min expiry)
  router.post('/admin/reset-requests/:id/approve', requireAuth(secret), requireRole('adult'), (req: Request, res: Response) => {
    const { id } = req.params
    const rr = db.prepare('SELECT * FROM reset_requests WHERE id = ?').get(id) as any
    if (!rr) return res.status(404).json({ error: 'not_found' })
    if (rr.status !== 'pending') return res.status(400).json({ error: 'invalid_state' })
    const token = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
    const now = new Date()
    const exp = new Date(now.getTime() + 30 * 60 * 1000)
    db.prepare('UPDATE reset_requests SET status = ?, approved_by = ?, approved_at = ?, token = ?, expires_at = ? WHERE id = ?')
      .run('approved', (req as any).user!.id, now.toISOString(), token, exp.toISOString(), id)
    logger.info('auth:reset_approved', { id })
    return res.json({ token, expires_at: exp.toISOString() })
  })

  // Admin: deny reset
  router.post('/admin/reset-requests/:id/deny', requireAuth(secret), requireRole('adult'), (req: Request, res: Response) => {
    const { id } = req.params
    const rr = db.prepare('SELECT * FROM reset_requests WHERE id = ?').get(id) as any
    if (!rr) return res.status(404).json({ error: 'not_found' })
    if (rr.status !== 'pending') return res.status(400).json({ error: 'invalid_state' })
    db.prepare('UPDATE reset_requests SET status = ? WHERE id = ?').run('denied', id)
    logger.info('auth:reset_denied', { id })
    return res.json({ ok: true })
  })

  // Complete reset: user submits new password with token
  router.post('/reset/complete', async (req: Request, res: Response) => {
    const { token, newPassword } = req.body as { token: string; newPassword: string }
    if (!token || !newPassword) return res.status(400).json({ error: 'missing_fields' })
    const rr = db.prepare('SELECT * FROM reset_requests WHERE token = ?').get(token) as any
    if (!rr) return res.status(400).json({ error: 'invalid_token' })
    if (rr.status !== 'approved') return res.status(400).json({ error: 'invalid_state' })
    if (rr.expires_at && new Date(rr.expires_at) < new Date()) return res.status(400).json({ error: 'expired' })
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(rr.user_id) as UserRow | undefined
    if (!user) return res.status(400).json({ error: 'invalid_user' })
    const hash = await bcrypt.hash(newPassword, 12)
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id)
    db.prepare('UPDATE reset_requests SET status = ?, used_at = ? WHERE id = ?').run('done', new Date().toISOString(), rr.id)
    logger.info('auth:reset_completed', { user_id: user.id })
    return res.json({ ok: true })
  })

  router.post('/2fa/enable', (req, res) => {
    const { username } = req.body as { username: string }
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
    if (!user) return res.status(404).json({ error: 'not_found' })
    const secret = generateTOTPSecret(`Family Organizer (${username})`)
    db.prepare('UPDATE users SET twofa_secret = ?, twofa_enabled = 0 WHERE id = ?').run(secret.ascii, user.id)
    toDataURL(secret.otpauth_url!).then((qr) => res.json({ qr, secret: secret.ascii })).catch(() => res.status(500).json({ error: 'qr_failed' }))
  })

  router.post('/2fa/verify', (req, res) => {
    const { username, code } = req.body as { username: string; code: string }
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
    if (!user || !user.twofa_secret) return res.status(400).json({ error: 'no_secret' })
    const ok = verifyTOTP(user.twofa_secret, code)
    if (!ok) return res.status(401).json({ error: 'invalid_code' })
    db.prepare('UPDATE users SET twofa_enabled = 1 WHERE id = ?').run(user.id)
    logger.info('auth:2fa_enabled', { username })
    return res.json({ ok: true })
  })

  router.post('/2fa/disable', (req, res) => {
    const { username } = req.body as { username: string }
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
    if (!user) return res.status(404).json({ error: 'not_found' })
    db.prepare('UPDATE users SET twofa_enabled = 0, twofa_secret = NULL WHERE id = ?').run(user.id)
    logger.info('auth:2fa_disabled', { username })
    return res.json({ ok: true })
  })

  return router
}
