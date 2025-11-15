import { Router, type Request, type Response } from 'express'
import { db } from './db.js'
import { broadcastToUsers } from './events.js'
import crypto from 'crypto'

export function importRouter() {
  const router = Router()

  // POST /api/import/bulk - Idempotent bulk import
  router.post('/bulk', (req: any, res: Response) => {
    const { items } = req.body as { items: Array<{ title: string; labels?: string[] }> }
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' })
    }

    let imported = 0
    let skipped = 0
    let failed = 0
    let updated = 0
    const errors: Array<{ title: string; error: string }> = []
    const log: string[] = []
    const importId = `import_${Date.now()}`

    log.push(`=== Import Started: ${new Date().toISOString()} ===`)
    log.push(`Import ID: ${importId}`)
    log.push(`User ID: ${userId}`)
    log.push(`Total items: ${items.length}`)
    log.push('')

    // Helper function to generate random color
    const randomColor = () => {
      const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
        '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
        '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
      ]
      return colors[Math.floor(Math.random() * colors.length)]
    }

    // Use transaction for atomic import
    const importResult = db.transaction(() => {
      for (const item of items) {
        try {
          if (!item.title?.trim()) {
            failed++
            errors.push({ title: item.title || '', error: 'empty_title' })
            log.push(`[FAIL] Empty title`)
            continue
          }

          const normalizedTitle = item.title.trim().toLowerCase().replace(/\s+/g, ' ')
          const extId = crypto.createHash('sha1').update(`${userId}|${normalizedTitle}`).digest('hex')

          // Check if task with this extId already exists
          const existing = db.prepare(
            'SELECT id, title FROM tasks WHERE client_id = ? AND created_by = ?'
          ).get(extId, userId) as any

          if (existing) {
            // If title has changed (e.g., case change), update it
            if (existing.title !== item.title.trim()) {
              db.prepare('UPDATE tasks SET title = ? WHERE id = ?')
                .run(item.title.trim(), existing.id)
              log.push(`[UPDATE] "${existing.title}" → "${item.title.trim()}" (case changed)`)
              updated++
            } else {
              log.push(`[SKIP] "${item.title.trim()}" (duplicate)`)
            }
            skipped++
            continue
          }

          // Create or find labels first, collect their IDs
          const labelIds: number[] = []
          const createdLabels: string[] = []
          if (item.labels && item.labels.length > 0) {
            for (const labelName of item.labels) {
              const normalized = labelName.trim().toLowerCase()
              if (!normalized) continue

              // Find or create label
              let existingLabel = db.prepare(
                'SELECT id FROM labels WHERE LOWER(name) = ?'
              ).get(normalized) as any

              if (!existingLabel) {
                const color = randomColor()
                const insertResult = db.prepare(
                  'INSERT INTO labels (name, color, shared) VALUES (?, ?, 1)'
                ).run(labelName.trim(), color)

                existingLabel = db.prepare(
                  'SELECT id FROM labels WHERE id = ?'
                ).get(insertResult.lastInsertRowid) as any

                createdLabels.push(`${labelName.trim()} (${color})`)
              }

              if (existingLabel) {
                labelIds.push(existingLabel.id)
              }
            }
          }

          // Create task with label IDs (not names!)
          const taskInfo = db.prepare(
            'INSERT INTO tasks (title, created_by, created_at, client_id, completed, labels) VALUES (?, ?, ?, ?, 0, ?)'
          ).run(
            item.title.trim(),
            userId,
            new Date().toISOString(),
            extId,
            labelIds.length > 0 ? JSON.stringify(labelIds) : null
          )

          const labelInfo = item.labels && item.labels.length > 0
            ? ` with labels [${item.labels.join(', ')}]`
            : ''
          const newLabelInfo = createdLabels.length > 0
            ? ` (new: ${createdLabels.join(', ')})`
            : ''

          log.push(`[IMPORT] "${item.title.trim()}"${labelInfo}${newLabelInfo}`)
          imported++

          // Broadcast SSE event for realtime sync
          try {
            const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskInfo.lastInsertRowid) as any
            broadcastToUsers([userId], 'task:created', { task })

            // Also broadcast label:created events for newly created labels
            // This ensures clients sync the new labels immediately
          } catch (e) {
            // Non-critical, continue
          }

        } catch (e: any) {
          failed++
          const errorMsg = e.message || 'unknown_error'
          errors.push({ title: item.title, error: errorMsg })
          log.push(`[ERROR] "${item.title}" - ${errorMsg}`)
        }
      }

      // After import, broadcast a labels:updated event to trigger label sync
      try {
        const allLabels = db.prepare('SELECT * FROM labels').all()
        broadcastToUsers([userId], 'labels:updated', { labels: allLabels })
      } catch (e) {
        // Non-critical
      }

      // Add summary to log
      log.push('')
      log.push(`=== Import Completed: ${new Date().toISOString()} ===`)
      log.push(`Total items: ${items.length}`)
      log.push(`✓ Imported: ${imported}`)
      log.push(`↻ Updated: ${updated}`)
      log.push(`⊘ Skipped: ${skipped - updated}`)
      log.push(`✗ Failed: ${failed}`)
    })()

    // Save log to file (simple text file in server directory)
    const fs = require('fs')
    const path = require('path')
    const logDir = path.join(process.cwd(), 'import-logs')

    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
      }
      const logFile = path.join(logDir, `${importId}.txt`)
      fs.writeFileSync(logFile, log.join('\n'), 'utf8')
    } catch (e) {
      // Non-critical - log writing failed
    }

    return res.json({
      summary: {
        total: items.length,
        imported,
        updated,
        skipped,
        failed
      },
      errors: errors.length > 0 ? errors : undefined,
      logFile: `${importId}.txt`,
      log: log.join('\n')
    })
  })

  // GET /api/import/logs/:filename - Download import log
  router.get('/logs/:filename', (req: any, res: Response) => {
    const { filename } = req.params
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    // Security: only allow .txt files with specific naming pattern
    if (!/^import_\d+\.txt$/.test(filename)) {
      return res.status(400).json({ error: 'invalid_filename' })
    }

    const fs = require('fs')
    const path = require('path')
    const logDir = path.join(process.cwd(), 'import-logs')
    const logFile = path.join(logDir, filename)

    try {
      if (!fs.existsSync(logFile)) {
        return res.status(404).json({ error: 'log_not_found' })
      }

      const content = fs.readFileSync(logFile, 'utf8')
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      return res.send(content)
    } catch (e: any) {
      return res.status(500).json({ error: 'failed_to_read_log', message: e.message })
    }
  })

  return router
}
