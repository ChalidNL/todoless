import { Router, type Response } from 'express'
import { db, NoteRow } from './db.js'
import type { AuthedRequest } from './middleware.js'
import { isNoteAccessible, requireNoteOwner } from './middleware.js'

export function notesRouter() {
  const router = Router()

  // GET /api/notes → all notes accessible to current user
  router.get('/', (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id
    // Get all notes, then filter by accessibility
    const rows = db.prepare('SELECT * FROM notes ORDER BY created_at DESC').all() as NoteRow[]
    const accessible = rows.filter(note => isNoteAccessible(note, userId))
    return res.json({ items: accessible })
  })

  // GET /api/notes/:id → get single note
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

  // POST /api/notes → create note
  router.post('/', (req: AuthedRequest, res: Response) => {
    const { title, content, labels, pinned, archived, shared } = req.body
    const userId = req.user!.id

    if (!title) return res.status(400).json({ error: 'missing_title' })

    const now = new Date().toISOString()
    // Default shared to 1 (true)
    const sharedValue = shared !== undefined ? (shared ? 1 : 0) : 1

    const info = db.prepare(
      'INSERT INTO notes (title, content, labels, pinned, archived, shared, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      title,
      content || '',
      labels || null,
      pinned ? 1 : 0,
      archived ? 1 : 0,
      sharedValue,
      userId,
      now,
      now
    )

    const item = db.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid)
    return res.json({ item })
  })

  // PATCH /api/notes/:id → update note
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

    // Always update updatedAt
    updates.push('updated_at = ?')
    values.push(new Date().toISOString())

    if (updates.length === 0) return res.status(400).json({ error: 'no_updates' })

    values.push(id)
    db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const item = db.prepare('SELECT * FROM notes WHERE id = ?').get(id)
    return res.json({ item })
  })

  // DELETE /api/notes/:id → delete note
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
    return res.json({ ok: true })
  })

  // PATCH /api/notes/:id/privacy → toggle note privacy (owner only)
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
