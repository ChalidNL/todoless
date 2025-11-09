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
import { logger } from './logger.js'

const app = express()
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

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

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter(JWT_SECRET))

// Protected tasks routes
app.use('/api/tasks', requireAuth(JWT_SECRET), require2FA(), tasksRouter())

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
