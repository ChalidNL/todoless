import Database from 'better-sqlite3'
import bcrypt from 'bcrypt'
import { logger } from './logger.js'

const DB_PATH = process.env.DB_PATH || 'family.db'
export const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('adult','child')) DEFAULT 'adult',
  twofa_secret TEXT,
  twofa_enabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  workflow TEXT,
  workflowStage TEXT,
  created_by INTEGER NOT NULL,
  assigned_to INTEGER,
  FOREIGN KEY(created_by) REFERENCES users(id),
  FOREIGN KEY(assigned_to) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('adult','child')) DEFAULT 'child',
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  used_by INTEGER,
  used_at TEXT,
  FOREIGN KEY(created_by) REFERENCES users(id),
  FOREIGN KEY(used_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reset_requests (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','denied','done')) DEFAULT 'pending',
  created_at TEXT NOT NULL,
  approved_by INTEGER,
  approved_at TEXT,
  used_at TEXT,
  expires_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(approved_by) REFERENCES users(id)
);
`)

// Lightweight migrations for existing databases
// Ensure new columns exist on the tasks table without destroying data
try {
  const columns = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>
  const names = new Set(columns.map(c => c.name))

  if (!names.has('completed')) {
    db.prepare(`ALTER TABLE tasks ADD COLUMN completed INTEGER DEFAULT 0`).run()
  }
  if (!names.has('labels')) {
    db.prepare(`ALTER TABLE tasks ADD COLUMN labels TEXT`).run()
  }
  if (!names.has('attributes')) {
    db.prepare(`ALTER TABLE tasks ADD COLUMN attributes TEXT`).run()
  }
  if (!names.has('created_at')) {
    db.prepare(`ALTER TABLE tasks ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`).run()
  }
  if (!names.has('client_id')) {
    db.prepare(`ALTER TABLE tasks ADD COLUMN client_id TEXT`).run()
  }
} catch (e) {
  logger.error('db:migration_failed', { error: String(e) })
}

// Seed an initial adult user if none exists
const count = db.prepare('SELECT COUNT(*) as c FROM users').get() as any
if (count.c === 0) {
  const hash = bcrypt.hashSync('admin123', 12)
  db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('admin', 'admin@example.local', hash, 'adult')
  logger.info('seed:admin', { username: 'admin', password: 'admin123' })
}

export type UserRow = {
  id: number
  username: string
  email: string | null
  password_hash: string
  role: 'adult' | 'child'
  twofa_secret: string | null
  twofa_enabled: 0 | 1
}

export type TaskRow = {
  id: number
  title: string
  completed: 0 | 1
  workflow: string | null
  workflowStage: string | null
  created_by: number
  assigned_to: number | null
  labels: string | null
  attributes: string | null
  created_at: string
  client_id: string | null
}
