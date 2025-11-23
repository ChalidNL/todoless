import { Router, type Response } from 'express'
import { db, SavedFilterRow } from './db.js'
import type { AuthedRequest } from './middleware.js'
import { broadcastToUsers } from './events.js'

export function savedFiltersRouter() {
  const router = Router()

  /**
   * @swagger
   * /api/saved-filters:
   *   get:
   *     summary: List all saved filters
   *     description: Returns all saved filters for the current user
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
    const userId = req.user!.id
    const rows = db.prepare('SELECT * FROM saved_filters WHERE user_id = ? ORDER BY filter_order, created_at DESC').all(userId) as SavedFilterRow[]
    return res.json({ items: rows })
  })

  /**
   * @swagger
   * /api/saved-filters/{id}:
   *   get:
   *     summary: Get a saved filter by ID
   *     description: Returns a single saved filter if accessible to current user
   *     tags: [Saved Filters]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Saved filter ID
   *     responses:
   *       200:
   *         description: Saved filter details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 item:
   *                   $ref: '#/components/schemas/SavedFilter'
   *       403:
   *         description: Access denied
   *       404:
   *         description: Saved filter not found
   */
  router.get('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const userId = req.user!.id
    const filter = db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(id) as SavedFilterRow | undefined

    if (!filter) return res.status(404).json({ error: 'filter_not_found' })

    // Only user who created the filter can access it
    if (filter.user_id !== userId) {
      return res.status(403).json({ error: 'access_denied' })
    }

    return res.json({ item: filter })
  })

  /**
   * @swagger
   * /api/saved-filters:
   *   post:
   *     summary: Create a new saved filter
   *     description: Creates a new saved filter with optional client_id for sync deduplication
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
   *               - id
   *               - name
   *               - slug
   *             properties:
   *               id:
   *                 type: string
   *                 description: Filter ID (client-generated UUID)
   *                 example: 'abc-123-def'
   *               name:
   *                 type: string
   *                 description: Filter name
   *                 example: 'My Custom Filter'
   *               slug:
   *                 type: string
   *                 description: URL-friendly slug
   *                 example: 'my-custom-filter'
   *               icon:
   *                 type: string
   *                 description: Filter icon (emoji or icon name)
   *                 example: '🔍'
   *               labelFilterIds:
   *                 type: string
   *                 description: JSON array of label IDs
   *                 example: '["1", "2"]'
   *               attributeFilters:
   *                 type: string
   *                 description: JSON object of attribute filters
   *                 example: '{"filters": "{\"selectedLabelIds\":[],\"blockedOnly\":false}"}'
   *               statusFilter:
   *                 type: string
   *                 description: Status filter value
   *               sortBy:
   *                 type: string
   *                 description: Sort field
   *                 example: 'created'
   *               viewMode:
   *                 type: string
   *                 description: View mode
   *                 example: 'list'
   *               showInSidebar:
   *                 type: boolean
   *                 description: Whether to show in sidebar
   *                 default: true
   *               isSystem:
   *                 type: boolean
   *                 description: Whether this is a system filter
   *                 default: false
   *               isDefault:
   *                 type: boolean
   *                 description: Whether this is the default filter
   *                 default: false
   *               parentId:
   *                 type: string
   *                 description: Parent filter ID for nested filters
   *               order:
   *                 type: integer
   *                 description: Display order
   *               client_id:
   *                 type: string
   *                 description: Client-generated ID for deduplication during sync
   *     responses:
   *       200:
   *         description: Saved filter created (or existing filter if client_id matches)
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
    const {
      id,
      name,
      slug,
      icon,
      labelFilterIds,
      attributeFilters,
      statusFilter,
      sortBy,
      viewMode,
      showInSidebar,
      isSystem,
      isDefault,
      parentId,
      order,
      client_id
    } = req.body
    const userId = req.user!.id

    if (!id || !name || !slug) return res.status(400).json({ error: 'missing_required_fields' })

    // v0.0.55: Check for duplicate by client_id to prevent double-creates during sync
    if (client_id) {
      const existing = db.prepare('SELECT * FROM saved_filters WHERE client_id = ?').get(client_id) as SavedFilterRow | undefined
      if (existing) {
        return res.json({ item: existing })
      }
    }

    // Also check for duplicate by ID (since client generates the ID)
    const existingById = db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(id) as SavedFilterRow | undefined
    if (existingById) {
      return res.json({ item: existingById })
    }

    const now = new Date().toISOString()

    const info = db.prepare(
      `INSERT INTO saved_filters (
        id, name, slug, icon, label_filter_ids, attribute_filters, status_filter,
        sort_by, view_mode, user_id, show_in_sidebar, is_system, is_default,
        parent_id, filter_order, created_at, updated_at, client_id, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      name,
      slug,
      icon || null,
      labelFilterIds || null,
      attributeFilters || null,
      statusFilter || null,
      sortBy || null,
      viewMode || null,
      userId,
      showInSidebar !== false ? 1 : 0,
      isSystem ? 1 : 0,
      isDefault ? 1 : 0,
      parentId || null,
      order || null,
      now,
      now,
      client_id || null,
      1 // Initial version
    )

    const item = db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(id)

    // v0.0.55: Broadcast filter creation to user for real-time sync across devices
    broadcastToUsers([userId], 'saved-filter.created', { item })

    return res.json({ item })
  })

  /**
   * @swagger
   * /api/saved-filters/{id}:
   *   patch:
   *     summary: Update a saved filter
   *     description: Update filter fields. Version is auto-incremented. Only owner can update.
   *     tags: [Saved Filters]
   *     security:
   *       - cookieAuth: []
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Saved filter ID
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               slug:
   *                 type: string
   *               icon:
   *                 type: string
   *               labelFilterIds:
   *                 type: string
   *               attributeFilters:
   *                 type: string
   *               statusFilter:
   *                 type: string
   *               sortBy:
   *                 type: string
   *               viewMode:
   *                 type: string
   *               showInSidebar:
   *                 type: boolean
   *               isDefault:
   *                 type: boolean
   *               parentId:
   *                 type: string
   *               order:
   *                 type: integer
   *     responses:
   *       200:
   *         description: Saved filter updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 item:
   *                   $ref: '#/components/schemas/SavedFilter'
   *       403:
   *         description: Access denied
   *       404:
   *         description: Saved filter not found
   */
  router.patch('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const userId = req.user!.id

    const filter = db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(id) as SavedFilterRow | undefined
    if (!filter) return res.status(404).json({ error: 'filter_not_found' })

    // Only owner can update
    if (filter.user_id !== userId) {
      return res.status(403).json({ error: 'access_denied' })
    }

    const {
      name,
      slug,
      icon,
      labelFilterIds,
      attributeFilters,
      statusFilter,
      sortBy,
      viewMode,
      showInSidebar,
      isDefault,
      parentId,
      order
    } = req.body

    const updates: string[] = []
    const values: any[] = []

    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (slug !== undefined) { updates.push('slug = ?'); values.push(slug) }
    if (icon !== undefined) { updates.push('icon = ?'); values.push(icon) }
    if (labelFilterIds !== undefined) { updates.push('label_filter_ids = ?'); values.push(labelFilterIds) }
    if (attributeFilters !== undefined) { updates.push('attribute_filters = ?'); values.push(attributeFilters) }
    if (statusFilter !== undefined) { updates.push('status_filter = ?'); values.push(statusFilter) }
    if (sortBy !== undefined) { updates.push('sort_by = ?'); values.push(sortBy) }
    if (viewMode !== undefined) { updates.push('view_mode = ?'); values.push(viewMode) }
    if (showInSidebar !== undefined) { updates.push('show_in_sidebar = ?'); values.push(showInSidebar ? 1 : 0) }
    if (isDefault !== undefined) { updates.push('is_default = ?'); values.push(isDefault ? 1 : 0) }
    if (parentId !== undefined) { updates.push('parent_id = ?'); values.push(parentId) }
    if (order !== undefined) { updates.push('filter_order = ?'); values.push(order) }

    // v0.0.55: Increment version for sync tracking
    updates.push('version = version + 1')

    // Always update updatedAt
    updates.push('updated_at = ?')
    values.push(new Date().toISOString())

    if (updates.length === 0) return res.status(400).json({ error: 'no_updates' })

    values.push(id)
    db.prepare(`UPDATE saved_filters SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const item = db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(id)

    // v0.0.55: Broadcast filter update to user for real-time sync
    broadcastToUsers([userId], 'saved-filter.updated', { item })

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
   *           type: string
   *         description: Saved filter ID
   *     responses:
   *       200:
   *         description: Saved filter deleted
   *       403:
   *         description: Access denied
   *       404:
   *         description: Saved filter not found
   */
  router.delete('/:id', (req: AuthedRequest, res: Response) => {
    const { id } = req.params
    const userId = req.user!.id

    const filter = db.prepare('SELECT * FROM saved_filters WHERE id = ?').get(id) as SavedFilterRow | undefined
    if (!filter) return res.status(404).json({ error: 'filter_not_found' })

    // Only owner can delete
    if (filter.user_id !== userId) {
      return res.status(403).json({ error: 'access_denied' })
    }

    db.prepare('DELETE FROM saved_filters WHERE id = ?').run(id)

    // v0.0.55: Broadcast filter deletion to user for real-time sync
    broadcastToUsers([userId], 'saved-filter.deleted', { id })

    return res.json({ ok: true })
  })

  return router
}
