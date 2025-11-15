import { Router, type Request, type Response } from 'express'
import { db } from './db.js'

export function labelsRouter() {
  const router = Router()

  // GET /api/labels → all labels
  router.get('/', (req: Request, res: Response) => {
    const rows = db.prepare('SELECT * FROM labels ORDER BY id DESC').all()
    return res.json({ items: rows })
  })

  // POST /api/labels → create label
  router.post('/', (req: Request, res: Response) => {
    const { name, color, shared } = req.body
    if (!name) return res.status(400).json({ error: 'missing_name' })
    const info = db.prepare('INSERT INTO labels (name, color, shared) VALUES (?, ?, ?)').run(name, color || '#0ea5e9', shared ? 1 : 0)
    const item = db.prepare('SELECT * FROM labels WHERE id = ?').get(info.lastInsertRowid)
    return res.json({ item })
  })

  // PATCH /api/labels/:id → update label
  router.patch('/:id', (req: Request, res: Response) => {
    const { id } = req.params
    const { name, color, shared } = req.body
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

  return router
}
