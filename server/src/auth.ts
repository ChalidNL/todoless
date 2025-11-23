import { Router, type Request, type Response } from 'express'
import { db, UserRow } from './db.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { generateTOTPSecret, toDataURL, verifyTOTP } from './utils/totp.js'
import rateLimit from 'express-rate-limit'
import { logger } from './logger.js'
import { requireAuth, requireRole } from './middleware.js'

export function authRouter(secret: string) {
  const router = Router()

  const limiter = rateLimit({ windowMs: 60_000, max: 5 })

  function issueCookie(res: any, payload: any) {
    const token = jwt.sign(payload, secret, { expiresIn: '7d' })
    const isProduction = process.env.NODE_ENV === 'production'
    const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction
    
    // For development/LAN access, use 'lax' sameSite. For production with HTTPS, use 'strict'.
    // Note: 'none' requires secure=true, which won't work with HTTP on LAN
    const sameSite = isProduction ? 'strict' : 'lax'
    
    const cookieOptions: any = {
      httpOnly: true,
      sameSite,
      secure,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }
    
    // In development, don't set domain to allow localhost and LAN IPs
    // Production can set explicit domain via env var if needed
    if (isProduction && process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN
    }
    
    res.cookie('token', token, cookieOptions)
    logger.info('auth:cookie-issued', { secure, sameSite, hasDomain: !!cookieOptions.domain })
  }

  // Disable open registration. Only allow if there are no users (initial install), which we seed anyway.
  router.post('/register', async (_req, res) => {
    return res.status(403).json({ error: 'registration_disabled' })
  })

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Login with username and password
   *     description: Authenticates a user and sets a JWT token in an httpOnly cookie. Supports 2FA with TOTP code.
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *                 description: User's username
   *               password:
   *                 type: string
   *                 description: User's password
   *               code:
   *                 type: string
   *                 description: TOTP 2FA code (required if 2FA is enabled)
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ok:
   *                   type: boolean
   *       401:
   *         description: Invalid credentials or 2FA required
   *         content:
   *           application/json:
   *             schema:
   *               oneOf:
   *                 - $ref: '#/components/schemas/Error'
   *                 - type: object
   *                   properties:
   *                     twofaRequired:
   *                       type: boolean
   */
  router.post('/login', limiter, async (req, res) => {
    const { username, password, code } = req.body as { username: string; password: string; code?: string }
    logger.info('auth:login-attempt', { 
      username, 
      hasPassword: !!password, 
      passwordLength: password?.length,
      origin: req.headers.origin, 
      userAgent: req.headers['user-agent'],
      body: req.body
    })
    
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
    if (!user) {
      logger.warn('auth:login-failed', { username, reason: 'user_not_found' })
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    
    logger.info('auth:user-found', { username, hasHash: !!user.password_hash })
    const ok = await bcrypt.compare(password, user.password_hash)
    logger.info('auth:password-compare', { username, result: ok })
    if (!ok) {
      logger.warn('auth:login-failed', { username, reason: 'invalid_password' })
      return res.status(401).json({ error: 'invalid_credentials' })
    }

    if (user.twofa_enabled) {
      if (!code || !user.twofa_secret || !verifyTOTP(user.twofa_secret, code)) {
        // Signal 2FA required
        logger.info('auth:2fa-required', { username })
        return res.status(401).json({ twofaRequired: true })
      }
    }

    issueCookie(res, { id: user.id, username: user.username, role: user.role, twofa_enabled: !!user.twofa_enabled, twofa_verified: !!user.twofa_enabled })
    logger.info('auth:login-success', { username, userId: user.id })
    return res.json({ ok: true })
  })

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Logout current user
   *     description: Clears the authentication cookie and ends the session
   *     tags: [Authentication]
   *     responses:
   *       200:
   *         description: Logout successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ok:
   *                   type: boolean
   */
  router.post('/logout', (req, res) => {
    res.clearCookie('token', { path: '/' })
    logger.info('auth:logout', {})
    return res.json({ ok: true })
  })

  /**
   * @swagger
   * /api/auth/me:
   *   get:
   *     summary: Get current user
   *     description: Returns the currently authenticated user's information from the JWT cookie
   *     tags: [Authentication]
   *     responses:
   *       200:
   *         description: Current user information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user:
   *                   oneOf:
   *                     - $ref: '#/components/schemas/User'
   *                     - type: 'null'
   */
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

  // Update profile (username/email)
  router.post('/profile', requireAuth(secret), (req, res) => {
    try {
      const u = (req as any).user as { id: number; username: string }
      const { username, email } = req.body as { username?: string; email?: string }
      if (!username && !email) return res.status(400).json({ error: 'nothing_to_update' })
      const updates: string[] = []
      const values: any[] = []
      if (username) {
        updates.push('username = ?')
        values.push(username)
      }
      if (email !== undefined) {
        updates.push('email = ?')
        values.push(email || null)
      }
      values.push(u.id)
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)
      logger.info('auth:profile-updated', { user_id: u.id, updated: updates })
      // Issue new cookie with updated username
      if (username) {
        const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id) as UserRow
        issueCookie(res, { id: updated.id, username: updated.username, role: updated.role, twofa_enabled: !!updated.twofa_enabled })
      }
      return res.json({ ok: true })
    } catch (e: any) {
      logger.error('auth:profile-update-failed', { error: e.message })
      return res.status(500).json({ error: 'update_failed' })
    }
  })

  // Change password (requires current password for security)
  router.post('/change-password', requireAuth(secret), async (req, res) => {
    try {
      const u = (req as any).user as { id: number; username: string }
      const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string }
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'missing_fields' })
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'password_too_short' })
      }
      
      // Verify current password
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id) as UserRow | undefined
      if (!user) {
        return res.status(404).json({ error: 'user_not_found' })
      }
      
      const valid = await bcrypt.compare(currentPassword, user.password_hash)
      if (!valid) {
        logger.warn('auth:password-change-failed', { user_id: u.id, reason: 'invalid_current_password' })
        return res.status(401).json({ error: 'invalid_current_password' })
      }
      
      // Update password
      const hash = await bcrypt.hash(newPassword, 12)
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, u.id)
      logger.info('auth:password-changed', { user_id: u.id })
      
      return res.json({ ok: true })
    } catch (e: any) {
      logger.error('auth:password-change-error', { error: e.message })
      return res.status(500).json({ error: 'change_failed' })
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
    const secret = generateTOTPSecret(`TodoLess (${username})`)
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
