import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { db, UserRow } from './db.js'

export interface AuthedRequest extends Request {
  user?: Pick<UserRow, 'id' | 'username' | 'role' | 'twofa_enabled'> & { twofa_verified?: boolean }
}

export function requireAuth(secret: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const token = req.cookies?.token
    if (!token) return res.status(401).json({ error: 'unauthorized' })
    try {
      const data = jwt.verify(token, secret) as any
      req.user = {
        id: data.id,
        username: data.username,
        role: data.role,
        twofa_enabled: data.twofa_enabled ? 1 : 0,
        twofa_verified: !!data.twofa_verified,
      }
      next()
    } catch {
      return res.status(401).json({ error: 'invalid_token' })
    }
  }
}

export function requireRole(role: 'adult' | 'child') {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' })
    if (req.user.role !== role) return res.status(403).json({ error: 'forbidden' })
    next()
  }
}

export function require2FA() {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' })
    if (req.user.twofa_enabled && !req.user.twofa_verified) {
      return res.status(401).json({ error: '2fa_required' })
    }
    next()
  }
}
