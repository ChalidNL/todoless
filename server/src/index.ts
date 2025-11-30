import 'dotenv/config'
import express from 'express'
import path from 'path'
import fs from 'fs'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { authRouter } from './auth.js'
import { tasksRouter } from './tasks.js'
import { requireAuth, require2FA } from './middleware.js'
import { addClient, removeClient } from './events.js'
import { logger, getRecentLogs } from './logger.js'
/* TEST-ONLY: Seed admin user in dev/test */
import bcrypt from 'bcrypt'
import { db } from './db.js'
const app = express()
import { labelsRouter } from './labels.js'
import { importRouter } from './import.js'
import { countersRouter } from './counters.js'
import { notesRouter } from './notes.js'
import { apiTokensRouter } from './api-tokens.js'
import { workflowsRouter } from './workflows.js'
import { exportRouter } from './export.js'
import { searchRouter } from './search.js'
import { savedFiltersRouter } from './saved-filters.js'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './swagger.js'

/* TEST-ONLY: Seed admin user in local/test omgeving. Nooit in productie! */
if (process.env.NODE_ENV !== 'production') {
  (async () => {
    try {
      const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin')
      if (!admin) {
        const hash = await bcrypt.hash('admin123', 12)
        db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)')
          .run('admin', 'admin@localhost', hash, 'adult')
        logger.info('TEST-ONLY: admin user seeded', { username: 'admin' })
      }
    } catch (err) {
      logger.error('TEST-ONLY: admin seed failed', { err: String(err) })
    }
  })()
}
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
// Default CORS origin: match Vite dev server (5174) used locally
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5174'

// Helmet security headers. For LAN HTTP we disable strict COOP/COEP and CSP to
// avoid HTTPS upgrades and agent-cluster warnings in browsers. The API is not
// exposed publicly here.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
}))
app.use(express.json())
app.use(cookieParser())
// Allow single or multiple origins via CORS_ORIGIN (comma-separated). Special-case '*' to allow any origin (echoed) which is handy when front is proxied via nginx.
const allowlist = ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
const allowAny = allowlist.includes('*')
app.use(cors((req, callback) => {
  const origin = req.header('Origin')
  if (!origin) return callback(null, { origin: true, credentials: true })
  if (allowAny) return callback(null, { origin: true, credentials: true })
  if (allowlist.length && allowlist.includes(origin)) return callback(null, { origin: true, credentials: true })
  if (process.env.NODE_ENV !== 'production') {
    try {
      const u = new URL(origin)
      const isLocalhost = u.hostname === 'localhost'
      const isLanIPv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(u.hostname)
      const isHttp = u.protocol === 'http:'
      if (isHttp && (isLocalhost || isLanIPv4)) return callback(null, { origin: true, credentials: true })
    } catch {}
  }
  return callback(new Error('Not allowed by CORS'))
}))

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns server health status
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 */
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Swagger API documentation - accessible without auth for easy testing
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'TodoLess API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
}))

// Serve raw OpenAPI spec as JSON
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

app.use('/api/auth', authRouter(JWT_SECRET))

// Protected routes
app.use('/api/labels', requireAuth(JWT_SECRET), labelsRouter())
app.use('/api/workflows', requireAuth(JWT_SECRET), workflowsRouter())
app.use('/api/tasks', requireAuth(JWT_SECRET), require2FA(), tasksRouter())
app.use('/api/notes', requireAuth(JWT_SECRET), notesRouter())
app.use('/api/saved-filters', requireAuth(JWT_SECRET), savedFiltersRouter())
app.use('/api/export', requireAuth(JWT_SECRET), exportRouter())
app.use('/api/search', requireAuth(JWT_SECRET), searchRouter())

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List all users
 *     description: Returns all users in the family workspace
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/users', requireAuth(JWT_SECRET), (req: any, res) => {
  try {
    const users = db.prepare('SELECT id, username, email, role FROM users ORDER BY username').all()
    return res.json({ items: users })
  } catch (err) {
    logger.error('users:list_failed', { err: String(err) })
    return res.status(500).json({ error: 'users_list_failed' })
  }
})

// Import and counters endpoints
app.use('/api/import', requireAuth(JWT_SECRET), require2FA(), importRouter())
app.use('/api/counters', requireAuth(JWT_SECRET), require2FA(), countersRouter())

// API tokens endpoint (admin only)
app.use('/api/tokens', requireAuth(JWT_SECRET), apiTokensRouter())

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: Get system logs
 *     description: Returns recent system logs (admin only)
 *     tags: [System]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *           default: 100
 *         description: Number of log entries to return
 *     responses:
 *       200:
 *         description: Log entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *       403:
 *         description: Admin only
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/logs', requireAuth(JWT_SECRET), (req: any, res) => {
  const user = req.user
  if (user?.role !== 'adult') {
    return res.status(403).json({ error: 'admin_only' })
  }
  const count = Math.min(Math.max(Number(req.query.count) || 100, 1), 500)
  const logs = getRecentLogs(count)
  return res.json({ logs })
})

// Optional static file serving (for single-container fullstack deployment)
if (process.env.SERVE_STATIC === 'true') {
  // Detect public dir for both dev and fullstack Docker runtime
  const candidates = [
    path.join(process.cwd(), 'public'),
    path.join(process.cwd(), 'server', 'public'),
  ]
  const publicDir = candidates.find(p => fs.existsSync(p))
  if (publicDir) {
    logger.info('static:enabled', { dir: publicDir })
    app.use(express.static(publicDir))
    // SPA fallback: only for non-API GET requests
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next()
      const indexPath = path.join(publicDir!, 'index.html')
      if (fs.existsSync(indexPath)) return res.sendFile(indexPath)
      return next()
    })
  }
}

// Server-Sent Events for real-time updates (auth + 2FA protected)
app.get('/api/events', requireAuth(JWT_SECRET), require2FA(), (req: any, res) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  // Ensure CORS for credentials when using SSE behind CORS
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
  }
  res.flushHeaders?.()

  const userId = req.user!.id
  addClient(userId, res)

  // Initial hello event
  res.write(`event: hello\n`)
  res.write(`data: {"ok":true}\n\n`)

  const interval = setInterval(() => {
    try { res.write(`: ping\n\n`) } catch {}
  }, 25000)

  req.on('close', () => {
    clearInterval(interval)
    removeClient(userId, res)
    try { res.end() } catch {}
  })
})

app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error('unhandled', { err: String(err?.message || err) })
  res.status(500).json({ error: 'server_error' })
})

app.listen(PORT, () => {
  logger.info(`server:listening`, { port: PORT })
})
