import { Router, type Request, type Response } from 'express'
import { db, ApiTokenRow } from './db.js'
import { type AuthedRequest, requireRole } from './middleware.js'
import { logger } from './logger.js'
import crypto from 'crypto'

export function apiTokensRouter() {
  const router = Router()

  /**
   * @swagger
   * /api/tokens:
   *   get:
   *     summary: List all API tokens
   *     description: Returns all API tokens (admin only)
   *     tags: [API Tokens]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of API tokens
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: integer
   *                       name:
   *                         type: string
   *                       user_id:
   *                         type: integer
   *                       created_by:
   *                         type: integer
   *                       created_at:
   *                         type: string
   *                       last_used_at:
   *                         type: string
   *                         nullable: true
   *                       expires_at:
   *                         type: string
   *                         nullable: true
   *                       revoked:
   *                         type: boolean
   *                       token_preview:
   *                         type: string
   *                         description: First 8 characters of token for identification
   *       403:
   *         description: Admin only
   */
  router.get('/', requireRole('adult'), (req: AuthedRequest, res: Response) => {
    try {
      const tokens = db.prepare(`
        SELECT id, name, user_id, created_by, created_at, last_used_at, expires_at, revoked, token
        FROM api_tokens
        ORDER BY created_at DESC
      `).all() as ApiTokenRow[]

      // Return tokens with preview only (not full token)
      const tokensWithPreview = tokens.map(t => ({
        id: t.id,
        name: t.name,
        user_id: t.user_id,
        created_by: t.created_by,
        created_at: t.created_at,
        last_used_at: t.last_used_at,
        expires_at: t.expires_at,
        revoked: !!t.revoked,
        token_preview: t.token.substring(0, 8) + '...'
      }))

      return res.json({ items: tokensWithPreview })
    } catch (err) {
      logger.error('api_tokens:list_failed', { err: String(err) })
      return res.status(500).json({ error: 'list_failed' })
    }
  })

  /**
   * @swagger
   * /api/tokens:
   *   post:
   *     summary: Create a new API token
   *     description: Creates a new API token for a user (admin only)
   *     tags: [API Tokens]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - user_id
   *             properties:
   *               name:
   *                 type: string
   *                 description: Token name/description
   *               user_id:
   *                 type: integer
   *                 description: User ID this token belongs to
   *               expires_at:
   *                 type: string
   *                 nullable: true
   *                 description: Expiration date (ISO format)
   *     responses:
   *       200:
   *         description: Token created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                   description: The API token (only shown once!)
   *                 id:
   *                   type: integer
   *                 name:
   *                   type: string
   *                 user_id:
   *                   type: integer
   *                 created_at:
   *                   type: string
   *       400:
   *         description: Missing required fields
   *       403:
   *         description: Admin only
   */
  router.post('/', requireRole('adult'), (req: AuthedRequest, res: Response) => {
    try {
      const { name, user_id, expires_at } = req.body as {
        name: string
        user_id: number
        expires_at?: string
      }

      if (!name || !user_id) {
        return res.status(400).json({ error: 'missing_fields' })
      }

      // Verify user exists
      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id)
      if (!user) {
        return res.status(404).json({ error: 'user_not_found' })
      }

      // Generate secure random token (32 bytes = 64 hex characters)
      const token = 'tdl_' + crypto.randomBytes(32).toString('hex')
      const created_by = req.user!.id
      const created_at = new Date().toISOString()

      const info = db.prepare(`
        INSERT INTO api_tokens (token, name, user_id, created_by, created_at, expires_at, revoked)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(token, name, user_id, created_by, created_at, expires_at || null)

      logger.info('api_tokens:created', {
        id: info.lastInsertRowid,
        name,
        user_id,
        created_by
      })

      // Return full token ONLY on creation (this is the only time user can see it)
      return res.json({
        token,
        id: info.lastInsertRowid,
        name,
        user_id,
        created_at,
        expires_at: expires_at || null
      })
    } catch (err) {
      logger.error('api_tokens:create_failed', { err: String(err) })
      return res.status(500).json({ error: 'create_failed' })
    }
  })

  /**
   * @swagger
   * /api/tokens/{id}:
   *   delete:
   *     summary: Revoke an API token
   *     description: Revokes (soft delete) an API token (admin only)
   *     tags: [API Tokens]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Token ID
   *     responses:
   *       200:
   *         description: Token revoked
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ok:
   *                   type: boolean
   *       404:
   *         description: Token not found
   *       403:
   *         description: Admin only
   */
  router.delete('/:id', requireRole('adult'), (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params
      const token = db.prepare('SELECT * FROM api_tokens WHERE id = ?').get(id) as ApiTokenRow | undefined

      if (!token) {
        return res.status(404).json({ error: 'not_found' })
      }

      // Soft delete by setting revoked flag
      db.prepare('UPDATE api_tokens SET revoked = 1 WHERE id = ?').run(id)

      logger.info('api_tokens:revoked', {
        id,
        name: token.name,
        revoked_by: req.user!.id
      })

      return res.json({ ok: true })
    } catch (err) {
      logger.error('api_tokens:revoke_failed', { err: String(err) })
      return res.status(500).json({ error: 'revoke_failed' })
    }
  })

  return router
}
