import { Router, type Response } from 'express'
import { db } from './db.js'
import { type AuthedRequest } from './middleware.js'

export function exportRouter() {
  const router = Router()

  /**
   * @swagger
   * /api/export/json:
   *   get:
   *     summary: Export all data as JSON
   *     description: Export all tasks, labels, workflows, and notes owned by or shared with current user
   *     tags: [Export]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Full data export
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 version:
   *                   type: string
   *                   description: Export format version
   *                 exportedAt:
   *                   type: string
   *                   format: 'date-time'
   *                 user:
   *                   type: object
   *                   description: Current user info
   *                 tasks:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Task'
   *                 labels:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Label'
   *                 workflows:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Workflow'
   *                 notes:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Note'
   */
  router.get('/json', (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    // Get all accessible data
    const tasks = db.prepare('SELECT * FROM tasks WHERE created_by = ? OR shared = 1').all(userId)
    const labels = db.prepare('SELECT * FROM labels WHERE owner_id = ? OR shared = 1').all(userId)
    const workflows = db.prepare('SELECT * FROM workflows WHERE owner_id = ? OR shared = 1').all(userId)
    const notes = db.prepare('SELECT * FROM notes WHERE created_by = ? OR shared = 1').all(userId)

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: {
        id: req.user.id,
        username: req.user.username,
      },
      tasks,
      labels,
      workflows,
      notes,
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="todoless-export-${new Date().toISOString().split('T')[0]}.json"`)
    return res.json(exportData)
  })

  /**
   * @swagger
   * /api/export/csv:
   *   get:
   *     summary: Export tasks as CSV
   *     description: Export all accessible tasks as CSV file
   *     tags: [Export]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: includeCompleted
   *         schema:
   *           type: boolean
   *           default: true
   *         description: Include completed tasks in export
   *     responses:
   *       200:
   *         description: CSV export of tasks
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   */
  router.get('/csv', (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    const includeCompleted = req.query.includeCompleted !== 'false'

    // Get tasks
    let query = 'SELECT * FROM tasks WHERE created_by = ? OR shared = 1'
    if (!includeCompleted) {
      query += ' AND completed = 0'
    }
    const tasks = db.prepare(query).all(userId) as any[]

    // Generate CSV
    const headers = ['ID', 'Title', 'Completed', 'Workflow', 'Stage', 'Labels', 'Assignees', 'Due Date', 'Created At']
    const rows = tasks.map(t => [
      t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.completed ? 'Yes' : 'No',
      t.workflow || '',
      t.workflowStage || '',
      t.labels || '',
      t.assigneeIds || '',
      t.due_date || '',
      t.created_at || '',
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="todoless-tasks-${new Date().toISOString().split('T')[0]}.csv"`)
    return res.send(csv)
  })

  /**
   * @swagger
   * /api/export/backup:
   *   get:
   *     summary: Full database backup
   *     description: Export complete database backup (admin only)
   *     tags: [Export]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Full backup
   *       403:
   *         description: Admin only
   */
  router.get('/backup', (req: AuthedRequest, res: Response) => {
    const user = req.user
    if (!user || user.role !== 'adult') {
      return res.status(403).json({ error: 'admin_only' })
    }

    // Get all data from all tables
    const users = db.prepare('SELECT id, username, email, role FROM users').all()
    const tasks = db.prepare('SELECT * FROM tasks').all()
    const labels = db.prepare('SELECT * FROM labels').all()
    const workflows = db.prepare('SELECT * FROM workflows').all()
    const notes = db.prepare('SELECT * FROM notes').all()

    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: user.username,
      data: {
        users,
        tasks,
        labels,
        workflows,
        notes,
      },
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="todoless-backup-${new Date().toISOString().split('T')[0]}.json"`)
    return res.json(backup)
  })

  /**
   * @swagger
   * /api/export/import:
   *   post:
   *     summary: Import data from backup
   *     description: Restore data from JSON backup (admin only)
   *     tags: [Export]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               tasks:
   *                 type: array
   *                 items:
   *                   $ref: '#/components/schemas/Task'
   *               labels:
   *                 type: array
   *                 items:
   *                   $ref: '#/components/schemas/Label'
   *               workflows:
   *                 type: array
   *                 items:
   *                   $ref: '#/components/schemas/Workflow'
   *     responses:
   *       200:
   *         description: Import successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 imported:
   *                   type: object
   *                   properties:
   *                     tasks:
   *                       type: integer
   *                     labels:
   *                       type: integer
   *                     workflows:
   *                       type: integer
   *       403:
   *         description: Admin only
   */
  router.post('/import', (req: AuthedRequest, res: Response) => {
    const user = req.user
    if (!user || user.role !== 'adult') {
      return res.status(403).json({ error: 'admin_only' })
    }

    const { tasks, labels, workflows } = req.body

    let imported = {
      tasks: 0,
      labels: 0,
      workflows: 0,
    }

    // Import labels first (tasks may reference them)
    if (Array.isArray(labels)) {
      for (const label of labels) {
        try {
          db.prepare(
            'INSERT OR IGNORE INTO labels (id, name, color, shared, owner_id) VALUES (?, ?, ?, ?, ?)'
          ).run(label.id, label.name, label.color || '#0ea5e9', label.shared || 1, label.owner_id || user.id)
          imported.labels++
        } catch (e) {
          // Skip on error
        }
      }
    }

    // Import workflows
    if (Array.isArray(workflows)) {
      for (const workflow of workflows) {
        try {
          db.prepare(
            'INSERT OR IGNORE INTO workflows (id, name, stages, checkbox_only, owner_id, shared, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(
            workflow.id,
            workflow.name,
            workflow.stages,
            workflow.checkbox_only || 0,
            workflow.owner_id || user.id,
            workflow.shared || 1,
            workflow.is_default || 0
          )
          imported.workflows++
        } catch (e) {
          // Skip on error
        }
      }
    }

    // Import tasks
    if (Array.isArray(tasks)) {
      for (const task of tasks) {
        try {
          db.prepare(
            'INSERT OR IGNORE INTO tasks (id, title, completed, workflow, workflowStage, created_by, labels, assigneeIds, shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(
            task.id,
            task.title,
            task.completed || 0,
            task.workflow || null,
            task.workflowStage || null,
            task.created_by || user.id,
            task.labels || null,
            task.assigneeIds || null,
            task.shared || 1
          )
          imported.tasks++
        } catch (e) {
          // Skip on error
        }
      }
    }

    return res.json({ imported })
  })

  return router
}
