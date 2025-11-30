import { Router, type Response } from 'express'
import { db, SavedFilterRow, TaskRow } from './db.js'
import { type AuthedRequest } from './middleware.js'
import { broadcastToUsers } from './events.js'

// v0.0.57: Completely rebuilt saved-filters following Labels architecture exactly

export function savedFiltersRouter() {
  const router = Router()

  /**
   * @swagger
   * /api/saved-filters:
   *   get:
   *     summary: List all saved filters
   *     description: Returns all saved filters accessible to the current user (owned or shared)
   *     tags: [Saved Filters]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of saved filters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/SavedFilter'
   */
  router.get('/', (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id
    const rows = db.prepare('SELECT * FROM saved_filters ORDER BY id DESC').all() as SavedFilterRow[]

    // Filter saved filters based on access (identical to labels logic)
    const accessible = rows.filter(filter => {
      // Owner always has access
      if (userId && filter.owner_id === userId) return true
      // Shared filters are visible to all
      if (filter.shared === 1) return true
      return false
    })

    return res.json({ items: accessible })
  })

  /**
   * @swagger
   * /api/saved-filters:
   *   post:
   *     summary: Create a new saved filter
   *     description: Creates a new saved filter for the current user
   *     tags: [Saved Filters]
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
   *               - name
   *               - queryJson
   *             properties:
   *               name:
   *                 type: string
   *                 description: Filter name
   *               queryJson:
   *                 type: object
   *                 description: Filter query rules (labels, assignees, etc.)
   *               menuVisible:
   *                 type: boolean
   *                 description: Whether filter is visible in menu
   *                 default: true
   *               shared:
   *                 type: boolean
   *                 description: Whether filter is shared with family workspace
   *                 default: true
   *     responses:
   *       200:
   *         description: Saved filter created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 item:
   *                   $ref: '#/components/schemas/SavedFilter'
   *       400:
   *         description: Missing required fields
   */
  router.post('/', (req: AuthedRequest, res: Response) => {
    const { name, queryJson, menuVisible, shared, ranking } = req.body
    const userId = req.user?.id
    if (!name) return res.status(400).json({ error: 'missing_name' })
    if (!queryJson) return res.status(400).json({ error: 'missing_query_json' })
    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    // Normalize name for deduplication (like labels)
    const normalizedName = name.trim().toLowerCase()

    // Check if filter with this normalized name already exists for this user
    const existing = db.prepare('SELECT * FROM saved_filters WHERE normalized_name = ? AND owner_id = ?').get(normalizedName, userId) as SavedFilterRow | undefined
    if (existing) {
      // Return existing filter instead of creating duplicate
      return res.json({ item: existing })
    }

    // Default shared and menuVisible to true (1)
    const sharedValue = shared !== undefined ? (shared ? 1 : 0) : 1
    const menuVisibleValue = menuVisible !== undefined ? (menuVisible ? 1 : 0) : 1
    const rankingValue = ranking !== undefined ? ranking : 0

    const now = new Date().toISOString()

    const info = db.prepare(
      'INSERT INTO saved_filters (name, normalized_name, query_json, menu_visible, shared, owner_id, ranking, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      name,
      normalizedName,
      JSON.stringify(queryJson),
      menuVisibleValue,
      sharedValue,
      userId,
      rankingValue,
      now,
      now,
      1
    )

    const item = db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(info.lastInsertRowid) as SavedFilterRow

    // HOTFIX 0.0.57: Broadcast to all users if shared, otherwise just owner
    const targetUsers = item.shared === 1
      ? db.prepare('SELECT id FROM users').all().map((u: any) => u.id)
      : [userId]
    broadcastToUsers(targetUsers, 'filter:created', { item })

    return res.json({ item })
  })

  /**
   * @swagger
   * /api/saved-filters/{id}:
   *   patch:
   *     summary: Update a saved filter
   *     description: Update filter name, query, menu visibility, or shared status. Only owner can change shared status.
   *     tags: [Saved Filters]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Saved filter ID
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               queryJson:
   *                 type: object
   *               menuVisible:
   *                 type: boolean
   *               shared:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Saved filter updated
   *       403:
   *         description: Not owner (when trying to change shared status)
   *       404:
   *         description: Saved filter not found
   */
  router.patch('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const { name, queryJson, menuVisible, shared, ranking } = req.body
    const userId = req.user?.id

    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    const filter = db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(id) as SavedFilterRow | undefined
    if (!filter) return res.status(404).json({ error: 'filter_not_found' })

    // If trying to change 'shared', must be owner (like labels)
    if (shared !== undefined && filter.owner_id !== userId) {
      return res.status(403).json({ error: 'not_owner' })
    }

    const updates = []
    const values = []

    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name)
      updates.push('normalized_name = ?')
      values.push(name.trim().toLowerCase())
    }
    if (queryJson !== undefined) {
      updates.push('query_json = ?')
      values.push(JSON.stringify(queryJson))
    }
    if (menuVisible !== undefined) {
      updates.push('menu_visible = ?')
      values.push(menuVisible ? 1 : 0)
    }
    if (shared !== undefined) {
      updates.push('shared = ?')
      values.push(shared ? 1 : 0)
    }
    if (ranking !== undefined) {
      updates.push('ranking = ?')
      values.push(ranking)
    }

    if (updates.length === 0) return res.status(400).json({ error: 'no_updates' })

    // Always update version and updated_at (like labels)
    updates.push('version = version + 1')
    updates.push('updated_at = ?')
    values.push(new Date().toISOString())

    values.push(id)
    db.prepare(`UPDATE saved_filters SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const item = db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(id) as SavedFilterRow

    // HOTFIX 0.0.57: Broadcast to all users if shared, otherwise just owner
    const targetUsers = item.shared === 1
      ? db.prepare('SELECT id FROM users').all().map((u: any) => u.id)
      : [userId]
    broadcastToUsers(targetUsers, 'filter:updated', { item })

    return res.json({ item })
  })

  /**
   * @swagger
   * /api/saved-filters/{id}:
   *   delete:
   *     summary: Delete a saved filter
   *     description: Permanently delete a saved filter
   *     tags: [Saved Filters]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Saved filter ID
   *     responses:
   *       200:
   *         description: Saved filter deleted
   */
  router.delete('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const userId = req.user?.id

    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    const filter = db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(id) as SavedFilterRow | undefined
    if (!filter) return res.status(404).json({ error: 'filter_not_found' })

    // Only owner can delete (like labels)
    if (filter.owner_id !== userId) {
      return res.status(403).json({ error: 'not_owner' })
    }

    // HOTFIX 0.0.57: Broadcast to all users if filter was shared, otherwise just owner
    const targetUsers = filter.shared === 1
      ? db.prepare('SELECT id FROM users').all().map((u: any) => u.id)
      : [userId]

    db.prepare('DELETE FROM saved_filters WHERE id = ?').run(id)

    broadcastToUsers(targetUsers, 'filter:deleted', { id })

    return res.json({ ok: true })
  })

  /**
   * @swagger
   * /api/saved-filters/{id}/count:
   *   get:
   *     summary: Get filter item count
   *     description: Returns the number of tasks matching this filter's query
   *     tags: [Saved Filters]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Saved filter ID
   *     responses:
   *       200:
   *         description: Filter count
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: integer
   */
  router.get('/:id/count', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const userId = req.user?.id

    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    const filter = db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(id) as SavedFilterRow | undefined
    if (!filter) return res.status(404).json({ error: 'filter_not_found' })

    // Check access
    if (filter.owner_id !== userId && filter.shared !== 1) {
      return res.status(403).json({ error: 'access_denied' })
    }

    // Parse query and count matching tasks
    try {
      const query = JSON.parse(filter.query_json)

      // Get all accessible tasks
      const allTasks = db.prepare('SELECT * FROM tasks WHERE (created_by = ? OR shared = 1)').all(userId) as TaskRow[]

      // Filter tasks based on queryJson
      let filtered = allTasks

      // HOTFIX: Handle @me marker in selectedAssigneeIds
      if (query.selectedAssigneeIds && Array.isArray(query.selectedAssigneeIds)) {
        // Replace '@me' marker with actual userId
        const assigneeIds = query.selectedAssigneeIds.map((id: string) =>
          id === '@me' ? String(userId) : id
        )

        if (assigneeIds.length > 0) {
          filtered = filtered.filter(task => {
            // Parse assigneeIds from JSON column
            try {
              const taskAssignees = task.assigneeIds ? JSON.parse(task.assigneeIds) : []
              // Check if task has ANY of the selected assignees
              return taskAssignees.some((assigneeId: string | number) =>
                assigneeIds.includes(String(assigneeId))
              )
            } catch (e) {
              // Invalid JSON in assigneeIds, skip this task
              console.error('Invalid assigneeIds JSON:', task.assigneeIds, e)
              return false
            }
          })
        }
      }

      // HOTFIX 0.0.57: Implement label filtering
      if (query.selectedLabelIds && Array.isArray(query.selectedLabelIds) && query.selectedLabelIds.length > 0) {
        filtered = filtered.filter(task => {
          try {
            const taskLabels = task.labels ? JSON.parse(task.labels) : []
            // Check if task has ALL selected labels (AND logic)
            return query.selectedLabelIds.every((labelId: string) =>
              taskLabels.includes(labelId)
            )
          } catch (e) {
            return false
          }
        })
      }

      // HOTFIX 0.0.57: Implement workflow filtering
      if (query.selectedWorkflowIds && Array.isArray(query.selectedWorkflowIds) && query.selectedWorkflowIds.length > 0) {
        filtered = filtered.filter(task => {
          const taskWorkflowId = task.workflow
          return taskWorkflowId && query.selectedWorkflowIds.includes(String(taskWorkflowId))
        })
      }

      // HOTFIX 0.0.57: Implement blockedOnly filtering
      if (query.blockedOnly === true) {
        filtered = filtered.filter(task => task.blocked === 1)
      }

      // Handle showCompleted filter (default: hide completed)
      if (query.showCompleted === false) {
        filtered = filtered.filter(task => task.completed === 0)
      }

      // Note: showArchived filter not implemented in server-side schema yet
      // Tasks table doesn't have archived column
      // Note: dueStart/dueEnd filtering not implemented (no dueDate column in tasks table)

      const count = filtered.length

      return res.json({ count })
    } catch (e) {
      console.error('Query execution failed:', e)
      return res.status(500).json({ error: 'query_execution_failed' })
    }
  })

  return router
}
