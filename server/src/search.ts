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

    let joins: string[] = []
    let joinParams: (string | number)[] = []

    let queryParts: string[] = []
    let params: (string | number | boolean)[] = []

    // Apply filters
    if (query && typeof query === 'string') {
      queryParts.push('(LOWER(title) LIKE ? OR LOWER(notes) LIKE ?)')
      params.push(`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`)
    }

    if (workflow !== undefined) {
      queryParts.push('workflow = ?')
      params.push(workflow)
    }

    if (workflowStage !== undefined) {
      queryParts.push('workflowStage = ?')
      params.push(workflowStage)
    }

    if (completed !== undefined) {
      queryParts.push('completed = ?')
      params.push(completed ? 1 : 0)
    }

    if (blocked !== undefined) {
      queryParts.push('blocked = ?')
      params.push(blocked ? 1 : 0)
    }

    if (dueBefore) {
      queryParts.push('due_date <= ?')
      params.push(dueBefore)
    }

    if (dueAfter) {
      queryParts.push('due_date >= ?')
      params.push(dueAfter)
    }

    if (shared !== undefined) {
      queryParts.push('shared = ?')
      params.push(shared ? 1 : 0)
    }

    // Zeer efficiënte filtering met JOINs
    if (Array.isArray(assignees) && assignees.length > 0) {
      joins.push('INNER JOIN task_assignees ta ON tasks.id = ta.task_id')
      const placeholders = assignees.map(() => '?').join(',')
      queryParts.push(`ta.user_id IN (${placeholders})`)
      joinParams.push(...assignees)
    }

    if (Array.isArray(labels) && labels.length > 0) {
      joins.push(`
        INNER JOIN task_labels tl ON tasks.id = tl.task_id
      `)
      const placeholders = labels.map(() => '?').join(',')
      queryParts.push(`tl.label_id IN (${placeholders})`)
      joinParams.push(...labels)
      // Voor AND-logica (alle labels moeten matchen)
      queryParts.push(`(SELECT COUNT(DISTINCT tl_inner.label_id) FROM task_labels tl_inner WHERE tl_inner.task_id = tasks.id AND tl_inner.label_id IN (${placeholders})) = ?`)
      joinParams.push(...labels, labels.length)
    }

    const joinClause = joins.join(' ')
    const whereClause = queryParts.length > 0 ? `WHERE ${queryParts.join(' AND ')}` : ''
    const finalParams = [...params, ...joinParams]

    // Get total count with filters
    const totalStmt = db.prepare(`SELECT COUNT(DISTINCT tasks.id) as count FROM tasks ${joinClause} ${whereClause}`)
    const totalResult = totalStmt.get(...finalParams) as { count: number }
    const total = totalResult.count

    // Get paginated tasks
    const tasksStmt = db.prepare(`SELECT DISTINCT tasks.* FROM tasks ${joinClause} ${whereClause} ORDER BY tasks.created_at DESC LIMIT ? OFFSET ?`)
    let tasks = tasksStmt.all(...finalParams, limit, offset) as TaskRow[]

    // Filter by access
    tasks = tasks.filter(t => isTaskAccessible(t, userId))

    return res.json({
      items: tasks,
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

  /**
   * @swagger
   * /api/search/counters:
   *   get:
   *     summary: Get task counts for system filters
   *     description: Returns task counts for system filters like 'All' and '@me'. This endpoint ensures counts are server-calculated and accurate.
   *     tags: [Search, Counters]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: System filter counts
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 all:
   *                   type: integer
   *                   description: Count for all active, accessible tasks.
   *                 me:
   *                   type: integer
   *                   description: Count for all active tasks assigned to the current user.
   */
  router.get('/counters', (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    // Count for 'All': Alle niet-voltooide taken die toegankelijk zijn voor de gebruiker.
    const allTasks = db.prepare('SELECT * FROM tasks WHERE completed = 0').all() as TaskRow[]
    const accessibleCount = allTasks.filter(t => isTaskAccessible(t, userId)).length

    // Count for '@me': Alle niet-voltooide taken die specifiek aan de gebruiker zijn toegewezen.
    // We gebruiken een JOIN voor efficiëntie, zoals eerder besproken.
    const meStmt = db.prepare(`
      SELECT COUNT(DISTINCT tasks.id) as count
      FROM tasks
      INNER JOIN task_assignees ta ON tasks.id = ta.task_id
      WHERE tasks.completed = 0 AND ta.user_id = ?
    `)
    const meResult = meStmt.get(userId) as { count: number }
    const meCount = meResult.count

    return res.json({ all: accessibleCount, me: meCount })
  })

  return router
}
