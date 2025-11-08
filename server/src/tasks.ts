import { Router, type Request, type Response } from 'express'
import { db, TaskRow } from './db.js'
import { broadcastToUsers } from './events.js'
import type { AuthedRequest } from './middleware.js'

export function tasksRouter() {
  const router = Router()

  // GET /api/tasks → all tasks for current user
  router.get('/', (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id
    // Return tasks created by or assigned to the user
    const rows = db.prepare('SELECT * FROM tasks WHERE created_by = ? OR assigned_to = ? ORDER BY id DESC')
      .all(userId, userId) as TaskRow[]
    return res.json({ items: rows })
  })

  // GET /api/tasks/backlog → items with workflow null/'Backlog'
  router.get('/backlog', (req: Request, res: Response) => {
    const rows = db.prepare("SELECT * FROM tasks WHERE workflow IS NULL OR workflow = 'Backlog'").all() as TaskRow[]
    return res.json({ items: rows })
  })

  // GET /api/tasks/kanban → items with workflow='Kanban'
  router.get('/kanban', (req: Request, res: Response) => {
    const rows = db.prepare("SELECT * FROM tasks WHERE workflow = 'Kanban'").all() as TaskRow[]
    return res.json({ items: rows })
  })

  // POST /api/tasks → create task
  router.post('/', (req: AuthedRequest, res: Response) => {
    const { title, completed, workflow, workflowStage, assigned_to, labels, attributes, clientId } = req.body as {
      title: string
      completed?: boolean
      workflow?: string | null
      workflowStage?: string | null
      assigned_to?: number
      labels?: string
      attributes?: string
      clientId?: string
    }
    if (!title) return res.status(400).json({ error: 'missing_title' })
    const created_by = req.user!.id
    const info = db.prepare('INSERT INTO tasks (title, completed, workflow, workflowStage, created_by, assigned_to, labels, attributes, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(title, completed ? 1 : 0, workflow || null, workflowStage || null, created_by, assigned_to || null, labels || null, attributes || null, clientId || null)
    const item = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid) as TaskRow
    // Notify creator and assignee (if any)
    const targets = [item.created_by]
    if (item.assigned_to) targets.push(item.assigned_to)
    broadcastToUsers(targets, 'task.created', { item })
    return res.json({ item })
  })

  // PATCH /api/tasks/:id → update task
  router.patch('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
    if (!t) return res.status(404).json({ error: 'not_found' })
    // Children can only update their own or assigned tasks
    if (req.user?.role === 'child' && !(t.created_by === req.user.id || t.assigned_to === req.user.id)) {
      return res.status(403).json({ error: 'forbidden' })
    }
  const { title, completed, workflow, workflowStage, assigned_to, labels, attributes, clientId } = req.body
    const updates: string[] = []
    const values: any[] = []
    if (title !== undefined) { updates.push('title = ?'); values.push(title) }
    if (completed !== undefined) { updates.push('completed = ?'); values.push(completed ? 1 : 0) }
    if (workflow !== undefined) { updates.push('workflow = ?'); values.push(workflow) }
    if (workflowStage !== undefined) { updates.push('workflowStage = ?'); values.push(workflowStage) }
    if (assigned_to !== undefined) { updates.push('assigned_to = ?'); values.push(assigned_to) }
    if (labels !== undefined) { updates.push('labels = ?'); values.push(labels) }
    if (attributes !== undefined) { updates.push('attributes = ?'); values.push(attributes) }
  if (clientId !== undefined) { updates.push('client_id = ?'); values.push(clientId) }
    if (updates.length === 0) return res.status(400).json({ error: 'no_updates' })
    values.push(id)
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    const item = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow
    const targets = [item.created_by]
    if (item.assigned_to) targets.push(item.assigned_to)
    broadcastToUsers(targets, 'task.updated', { item })
    return res.json({ item })
  })

  // DELETE /api/tasks/:id → delete task
  router.delete('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
    if (!t) return res.status(404).json({ error: 'not_found' })
    if (req.user?.role === 'child' && !(t.created_by === req.user.id || t.assigned_to === req.user.id)) {
      return res.status(403).json({ error: 'forbidden' })
    }
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    const targets = [t.created_by]
    if (t.assigned_to) targets.push(t.assigned_to)
    broadcastToUsers(targets, 'task.deleted', { id: Number(id) })
    return res.json({ ok: true })
  })

  // Movement helpers: Backlog→Kanban→todo→doing→done and reverse
  router.post('/:id/push', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
    if (!t) return res.status(404).json({ error: 'not_found' })
    // Children can only move their own or assigned tasks
    if (req.user?.role === 'child' && !(t.created_by === req.user.id || t.assigned_to === req.user.id)) {
      return res.status(403).json({ error: 'forbidden' })
    }
    let workflow = t.workflow
    let stage = t.workflowStage
    if (!workflow || workflow === 'Backlog') {
      workflow = 'Kanban'; stage = 'todo'
    } else if (stage === 'todo') stage = 'doing'
    else if (stage === 'doing') stage = 'done'
    db.prepare('UPDATE tasks SET workflow = ?, workflowStage = ? WHERE id = ?').run(workflow, stage, id)
    const item = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    return res.json({ item })
  })

  router.post('/:id/pull', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
    if (!t) return res.status(404).json({ error: 'not_found' })
    if (req.user?.role === 'child' && !(t.created_by === req.user.id || t.assigned_to === req.user.id)) {
      return res.status(403).json({ error: 'forbidden' })
    }
    let workflow = t.workflow
    let stage = t.workflowStage
    if (workflow === 'Kanban' && stage === 'done') stage = 'doing'
    else if (workflow === 'Kanban' && stage === 'doing') stage = 'todo'
    else if (workflow === 'Kanban' && stage === 'todo') { workflow = 'Backlog'; stage = null }
    db.prepare('UPDATE tasks SET workflow = ?, workflowStage = ? WHERE id = ?').run(workflow, stage, id)
    const item = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    return res.json({ item })
  })

  return router
}
