import { Router, type Request, type Response } from 'express'
import { db, LabelRow, TaskRow } from './db.js'
import { type AuthedRequest, requireLabelOwner } from './middleware.js'

export function labelsRouter() {
  const router = Router()

  // GET /api/labels → all labels (filtered by access)
  router.get('/', (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id
    const rows = db.prepare('SELECT * FROM labels ORDER BY id DESC').all() as LabelRow[]

    // Filter labels based on access
    const accessible = rows.filter(label => {
      // Owner always has access
      if (userId && label.owner_id === userId) return true
      // Shared labels are visible to all
      if (label.shared === 1) return true
      return false
    })

    return res.json({ items: accessible })
  })

  // POST /api/labels → create label (requires auth)
  router.post('/', (req: AuthedRequest, res: Response) => {
    const { name, color, shared } = req.body
    const userId = req.user?.id
    if (!name) return res.status(400).json({ error: 'missing_name' })
    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    // Default shared to true (1)
    const sharedValue = shared !== undefined ? (shared ? 1 : 0) : 1
    const info = db.prepare('INSERT INTO labels (name, color, shared, owner_id) VALUES (?, ?, ?, ?)').run(
      name,
      color || '#0ea5e9',
      sharedValue,
      userId
    )
    const item = db.prepare('SELECT * FROM labels WHERE id = ?').get(info.lastInsertRowid)
    return res.json({ item })
  })

  // PATCH /api/labels/:id → update label (owner only for shared toggle, otherwise allow)
  router.patch('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const { name, color, shared } = req.body
    const userId = req.user?.id

    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    const label = db.prepare('SELECT * FROM labels WHERE id = ?').get(id) as LabelRow | undefined
    if (!label) return res.status(404).json({ error: 'label_not_found' })

    // If trying to change 'shared', must be owner
    if (shared !== undefined && label.owner_id !== userId) {
      return res.status(403).json({ error: 'not_owner' })
    }

    const updates = []
    const values = []
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (color !== undefined) { updates.push('color = ?'); values.push(color) }
    if (shared !== undefined) { updates.push('shared = ?'); values.push(shared ? 1 : 0) }
    if (updates.length === 0) return res.status(400).json({ error: 'no_updates' })
    values.push(id)
    db.prepare(`UPDATE labels SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    const item = db.prepare('SELECT * FROM labels WHERE id = ?').get(id)
    return res.json({ item })
  })

  // DELETE /api/labels/:id → delete label
  router.delete('/:id', (req: Request, res: Response) => {
    const { id } = req.params
    db.prepare('DELETE FROM labels WHERE id = ?').run(id)
    return res.json({ ok: true })
  })

  // PATCH /api/labels/:id/privacy → toggle privacy (owner only)
  router.patch('/:id/privacy', requireLabelOwner(), (req: AuthedRequest, res: Response) => {
    const { shared } = req.body
    const label = req.label!

    if (shared === undefined) {
      return res.status(400).json({ error: 'missing_shared_value' })
    }

    const sharedValue = shared ? 1 : 0

    // Update label privacy
    db.prepare('UPDATE labels SET shared = ? WHERE id = ?').run(sharedValue, label.id)

    // Cascading: Update all tasks under this label
    const tasks = db.prepare('SELECT * FROM tasks').all() as TaskRow[]
    for (const task of tasks) {
      if (task.labels) {
        try {
          const labelIds = JSON.parse(task.labels) as number[]
          if (labelIds.includes(label.id)) {
            // Set task shared to match label
            db.prepare('UPDATE tasks SET shared = ? WHERE id = ?').run(sharedValue, task.id)
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      }
    }

    // Cascading: Update all notes under this label
    const notes = db.prepare('SELECT * FROM notes').all() as any[]
    for (const note of notes) {
      if (note.labels) {
        try {
          const labelIds = JSON.parse(note.labels) as number[]
          if (labelIds.includes(label.id)) {
            // Set note shared to match label
            db.prepare('UPDATE notes SET shared = ? WHERE id = ?').run(sharedValue, note.id)
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      }
    }

    const updatedLabel = db.prepare('SELECT * FROM labels WHERE id = ?').get(label.id)
    return res.json({
      item: updatedLabel,
      cascaded: true,
      message: `Privacy updated for label and all child tasks/notes`
    })
  })

  return router
}
