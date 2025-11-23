import { Router, type Request, type Response } from 'express'
import { db, TaskRow } from './db.js'
import { broadcastToUsers } from './events.js'
import type { AuthedRequest } from './middleware.js'
import { isTaskAccessible, requireTaskOwner } from './middleware.js'

export function tasksRouter() {
  const router = Router()

  /**
   * @swagger
   * /api/tasks:
   *   get:
   *     summary: List all tasks
   *     description: Returns all tasks accessible to the current user
   *     tags: [Tasks]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of tasks
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Task'
   */
  router.get('/', (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id
    // Get all tasks, then filter by accessibility
    const rows = db.prepare('SELECT * FROM tasks ORDER BY id DESC').all() as TaskRow[]
    const accessible = rows.filter(task => isTaskAccessible(task, userId))
    return res.json({ items: accessible })
  })

  // GET /api/tasks/backlog → items with workflow null/'Backlog' (filtered by access)
  router.get('/backlog', (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id
    const rows = db.prepare("SELECT * FROM tasks WHERE workflow IS NULL OR workflow = 'Backlog'").all() as TaskRow[]
    const accessible = rows.filter(task => isTaskAccessible(task, userId))
    return res.json({ items: accessible })
  })

  // GET /api/tasks/kanban → items with workflow='Kanban' (filtered by access)
  router.get('/kanban', (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id
    const rows = db.prepare("SELECT * FROM tasks WHERE workflow = 'Kanban'").all() as TaskRow[]
    const accessible = rows.filter(task => isTaskAccessible(task, userId))
    return res.json({ items: accessible })
  })

  /**
   * @swagger
   * /api/tasks:
   *   post:
   *     summary: Create a new task
   *     description: Creates a new task for the current user
   *     tags: [Tasks]
   *     security:
   *       - cookieAuth: []
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
   *                 description: Task title
   *               completed:
   *                 type: boolean
   *                 description: Completion status
   *               workflow:
   *                 type: string
   *                 nullable: true
   *                 description: Workflow name (e.g., Backlog, Kanban)
   *               workflowStage:
   *                 type: string
   *                 nullable: true
   *                 description: Stage within workflow
   *               assigneeIds:
   *                 type: array
   *                 items:
   *                   type: integer
   *                 description: Array of user IDs assigned to this task
   *               labels:
   *                 type: string
   *                 description: JSON string of label IDs
   *               shared:
   *                 type: boolean
   *                 description: Whether task is shared with family workspace
   *     responses:
   *       200:
   *         description: Task created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 item:
   *                   $ref: '#/components/schemas/Task'
   *       400:
   *         description: Missing required fields
   */
  router.post('/', (req: AuthedRequest, res: Response) => {
    const { title, completed, workflow, workflowStage, assigned_to, assigneeIds, labels, attributes, clientId, shared } = req.body as {
      title: string
      completed?: boolean
      workflow?: string | null
      workflowStage?: string | null
      assigned_to?: number  // DEPRECATED
      assigneeIds?: number[] | string  // NEW: array or JSON string
      labels?: string
      attributes?: string
      clientId?: string
      shared?: boolean
    }
    if (!title) return res.status(400).json({ error: 'missing_title' })
    const created_by = req.user!.id
    // Default shared to 1 (true)
    const sharedValue = shared !== undefined ? (shared ? 1 : 0) : 1

    // Handle assigneeIds: convert array to JSON string
    let assigneeIdsJson: string | null = null
    if (assigneeIds) {
      assigneeIdsJson = typeof assigneeIds === 'string' ? assigneeIds : JSON.stringify(assigneeIds)
    } else if (assigned_to) {
      // Backwards compatibility: convert single assigned_to to array
      assigneeIdsJson = JSON.stringify([assigned_to])
    }

    const info = db.prepare('INSERT INTO tasks (title, completed, workflow, workflowStage, created_by, assigned_to, assigneeIds, labels, attributes, client_id, shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(title, completed ? 1 : 0, workflow || null, workflowStage || null, created_by, assigned_to || null, assigneeIdsJson, labels || null, attributes || null, clientId || null, sharedValue)
    const item = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid) as TaskRow

    // Notify creator and ALL assignees
    const targets = [item.created_by]
    if (item.assigneeIds) {
      try {
        const ids = JSON.parse(item.assigneeIds) as number[]
        targets.push(...ids)
      } catch {}
    } else if (item.assigned_to) {
      targets.push(item.assigned_to)
    }
    broadcastToUsers(targets, 'task.created', { item })
    return res.json({ item })
  })

  // PATCH /api/tasks/:id → update task
  router.patch('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
    if (!t) return res.status(404).json({ error: 'not_found' })

    const userId = req.user!.id

    // Check access
    if (!isTaskAccessible(t, userId)) {
      return res.status(403).json({ error: 'access_denied' })
    }

    // Children can only update their own or assigned tasks
    if (req.user?.role === 'child' && !(t.created_by === req.user.id || t.assigned_to === req.user.id)) {
      return res.status(403).json({ error: 'forbidden' })
    }

    const { title, completed, workflow, workflowStage, assigned_to, assigneeIds, labels, attributes, clientId, shared } = req.body

    // Only owner can change 'shared' field
    if (shared !== undefined && t.created_by !== userId) {
      return res.status(403).json({ error: 'not_owner' })
    }

    const updates: string[] = []
    const values: any[] = []
    if (title !== undefined) { updates.push('title = ?'); values.push(title) }
    if (completed !== undefined) { updates.push('completed = ?'); values.push(completed ? 1 : 0) }
    if (workflow !== undefined) { updates.push('workflow = ?'); values.push(workflow) }
    if (workflowStage !== undefined) { updates.push('workflowStage = ?'); values.push(workflowStage) }

    // Handle assigneeIds update
    if (assigneeIds !== undefined) {
      const assigneeIdsJson = typeof assigneeIds === 'string' ? assigneeIds : JSON.stringify(assigneeIds)
      updates.push('assigneeIds = ?')
      values.push(assigneeIdsJson)
    } else if (assigned_to !== undefined) {
      // Backwards compatibility: convert single assigned_to to array
      updates.push('assigned_to = ?')
      values.push(assigned_to)
      if (assigned_to !== null) {
        updates.push('assigneeIds = ?')
        values.push(JSON.stringify([assigned_to]))
      }
    }

    if (labels !== undefined) { updates.push('labels = ?'); values.push(labels) }
    if (attributes !== undefined) { updates.push('attributes = ?'); values.push(attributes) }
    if (clientId !== undefined) { updates.push('client_id = ?'); values.push(clientId) }
    if (shared !== undefined) { updates.push('shared = ?'); values.push(shared ? 1 : 0) }
    if (updates.length === 0) return res.status(400).json({ error: 'no_updates' })
    values.push(id)
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    const item = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow

    // Notify creator and ALL assignees (both old and new)
    const targets = [item.created_by]
    if (item.assigneeIds) {
      try {
        const ids = JSON.parse(item.assigneeIds) as number[]
        targets.push(...ids)
      } catch {}
    } else if (item.assigned_to) {
      targets.push(item.assigned_to)
    }
    // Also notify previous assignees if changed
    if (t.assigneeIds && t.assigneeIds !== item.assigneeIds) {
      try {
        const oldIds = JSON.parse(t.assigneeIds) as number[]
        targets.push(...oldIds)
      } catch {}
    } else if (t.assigned_to && t.assigned_to !== item.assigned_to) {
      targets.push(t.assigned_to)
    }

    broadcastToUsers(targets, 'task.updated', { item })
    return res.json({ item })
  })

  // DELETE /api/tasks/:id → delete task
  router.delete('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
    if (!t) return res.status(404).json({ error: 'not_found' })

    const userId = req.user!.id

    // Check access
    if (!isTaskAccessible(t, userId)) {
      return res.status(403).json({ error: 'access_denied' })
    }

    if (req.user?.role === 'child' && !(t.created_by === req.user.id || t.assigned_to === req.user.id)) {
      return res.status(403).json({ error: 'forbidden' })
    }
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id)

    // Notify creator and ALL assignees
    const targets = [t.created_by]
    if (t.assigneeIds) {
      try {
        const ids = JSON.parse(t.assigneeIds) as number[]
        targets.push(...ids)
      } catch {}
    } else if (t.assigned_to) {
      targets.push(t.assigned_to)
    }

    broadcastToUsers(targets, 'task.deleted', { id: Number(id) })
    return res.json({ ok: true })
  })

  // Movement helpers: Backlog→Kanban→todo→doing→done and reverse
  router.post('/:id/push', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
    if (!t) return res.status(404).json({ error: 'not_found' })

    const userId = req.user!.id

    // Check access
    if (!isTaskAccessible(t, userId)) {
      return res.status(403).json({ error: 'access_denied' })
    }

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

    const userId = req.user!.id

    // Check access
    if (!isTaskAccessible(t, userId)) {
      return res.status(403).json({ error: 'access_denied' })
    }

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

  // PATCH /api/tasks/:id/privacy → toggle task privacy (owner only)
  router.patch('/:id/privacy', requireTaskOwner(), (req: AuthedRequest, res: Response) => {
    const { shared } = req.body
    const task = req.task!

    if (shared === undefined) {
      return res.status(400).json({ error: 'missing_shared_value' })
    }

    const sharedValue = shared ? 1 : 0

    // Update task privacy
    db.prepare('UPDATE tasks SET shared = ? WHERE id = ?').run(sharedValue, task.id)

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id)
    return res.json({
      item: updatedTask,
      message: `Task privacy updated to ${shared ? 'shared' : 'private'}`
    })
  })

  return router
}
