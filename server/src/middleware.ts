import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { db, UserRow, LabelRow, TaskRow, NoteRow, ApiTokenRow } from './db.js'
import { logger } from './logger.js'

export interface AuthedRequest extends Request {
  user?: Pick<UserRow, 'id' | 'username' | 'role' | 'twofa_enabled'> & { twofa_verified?: boolean }
  label?: LabelRow
  task?: TaskRow
  note?: NoteRow
}

export function requireAuth(secret: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    // Check for API token in Authorization header first
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const apiToken = authHeader.substring(7)

      try {
        const tokenRow = db.prepare(`
          SELECT * FROM api_tokens
          WHERE token = ? AND revoked = 0
        `).get(apiToken) as ApiTokenRow | undefined

        if (!tokenRow) {
          return res.status(401).json({ error: 'invalid_api_token' })
        }

        // Check if token is expired
        if (tokenRow.expires_at) {
          const expiresAt = new Date(tokenRow.expires_at)
          if (expiresAt < new Date()) {
            return res.status(401).json({ error: 'api_token_expired' })
          }
        }

        // Update last_used_at
        db.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?')
          .run(new Date().toISOString(), tokenRow.id)

        // Get user info
        const user = db.prepare('SELECT id, username, role, twofa_enabled FROM users WHERE id = ?')
          .get(tokenRow.user_id) as UserRow | undefined

        if (!user) {
          return res.status(401).json({ error: 'user_not_found' })
        }

        req.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          twofa_enabled: user.twofa_enabled,
          twofa_verified: true, // API tokens bypass 2FA requirement
        }

        logger.info('auth:api_token_used', {
          token_id: tokenRow.id,
          user_id: user.id,
          token_name: tokenRow.name
        })

        return next()
      } catch (err) {
        logger.error('auth:api_token_error', { error: String(err) })
        return res.status(401).json({ error: 'invalid_api_token' })
      }
    }

    // Fall back to JWT cookie authentication
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

/**
 * Middleware to check if user is owner of a label
 * Loads label into req.label for subsequent use
 */
export function requireLabelOwner() {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' })

    const labelId = parseInt(req.params.id)
    if (isNaN(labelId)) return res.status(400).json({ error: 'invalid_label_id' })

    const label = db.prepare('SELECT * FROM labels WHERE id = ?').get(labelId) as LabelRow | undefined
    if (!label) return res.status(404).json({ error: 'label_not_found' })

    // Check ownership
    if (label.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'not_owner' })
    }

    req.label = label
    next()
  }
}

/**
 * Middleware to check if user is owner of a task OR task is shared
 * Loads task into req.task for subsequent use
 */
export function requireTaskAccess() {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' })

    const taskId = parseInt(req.params.id)
    if (isNaN(taskId)) return res.status(400).json({ error: 'invalid_task_id' })

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined
    if (!task) return res.status(404).json({ error: 'task_not_found' })

    // Check access: must be owner OR task must be shared
    const isOwner = task.created_by === req.user.id
    const isShared = task.shared === 1

    if (!isOwner && !isShared) {
      return res.status(403).json({ error: 'access_denied' })
    }

    req.task = task
    next()
  }
}

/**
 * Middleware to check if user is owner of a task (for privacy modifications)
 */
export function requireTaskOwner() {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' })

    const taskId = parseInt(req.params.id)
    if (isNaN(taskId)) return res.status(400).json({ error: 'invalid_task_id' })

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined
    if (!task) return res.status(404).json({ error: 'task_not_found' })

    // Only owner can modify privacy
    if (task.created_by !== req.user.id) {
      return res.status(403).json({ error: 'not_owner' })
    }

    req.task = task
    next()
  }
}

/**
 * Middleware to check if user is owner of a note OR note is shared
 */
export function requireNoteAccess() {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' })

    const noteId = parseInt(req.params.id)
    if (isNaN(noteId)) return res.status(400).json({ error: 'invalid_note_id' })

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as NoteRow | undefined
    if (!note) return res.status(404).json({ error: 'note_not_found' })

    // Check access: must be owner OR note must be shared
    const isOwner = note.owner_id === req.user.id
    const isShared = note.shared === 1

    if (!isOwner && !isShared) {
      return res.status(403).json({ error: 'access_denied' })
    }

    req.note = note
    next()
  }
}

/**
 * Middleware to check if user is owner of a note (for privacy modifications)
 */
export function requireNoteOwner() {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' })

    const noteId = parseInt(req.params.id)
    if (isNaN(noteId)) return res.status(400).json({ error: 'invalid_note_id' })

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as NoteRow | undefined
    if (!note) return res.status(404).json({ error: 'note_not_found' })

    // Only owner can modify privacy
    if (note.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'not_owner' })
    }

    req.note = note
    next()
  }
}

/**
 * Helper function to check if a task is accessible to a user
 * Takes into account both task-level privacy and label-level privacy
 */
export function isTaskAccessible(task: TaskRow, userId: number): boolean {
  // Owner always has access
  if (task.created_by === userId) return true

  // Task must be shared for non-owners
  if (task.shared !== 1) return false

  // Check label privacy (cascading rule)
  if (task.labels) {
    try {
      const labelIds = JSON.parse(task.labels) as number[]
      for (const labelId of labelIds) {
        const label = db.prepare('SELECT * FROM labels WHERE id = ?').get(labelId) as LabelRow | undefined
        if (label && label.shared === 0) {
          // If any parent label is private, task is private (unless user is owner)
          return false
        }
      }
    } catch (e) {
      // Invalid JSON, ignore
    }
  }

  return true
}

/**
 * Helper function to check if a note is accessible to a user
 */
export function isNoteAccessible(note: NoteRow, userId: number): boolean {
  // Owner always has access
  if (note.owner_id === userId) return true

  // Note must be shared for non-owners
  if (note.shared !== 1) return false

  // Check label privacy (cascading rule)
  if (note.labels) {
    try {
      const labelIds = JSON.parse(note.labels) as number[]
      for (const labelId of labelIds) {
        const label = db.prepare('SELECT * FROM labels WHERE id = ?').get(labelId) as LabelRow | undefined
        if (label && label.shared === 0) {
          // If any parent label is private, note is private (unless user is owner)
          return false
        }
      }
    } catch (e) {
      // Invalid JSON, ignore
    }
  }

  return true
}
