import { Router, type Response } from 'express'
import { db } from './db.js'
import { type AuthedRequest } from './middleware.js'

export interface WorkflowRow {
  id: number
  name: string
  stages: string // JSON array
  checkbox_only: number
  owner_id: number
  shared: number
  is_default: number
  created_at: string
  updated_at: string
}

export function workflowsRouter() {
  const router = Router()

  /**
   * @swagger
   * /api/workflows:
   *   get:
   *     summary: List all workflows
   *     description: Returns all workflows accessible to the current user (owned or shared)
   *     tags: [Workflows]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of workflows
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Workflow'
   */
  router.get('/', (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id
    const rows = db.prepare('SELECT * FROM workflows ORDER BY id ASC').all() as WorkflowRow[]

    // Filter workflows based on access
    const accessible = rows.filter(workflow => {
      // Owner always has access
      if (userId && workflow.owner_id === userId) return true
      // Shared workflows visible to all
      if (workflow.shared === 1) return true
      return false
    })

    return res.json({ items: accessible })
  })

  /**
   * @swagger
   * /api/workflows:
   *   post:
   *     summary: Create a new workflow
   *     description: Creates a new workflow with stages for the current user
   *     tags: [Workflows]
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
   *               - stages
   *             properties:
   *               name:
   *                 type: string
   *                 description: Workflow name
   *                 example: 'Development Process'
   *               stages:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Workflow stages in order
   *                 example: ['Backlog', 'Todo', 'In Progress', 'Review', 'Done']
   *               checkboxOnly:
   *                 type: boolean
   *                 description: Whether workflow uses checkboxes only (no stages)
   *                 default: false
   *               shared:
   *                 type: boolean
   *                 description: Whether workflow is shared with family workspace
   *                 default: true
   *               isDefault:
   *                 type: boolean
   *                 description: Mark as default workflow
   *                 default: false
   *     responses:
   *       200:
   *         description: Workflow created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 item:
   *                   $ref: '#/components/schemas/Workflow'
   *       400:
   *         description: Missing required fields
   */
  router.post('/', (req: AuthedRequest, res: Response) => {
    const { name, stages, checkboxOnly, shared, isDefault } = req.body
    const userId = req.user?.id

    if (!name) return res.status(400).json({ error: 'missing_name' })
    if (!stages || !Array.isArray(stages)) return res.status(400).json({ error: 'missing_stages' })
    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    const sharedValue = shared !== undefined ? (shared ? 1 : 0) : 1
    const checkboxOnlyValue = checkboxOnly ? 1 : 0
    const isDefaultValue = isDefault ? 1 : 0

    const info = db.prepare(
      'INSERT INTO workflows (name, stages, checkbox_only, owner_id, shared, is_default) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      name,
      JSON.stringify(stages),
      checkboxOnlyValue,
      userId,
      sharedValue,
      isDefaultValue
    )

    const item = db.prepare('SELECT * FROM workflows WHERE id = ?').get(info.lastInsertRowid)
    return res.json({ item })
  })

  /**
   * @swagger
   * /api/workflows/{id}:
   *   patch:
   *     summary: Update a workflow
   *     description: Update workflow name, stages, or settings. Only owner can change shared status.
   *     tags: [Workflows]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Workflow ID
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               stages:
   *                 type: array
   *                 items:
   *                   type: string
   *               checkboxOnly:
   *                 type: boolean
   *               shared:
   *                 type: boolean
   *               isDefault:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Workflow updated
   *       403:
   *         description: Not owner
   *       404:
   *         description: Workflow not found
   */
  router.patch('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const { name, stages, checkboxOnly, shared, isDefault } = req.body
    const userId = req.user?.id

    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as WorkflowRow | undefined
    if (!workflow) return res.status(404).json({ error: 'workflow_not_found' })

    // If trying to change 'shared', must be owner
    if (shared !== undefined && workflow.owner_id !== userId) {
      return res.status(403).json({ error: 'not_owner' })
    }

    const updates = []
    const values = []
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (stages !== undefined) {
      if (!Array.isArray(stages)) return res.status(400).json({ error: 'stages_must_be_array' })
      updates.push('stages = ?')
      values.push(JSON.stringify(stages))
    }
    if (checkboxOnly !== undefined) { updates.push('checkbox_only = ?'); values.push(checkboxOnly ? 1 : 0) }
    if (shared !== undefined) { updates.push('shared = ?'); values.push(shared ? 1 : 0) }
    if (isDefault !== undefined) { updates.push('is_default = ?'); values.push(isDefault ? 1 : 0) }

    if (updates.length === 0) return res.status(400).json({ error: 'no_updates' })

    values.push(id)
    db.prepare(`UPDATE workflows SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const item = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id)
    return res.json({ item })
  })

  /**
   * @swagger
   * /api/workflows/{id}:
   *   delete:
   *     summary: Delete a workflow
   *     description: Permanently delete a workflow (owner only)
   *     tags: [Workflows]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Workflow ID
   *     responses:
   *       200:
   *         description: Workflow deleted
   *       403:
   *         description: Not owner
   *       404:
   *         description: Workflow not found
   */
  router.delete('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const userId = req.user?.id

    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as WorkflowRow | undefined
    if (!workflow) return res.status(404).json({ error: 'workflow_not_found' })

    if (workflow.owner_id !== userId) {
      return res.status(403).json({ error: 'not_owner' })
    }

    db.prepare('DELETE FROM workflows WHERE id = ?').run(id)
    return res.json({ ok: true })
  })

  return router
}
