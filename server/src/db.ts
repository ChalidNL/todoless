import Database from 'better-sqlite3'
import bcrypt from 'bcrypt'
import { logger } from './logger.js'

const DB_PATH = process.env.DB_PATH || 'todoless-server.db'
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

CREATE TABLE IF NOT EXISTS labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT,
  shared INTEGER NOT NULL DEFAULT 1,
  owner_id INTEGER,
  FOREIGN KEY(owner_id) REFERENCES users(id)
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

CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  expires_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
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
  if (!names.has('shared')) {
    db.prepare(`ALTER TABLE tasks ADD COLUMN shared INTEGER DEFAULT 1`).run()
  }

  // v0.0.48: Add assigneeIds column for multi-assignee support
  if (!names.has('assigneeIds')) {
    db.prepare(`ALTER TABLE tasks ADD COLUMN assigneeIds TEXT`).run()
    logger.info('db:migration:assigneeIds_added')

    // Migrate existing assigned_to values to assigneeIds array
    const tasksWithAssignee = db.prepare('SELECT id, assigned_to FROM tasks WHERE assigned_to IS NOT NULL').all() as Array<{ id: number; assigned_to: number }>
    for (const task of tasksWithAssignee) {
      const assigneeIds = JSON.stringify([task.assigned_to])
      db.prepare('UPDATE tasks SET assigneeIds = ? WHERE id = ?').run(assigneeIds, task.id)
    }
    logger.info('db:migration:assigneeIds_migrated', { count: tasksWithAssignee.length })
  }
} catch (e) {
  logger.error('db:migration_failed', { error: String(e) })
}

// Migrate labels table to add owner_id and update default shared value
try {
  const labelColumns = db.prepare(`PRAGMA table_info(labels)`).all() as Array<{ name: string }>
  const labelNames = new Set(labelColumns.map(c => c.name))

  if (!labelNames.has('owner_id')) {
    db.prepare(`ALTER TABLE labels ADD COLUMN owner_id INTEGER`).run()
    // Set first adult user as owner of all existing labels
    const firstAdult = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('adult') as any
    if (firstAdult) {
      db.prepare('UPDATE labels SET owner_id = ? WHERE owner_id IS NULL').run(firstAdult.id)
    }
  }
  // Update existing labels to be shared by default (shared=1)
  db.prepare('UPDATE labels SET shared = 1 WHERE shared = 0 OR shared IS NULL').run()
} catch (e) {
  logger.error('db:migration_labels_failed', { error: String(e) })
}

// Create notes table if it doesn't exist
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      labels TEXT,
      pinned INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      shared INTEGER NOT NULL DEFAULT 1,
      owner_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(owner_id) REFERENCES users(id)
    );
  `)
} catch (e) {
  logger.error('db:notes_table_failed', { error: String(e) })
}

// v0.0.55: Add client_id and version columns for notes sync persistence
try {
  const noteColumns = db.prepare(`PRAGMA table_info(notes)`).all() as Array<{ name: string }>
  const noteNames = new Set(noteColumns.map(c => c.name))

  if (!noteNames.has('client_id')) {
    db.prepare(`ALTER TABLE notes ADD COLUMN client_id TEXT`).run()
    logger.info('db:migration:notes_client_id_added')
  }

  if (!noteNames.has('version')) {
    db.prepare(`ALTER TABLE notes ADD COLUMN version INTEGER DEFAULT 1`).run()
    logger.info('db:migration:notes_version_added')
  }
} catch (e) {
  logger.error('db:migration_notes_failed', { error: String(e) })
}

// v0.0.55: Create saved_filters table for cross-device filter sync
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_filters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      icon TEXT,
      label_filter_ids TEXT,
      attribute_filters TEXT,
      status_filter TEXT,
      sort_by TEXT,
      view_mode TEXT,
      user_id INTEGER NOT NULL,
      show_in_sidebar INTEGER DEFAULT 1,
      is_system INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      parent_id TEXT,
      filter_order INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      client_id TEXT,
      version INTEGER DEFAULT 1,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `)
  logger.info('db:saved_filters_table_created')
} catch (e) {
  logger.error('db:saved_filters_table_failed', { error: String(e) })
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
  assigned_to: number | null  // DEPRECATED: kept for backwards compatibility
  assigneeIds: string | null  // NEW: JSON array of user IDs
  labels: string | null
  attributes: string | null
  created_at: string
  client_id: string | null
  shared: 0 | 1
}

export type LabelRow = {
  id: number
  name: string
  color: string | null
  shared: 0 | 1
  owner_id: number | null
}

export type NoteRow = {
  id: number
  title: string
  content: string | null
  labels: string | null
  pinned: 0 | 1
  archived: 0 | 1
  shared: 0 | 1
  owner_id: number
  created_at: string
  updated_at: string
  client_id: string | null
  version: number
}

export type ApiTokenRow = {
  id: number
  token: string
  name: string
  user_id: number
  created_by: number
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  revoked: 0 | 1
}

export type SavedFilterRow = {
  id: string
  name: string
  slug: string
  icon: string | null
  label_filter_ids: string | null
  attribute_filters: string | null
  status_filter: string | null
  sort_by: string | null
  view_mode: string | null
  user_id: number
  show_in_sidebar: 0 | 1
  is_system: 0 | 1
  is_default: 0 | 1
  parent_id: string | null
  filter_order: number | null
  created_at: string
  updated_at: string
  client_id: string | null
  version: number
}
