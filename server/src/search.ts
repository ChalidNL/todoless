import { Router, type Response } from 'express'
import { db, TaskRow } from './db.js'
import { type AuthedRequest } from './middleware.js'
import { isTaskAccessible } from './middleware.js'

export function searchRouter() {
  const router = Router()

  /**
   * @swagger
   * /api/search/tasks:
   *   post:
   *     summary: Advanced task search
   *     description: Search tasks with complex filters (labels, assignees, dates, workflow, text search)
   *     tags: [Search]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               query:
   *                 type: string
   *                 description: Text search in title and notes
   *                 example: 'important meeting'
   *               labels:
   *                 type: array
   *                 items:
   *                   type: integer
   *                 description: Filter by label IDs (AND logic)
   *                 example: [1, 2]
   *               assignees:
   *                 type: array
   *                 items:
   *                   type: integer
   *                 description: Filter by assignee IDs (OR logic)
   *                 example: [1]
   *               workflow:
   *                 type: string
   *                 description: Filter by workflow name
   *                 example: 'Kanban'
   *               workflowStage:
   *                 type: string
   *                 description: Filter by workflow stage
   *                 example: 'In Progress'
   *               completed:
   *                 type: boolean
   *                 description: Filter by completion status
   *               blocked:
   *                 type: boolean
   *                 description: Filter blocked tasks only
   *               dueBefore:
   *                 type: string
   *                 format: date
   *                 description: Tasks due before this date (YYYY-MM-DD)
   *                 example: '2025-12-31'
   *               dueAfter:
   *                 type: string
   *                 format: date
   *                 description: Tasks due after this date (YYYY-MM-DD)
   *                 example: '2025-01-01'
   *               shared:
   *                 type: boolean
   *                 description: Filter by shared/private status
   *               limit:
   *                 type: integer
   *                 description: Maximum results to return
   *                 default: 100
   *               offset:
   *                 type: integer
   *                 description: Number of results to skip (pagination)
   *                 default: 0
   *     responses:
   *       200:
   *         description: Search results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Task'
   *                 total:
   *                   type: integer
   *                   description: Total matching tasks (before pagination)
   *                 limit:
   *                   type: integer
   *                 offset:
   *                   type: integer
   *       400:
   *         description: Invalid search parameters
   */
  router.post('/tasks', (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    const {
      query,
      labels,
      assignees,
      workflow,
      workflowStage,
      completed,
      blocked,
      dueBefore,
      dueAfter,
      shared,
      limit = 100,
      offset = 0,
    } = req.body

    // Start with all tasks
    let tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as TaskRow[]

    // Filter by access
    tasks = tasks.filter(t => isTaskAccessible(t, userId))

    // Apply filters
    if (query && typeof query === 'string') {
      const q = query.toLowerCase()
      tasks = tasks.filter(t => {
        const title = (t.title || '').toLowerCase()
        const notes = (t.notes || '').toLowerCase()
        return title.includes(q) || notes.includes(q)
      })
    }

    if (Array.isArray(labels) && labels.length > 0) {
      tasks = tasks.filter(t => {
        if (!t.labels) return false
        try {
          const taskLabels = JSON.parse(t.labels) as number[]
          return labels.every(labelId => taskLabels.includes(labelId))
        } catch {
          return false
        }
      })
    }

    if (Array.isArray(assignees) && assignees.length > 0) {
      tasks = tasks.filter(t => {
        if (!t.assigneeIds) return false
        try {
          const taskAssignees = JSON.parse(t.assigneeIds) as number[]
          return assignees.some(assigneeId => taskAssignees.includes(assigneeId))
        } catch {
          return false
        }
      })
    }

    if (workflow !== undefined) {
      tasks = tasks.filter(t => t.workflow === workflow)
    }

    if (workflowStage !== undefined) {
      tasks = tasks.filter(t => t.workflowStage === workflowStage)
    }

    if (completed !== undefined) {
      tasks = tasks.filter(t => !!t.completed === completed)
    }

    if (blocked !== undefined) {
      tasks = tasks.filter(t => !!t.blocked === blocked)
    }

    if (dueBefore) {
      const beforeDate = new Date(dueBefore)
      tasks = tasks.filter(t => {
        const due = t.due_date
        if (!due) return false
        const dueDate = new Date(due)
        return dueDate <= beforeDate
      })
    }

    if (dueAfter) {
      const afterDate = new Date(dueAfter)
      tasks = tasks.filter(t => {
        const due = t.due_date
        if (!due) return false
        const dueDate = new Date(due)
        return dueDate >= afterDate
      })
    }

    if (shared !== undefined) {
      tasks = tasks.filter(t => !!t.shared === shared)
    }

    const total = tasks.length

    // Pagination
    const paginatedTasks = tasks.slice(offset, offset + limit)

    return res.json({
      items: paginatedTasks,
      total,
      limit,
      offset,
    })
  })

  /**
   * @swagger
   * /api/search/labels:
   *   get:
   *     summary: Search labels by name
   *     description: Search accessible labels by name (case-insensitive)
   *     tags: [Search]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: Search query
   *         example: 'work'
   *     responses:
   *       200:
   *         description: Matching labels
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Label'
   */
  router.get('/labels', (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    const query = req.query.q as string
    if (!query) return res.status(400).json({ error: 'missing_query' })

    const labels = db.prepare('SELECT * FROM labels').all() as any[]
    const accessible = labels.filter(label => {
      if (label.owner_id === userId) return true
      if (label.shared === 1) return true
      return false
    })

    const q = query.toLowerCase()
    const matching = accessible.filter(label => label.name.toLowerCase().includes(q))

    return res.json({ items: matching })
  })

  return router
}
