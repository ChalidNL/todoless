import { Todos, Users, db } from '../db/dexieClient'
import { useRealtime } from '../store/realtime'
import { useSync } from '../store/sync'
import type { Todo, User } from '../db/schema'
import { logger } from './logger'

const API = (import.meta as any).env?.VITE_API_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:4000` : 'http://localhost:4000')
const MERGE_WINDOW_MS = 15000 // time window to correlate local-unsynced and server-created tasks

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export interface ServerTask {
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
  client_id?: string | null
}

export interface ServerUser {
  id: number
  username: string
  email?: string | null
  role: 'adult' | 'child'
  twofa_enabled?: boolean
}

/**
 * Sync server tasks into local Dexie DB
 * Called after login to ensure mobile/desktop share data
 */
export async function syncTasksFromServer(currentUser: ServerUser) {
  try {
    try { useSync.getState().setPhase('running') } catch {}
    // 1. Fetch tasks from server
    const { items } = await api('/api/tasks')
    const serverTasks: ServerTask[] = items || []
    
    // 2. Update or create local user record to match server
    const localUsers = await Users.list()
    let localUserId = localUsers.find(u => u.name === currentUser.username)?.id
    if (!localUserId) {
      // Create a local user that matches server
      localUserId = `server-${currentUser.id}`
      await db.users.add({
        id: localUserId,
        name: currentUser.username,
        email: currentUser.email || undefined,
        themeColor: '#0ea5e9',
      } as User)
    } else {
      // Update existing user
      await db.users.update(localUserId, {
        name: currentUser.username,
        email: currentUser.email || undefined,
      })
    }

    // 3. Sync tasks: convert server tasks to local format
    const existingTodos = await Todos.list()
    const existingByServerId = new Map(
      existingTodos
        .filter(t => t.serverId)
        .map(t => [t.serverId, t])
    )

    for (const st of serverTasks) {
      const localTodo = existingByServerId.get(st.id)
      const labelIds = st.labels ? JSON.parse(st.labels) : []
      const attributes = st.attributes ? JSON.parse(st.attributes) : {}
      
      const todoData: Partial<Todo> = {
        title: st.title,
        completed: !!st.completed,
        userId: localUserId,
        workflowId: st.workflow || undefined,
        workflowStage: st.workflowStage || undefined,
        labelIds,
        attributes,
        order: new Date(st.created_at).getTime(),
        createdAt: st.created_at,
        serverId: st.id, // Track server ID for future syncs
      }

      if (localTodo) {
        // Update existing
        await Todos.update(localTodo.id, todoData)
      } else {
        // Try to merge with a recent unsynced local todo (same title, close createdAt)
        let merged = false
        try {
          const createdAtTs = new Date(st.created_at).getTime()
          const unsynced = await db.todos.where('serverId').equals(undefined as any).toArray()
          const candidate = unsynced.find(t => {
            if (!t.title || t.title.trim().toLowerCase() !== (st.title || '').trim().toLowerCase()) return false
            if (!t.createdAt) return true // fallback: no createdAt, match on title only
            const diff = Math.abs(new Date(t.createdAt).getTime() - createdAtTs)
            return diff <= MERGE_WINDOW_MS
          })
          if (candidate) {
            await db.todos.update(candidate.id, todoData)
            merged = true
          }
        } catch {}
        if (!merged) {
          // Create new
          await Todos.add({
            ...todoData,
            userId: localUserId,
            completed: !!st.completed,
            order: new Date(st.created_at).getTime(),
            createdAt: st.created_at,
          } as any)
        }
      }
    }

    logger.info('sync:tasks', { count: serverTasks.length })
    try { useSync.getState().setPhase('done') } catch {}
  } catch (e) {
    logger.error('sync:tasks:failed', { error: String(e) })
    // Keep phase as idle to allow retry later
    try { useSync.getState().setPhase('idle') } catch {}
  }
}

/**
 * Push a local todo to the server
 */
export async function pushTodoToServer(todo: Todo): Promise<number | null> {
  try {
    if (todo.serverId) {
      // Update existing
      const body: any = {
        title: todo.title,
        completed: todo.completed,
        workflow: todo.workflowId || null,
        workflowStage: todo.workflowStage || null,
        labels: todo.labelIds?.length ? JSON.stringify(todo.labelIds) : null,
        attributes: todo.attributes ? JSON.stringify(todo.attributes) : null,
      }
      await api(`/api/tasks/${todo.serverId}`, { method: 'PATCH', body: JSON.stringify(body) })
      return todo.serverId
    } else {
      // Create new
      const body: any = {
        title: todo.title,
        completed: todo.completed,
        workflow: todo.workflowId || null,
        workflowStage: todo.workflowStage || null,
        labels: todo.labelIds?.length ? JSON.stringify(todo.labelIds) : null,
        attributes: todo.attributes ? JSON.stringify(todo.attributes) : null,
        clientId: todo.clientId || undefined,
      }
      const { item } = await api('/api/tasks', { method: 'POST', body: JSON.stringify(body) })
        // If an SSE-created record already exists locally for this server id, merge to avoid duplicates
        try {
    const existing = await db.todos.where('serverId').equals(item.id).first()
          if (existing && existing.id !== (todo as any).id) {
            // Prefer the existing (SSE) record; optionally merge fields from the local one
            const mergePatch: Partial<Todo> = {}
            if (!existing.attributes && todo.attributes) mergePatch.attributes = todo.attributes
            if ((!existing.labelIds || existing.labelIds.length === 0) && todo.labelIds && todo.labelIds.length) mergePatch.labelIds = todo.labelIds
            if (todo.order && !existing.order) mergePatch.order = todo.order
            if (Object.keys(mergePatch).length) {
              await db.todos.update(existing.id, mergePatch)
            }
            // Remove the duplicate local record
            await db.todos.delete((todo as any).id)
            return item.id
          }
        } catch {}
        // Otherwise update the current local record with server ID and persist clientId linkage
        await Todos.update(todo.id, { serverId: item.id, clientId: todo.clientId })
      return item.id
    }
  } catch (e) {
    logger.error('sync:push:failed', { todoId: todo.id, error: String(e) })
    return null
  }
}

/**
 * Delete a todo from server
 */
export async function deleteTodoFromServer(serverId: number): Promise<boolean> {
  try {
    await api(`/api/tasks/${serverId}`, { method: 'DELETE' })
    return true
  } catch (e) {
    logger.error('sync:delete:failed', { serverId, error: String(e) })
    return false
  }
}

let es: EventSource | null = null

/**
 * Push any locally created todos that haven't been assigned a serverId yet.
 * Safe to run after login or occasionally as a repair task.
 */
export async function pushPendingTodos() {
  try {
    const pending = await db.todos.where('serverId').equals(undefined as any).toArray()
    for (const t of pending) {
      await pushTodoToServer(t as any)
    }
    logger.info('sync:pending:push_complete', { count: pending.length })
  } catch (e) {
    logger.error('sync:pending:push_failed', { error: String(e) })
  }
}

export function startRealtimeSync(currentUser: ServerUser) {
  if (es) return
  try {
    // Set UI status: connecting
    try { useRealtime.getState().setStatus('connecting') } catch {}
    // Use withCredentials so cookies are sent for auth
    // Note: Some older browsers may not support withCredentials; modern browsers do
    es = new EventSource(`${API}/api/events`, { withCredentials: true } as any)
    es.onopen = () => {
      try { useRealtime.getState().setStatus('connected') } catch {}
    }
    es.addEventListener('hello', () => {
      try { useRealtime.getState().setStatus('connected') } catch {}
    })
    es.addEventListener('task.created', async (ev: MessageEvent) => {
      try {
        const { item } = JSON.parse(ev.data)
        await applyServerTask(item, currentUser)
        try { useRealtime.getState().markEvent() } catch {}
      } catch {}
    })
    es.addEventListener('task.updated', async (ev: MessageEvent) => {
      try {
        const { item } = JSON.parse(ev.data)
        await applyServerTask(item, currentUser)
        try { useRealtime.getState().markEvent() } catch {}
      } catch {}
    })
    es.addEventListener('task.deleted', async (ev: MessageEvent) => {
      try {
        const { id } = JSON.parse(ev.data)
        const todos = await db.todos.where('serverId').equals(id).toArray()
        for (const t of todos) await db.todos.delete(t.id)
        try { useRealtime.getState().markEvent() } catch {}
      } catch {}
    })
    es.onerror = (e: any) => {
      // Mark as error but keep connection (browser will retry)
      try { useRealtime.getState().setStatus('error', e?.message || 'connection error') } catch {}
      if (es && (es as any).readyState === 2 /* CLOSED */) {
        // Closed; set disconnected
        try { useRealtime.getState().setStatus('disconnected') } catch {}
      }
    }
  } catch (e) {
    logger.error('sse:connect_failed', { error: String(e) })
    try { useRealtime.getState().setStatus('error', String(e)) } catch {}
  }
}

export function stopRealtimeSync() {
  try { es?.close() } catch {}
  es = null
  try { useRealtime.getState().setStatus('disconnected') } catch {}
}

async function applyServerTask(item: ServerTask, currentUser: ServerUser) {
  const localUsers = await Users.list()
  let localUserId = localUsers.find(u => u.name === currentUser.username)?.id
  if (!localUserId) {
    localUserId = `server-${currentUser.id}`
    await db.users.add({ id: localUserId, name: currentUser.username, email: currentUser.email || undefined, themeColor: '#0ea5e9' } as any)
  }
  // Prefer serverId match; otherwise try client_id linkage
  let existing = await db.todos.where('serverId').equals(item.id).first()
  if (!existing && item.client_id) {
    existing = await db.todos.where('clientId').equals(item.client_id).first()
  }
  const labelIds = item.labels ? JSON.parse(item.labels) : []
  const attributes = item.attributes ? JSON.parse(item.attributes) : {}
  const patch: Partial<Todo> = {
    title: item.title,
    completed: !!item.completed,
    userId: localUserId,
    workflowId: item.workflow || undefined,
    workflowStage: item.workflowStage || undefined,
    labelIds,
    attributes,
    order: new Date(item.created_at).getTime(),
    createdAt: item.created_at,
    serverId: item.id,
  }
  if (existing) {
    await db.todos.update(existing.id, patch)
    return
  }
  // No serverId match yet: try to merge with a recent local, unsynced todo (same title, close createdAt)
  try {
    const createdAtTs = new Date(item.created_at).getTime()
  const unsynced = await db.todos.where('serverId').equals(undefined as any).toArray()
    const candidate = unsynced.find(t => {
      if (!t.title || t.title.trim().toLowerCase() !== (item.title || '').trim().toLowerCase()) return false
      if (!t.createdAt) return true
      const diff = Math.abs(new Date(t.createdAt).getTime() - createdAtTs)
      return diff <= MERGE_WINDOW_MS
    })
    if (candidate) {
      await db.todos.update(candidate.id, patch)
      return
    }
  } catch {}
  // Fallback: create new
  await Todos.add({ ...patch, completed: !!item.completed, userId: localUserId } as any)
}

// -------------------------------
// Outbound sync queue (coalesced)
// -------------------------------

type UpsertItem = Todo
type DeleteItem = { localId: string; serverId?: number }

const upsertQueue = new Map<string, UpsertItem>() // key: local todo id
const deleteQueue = new Map<string, DeleteItem>() // key: local todo id

let flushTimer: any = null
let flushing = false
let backoffMs = 0
const BASE_DELAY = 300 // debounce window for coalescing outbound sync
const MAX_BACKOFF = 5000

function scheduleFlush(immediate = false) {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  const delay = immediate ? 0 : Math.max(BASE_DELAY, backoffMs)
  flushTimer = setTimeout(() => void flushNow(), delay)
}

async function flushNow() {
  if (flushing) return
  flushing = true
  try {
    // Process deletes first to avoid resurrecting removed items
    for (const [, item] of Array.from(deleteQueue.entries())) {
      try {
        if (item.serverId) {
          await deleteTodoFromServer(item.serverId)
        } else {
          // Try to resolve serverId by looking up current state
          const t = await db.todos.get(item.localId)
          if (t?.serverId) await deleteTodoFromServer(t.serverId)
        }
      } catch (e) {
        // On failure, keep the item in queue for retry
        logger.warn('sync:queue:delete_failed', { localId: item.localId, error: String(e) })
        continue
      } finally {
        deleteQueue.delete(item.localId)
      }
    }

    // Then process upserts. If an item is also scheduled for delete, skip upsert.
    for (const [localId, todo] of Array.from(upsertQueue.entries())) {
      if (deleteQueue.has(localId)) {
        upsertQueue.delete(localId)
        continue
      }
      try {
        await pushTodoToServer(todo)
      } catch (e) {
        logger.warn('sync:queue:upsert_failed', { localId, error: String(e) })
        continue
      } finally {
        upsertQueue.delete(localId)
      }
    }

    // Success path: reset backoff
    backoffMs = 0
  } catch (e) {
    // Exponential backoff on general failure
    backoffMs = backoffMs ? Math.min(backoffMs * 2, MAX_BACKOFF) : BASE_DELAY
    logger.error('sync:queue:flush_error', { error: String(e), backoffMs })
  } finally {
    flushing = false
    // If queue still has items, schedule another flush with backoff
    if (upsertQueue.size || deleteQueue.size) scheduleFlush(false)
  }
}

export function scheduleUpsert(todo: Todo) {
  try {
    // If a delete is pending for this item, cancel it (latest-wins behavior)
    deleteQueue.delete(todo.id)
    upsertQueue.set(todo.id, todo)
    // If queue grows, flush sooner
  const immediate = upsertQueue.size + deleteQueue.size > 10
    scheduleFlush(immediate)
  } catch (e) {
    logger.error('sync:queue:schedule_upsert_failed', { error: String(e) })
  }
}

export function scheduleDelete(localId: string, serverId?: number) {
  try {
    // Remove any pending upsert for this item
    upsertQueue.delete(localId)
    deleteQueue.set(localId, { localId, serverId })
  const immediate = upsertQueue.size + deleteQueue.size > 8
    scheduleFlush(immediate)
  } catch (e) {
    logger.error('sync:queue:schedule_delete_failed', { error: String(e) })
  }
}

// Flush when back online
try {
  window.addEventListener('online', () => scheduleFlush(true))
} catch {}

// Optional: flush on page hide (best-effort)
try {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && (upsertQueue.size || deleteQueue.size)) scheduleFlush(true)
  })
} catch {}
