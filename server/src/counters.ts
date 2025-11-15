import { Router, type Request, type Response } from 'express'
import { db } from './db.js'

export function countersRouter() {
  const router = Router()

  // GET /api/counters - Server-side source of truth for counts
  router.get('/', (req: any, res: Response) => {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    try {
      // Count total tasks for this user
      const tasksCount = db.prepare(
        'SELECT COUNT(*) as count FROM tasks WHERE created_by = ?'
      ).get(userId) as any

      // Count completed tasks
      const completedCount = db.prepare(
        'SELECT COUNT(*) as count FROM tasks WHERE created_by = ? AND completed = 1'
      ).get(userId) as any

      // Count active (incomplete) tasks
      const activeCount = db.prepare(
        'SELECT COUNT(*) as count FROM tasks WHERE created_by = ? AND completed = 0'
      ).get(userId) as any

      // Count labels
      const labelsCount = db.prepare(
        'SELECT COUNT(*) as count FROM labels'
      ).get() as any

      return res.json({
        total: tasksCount.count || 0,
        completed: completedCount.count || 0,
        active: activeCount.count || 0,
        labels: labelsCount.count || 0,
        timestamp: new Date().toISOString()
      })
    } catch (e: any) {
      return res.status(500).json({ error: 'failed_to_count', message: e.message })
    }
  })

  return router
}
