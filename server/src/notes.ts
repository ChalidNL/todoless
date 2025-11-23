import { Router, type Response } from 'express'
import { db, NoteRow } from './db.js'
import type { AuthedRequest } from './middleware.js'
import { isNoteAccessible, requireNoteOwner } from './middleware.js'
import { broadcastToUsers } from './events.js'

export function notesRouter() {
  const router = Router()

  /**
   * @swagger
   * /api/notes:
   *   get:
   *     summary: List all notes
   *     description: Returns all notes accessible to the current user (owned or shared)
   *     tags: [Notes]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of notes
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Note'
   */
  router.get('/', (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id
    // Get all notes, then filter by accessibility
    const rows = db.prepare('SELECT * FROM notes ORDER BY created_at DESC').all() as NoteRow[]
    const accessible = rows.filter(note => isNoteAccessible(note, userId))
    return res.json({ items: accessible })
  })

  /**
   * @swagger
   * /api/notes/{id}:
   *   get:
   *     summary: Get a note by ID
   *     description: Returns a single note if accessible to current user
   *     tags: [Notes]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Note ID
   *     responses:
   *       200:
   *         description: Note details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 item:
   *                   $ref: '#/components/schemas/Note'
   *       403:
   *         description: Access denied
   *       404:
   *         description: Note not found
   */
  router.get('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const userId = req.user!.id
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined

    if (!note) return res.status(404).json({ error: 'note_not_found' })

    // Check access
    if (!isNoteAccessible(note, userId)) {
      return res.status(403).json({ error: 'access_denied' })
    }

    return res.json({ item: note })
  })

  /**
   * @swagger
   * /api/notes:
   *   post:
   *     summary: Create a new note
   *     description: Creates a new note with optional client_id for sync deduplication
   *     tags: [Notes]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - title
   *             properties:
   *               title:
   *                 type: string
   *                 description: Note title
   *                 example: 'Meeting Notes'
   *               content:
   *                 type: string
   *                 description: Note content
   *                 example: 'Discussed project timeline and deliverables'
   *               labels:
   *                 type: string
   *                 description: JSON array of label IDs
   *                 example: '[1, 2]'
   *               pinned:
   *                 type: boolean
   *                 description: Whether note is pinned
   *                 default: false
   *               archived:
   *                 type: boolean
   *                 description: Whether note is archived
   *                 default: false
   *               shared:
   *                 type: boolean
   *                 description: Whether note is shared with family workspace
   *                 default: true
   *               client_id:
   *                 type: string
   *                 description: Client-generated ID for deduplication during sync
   *     responses:
   *       200:
   *         description: Note created (or existing note if client_id matches)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 item:
   *                   $ref: '#/components/schemas/Note'
   *       400:
   *         description: Missing required fields
   */
  router.post('/', (req: AuthedRequest, res: Response) => {
    const { title, content, labels, pinned, archived, shared, client_id } = req.body
    const userId = req.user!.id

    if (!title) return res.status(400).json({ error: 'missing_title' })

    // v0.0.55: Check for duplicate by client_id to prevent double-creates during sync
    if (client_id) {
      const existing = db.prepare('SELECT * FROM notes WHERE client_id = ?').get(client_id) as NoteRow | undefined
      if (existing) {
        return res.json({ item: existing })
      }
    }

    const now = new Date().toISOString()
    // Default shared to 1 (true)
    const sharedValue = shared !== undefined ? (shared ? 1 : 0) : 1

    const info = db.prepare(
      'INSERT INTO notes (title, content, labels, pinned, archived, shared, owner_id, created_at, updated_at, client_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      title,
      content || '',
      labels || null,
      pinned ? 1 : 0,
      archived ? 1 : 0,
      sharedValue,
      userId,
      now,
      now,
      client_id || null,
      1 // Initial version
    )

    const item = db.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid)

    // v0.0.55: Broadcast note creation to all users for real-time sync
    const allUsers = db.prepare('SELECT id FROM users').all() as Array<{ id: number }>
    const userIds = allUsers.map(u => u.id)
    broadcastToUsers(userIds, 'note.created', { item })

    return res.json({ item })
  })

  /**
   * @swagger
   * /api/notes/{id}:
   *   patch:
   *     summary: Update a note
   *     description: Update note fields. Version is auto-incremented. Only owner can change shared status.
   *     tags: [Notes]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Note ID
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               content:
   *                 type: string
   *               labels:
   *                 type: string
   *               pinned:
   *                 type: boolean
   *               archived:
   *                 type: boolean
   *               shared:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Note updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 item:
   *                   $ref: '#/components/schemas/Note'
   *       403:
   *         description: Access denied or not owner (when changing shared)
   *       404:
   *         description: Note not found
   */
  router.patch('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const userId = req.user!.id

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined
    if (!note) return res.status(404).json({ error: 'note_not_found' })

    // Check access
    if (!isNoteAccessible(note, userId)) {
      return res.status(403).json({ error: 'access_denied' })
    }

    const { title, content, labels, pinned, archived, shared } = req.body

    // Only owner can change 'shared' field
    if (shared !== undefined && note.owner_id !== userId) {
      return res.status(403).json({ error: 'not_owner' })
    }

    const updates: string[] = []
    const values: any[] = []

    if (title !== undefined) { updates.push('title = ?'); values.push(title) }
    if (content !== undefined) { updates.push('content = ?'); values.push(content) }
    if (labels !== undefined) { updates.push('labels = ?'); values.push(labels) }
    if (pinned !== undefined) { updates.push('pinned = ?'); values.push(pinned ? 1 : 0) }
    if (archived !== undefined) { updates.push('archived = ?'); values.push(archived ? 1 : 0) }
    if (shared !== undefined) { updates.push('shared = ?'); values.push(shared ? 1 : 0) }

    // v0.0.55: Increment version for persistence tracking
    updates.push('version = version + 1')

    // Always update updatedAt
    updates.push('updated_at = ?')
    values.push(new Date().toISOString())

    if (updates.length === 0) return res.status(400).json({ error: 'no_updates' })

    values.push(id)
    db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const item = db.prepare('SELECT * FROM notes WHERE id = ?').get(id)

    // v0.0.55: Broadcast note update to all users for real-time sync
    const allUsers = db.prepare('SELECT id FROM users').all() as Array<{ id: number }>
    const userIds = allUsers.map(u => u.id)
    broadcastToUsers(userIds, 'note.updated', { item })

    return res.json({ item })
  })

  /**
   * @swagger
   * /api/notes/{id}:
   *   delete:
   *     summary: Delete a note
   *     description: Permanently delete a note
   *     tags: [Notes]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Note ID
   *     responses:
   *       200:
   *         description: Note deleted
   *       403:
   *         description: Access denied
   *       404:
   *         description: Note not found
   */
  router.delete('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const userId = req.user!.id

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined
    if (!note) return res.status(404).json({ error: 'note_not_found' })

    // Check access
    if (!isNoteAccessible(note, userId)) {
      return res.status(403).json({ error: 'access_denied' })
    }

    db.prepare('DELETE FROM notes WHERE id = ?').run(id)

    // v0.0.55: Broadcast note deletion to all users for real-time sync
    const allUsers = db.prepare('SELECT id FROM users').all() as Array<{ id: number }>
    const userIds = allUsers.map(u => u.id)
    broadcastToUsers(userIds, 'note.deleted', { id: Number(id) })

    return res.json({ ok: true })
  })

  /**
   * @swagger
   * /api/notes/{id}/privacy:
   *   patch:
   *     summary: Toggle note privacy
   *     description: Change note shared status (owner only)
   *     tags: [Notes]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Note ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - shared
   *             properties:
   *               shared:
   *                 type: boolean
   *                 description: New shared status
   *     responses:
   *       200:
   *         description: Privacy updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 item:
   *                   $ref: '#/components/schemas/Note'
   *                 message:
   *                   type: string
   *       403:
   *         description: Not owner
   */
  router.patch('/:id/privacy', requireNoteOwner(), (req: AuthedRequest, res: Response) => {
    const { shared } = req.body
    const note = req.note!

    if (shared === undefined) {
      return res.status(400).json({ error: 'missing_shared_value' })
    }

    const sharedValue = shared ? 1 : 0

    // Update note privacy
    db.prepare('UPDATE notes SET shared = ?, updated_at = ? WHERE id = ?').run(
      sharedValue,
      new Date().toISOString(),
      note.id
    )

    const updatedNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(note.id)
    return res.json({
      item: updatedNote,
      message: `Note privacy updated to ${shared ? 'shared' : 'private'}`
    })
  })

  return router
}
