import { Todos, Users, db } from '../db/dexieClient'
import { useRealtime } from '../store/realtime'
import { useSync } from '../store/sync'
import type { Todo, User } from '../db/schema'
import { logger } from './logger'

// In development, Vite proxies /api to backend. In production, nginx proxies /api.
// So we always use same-origin (empty string = relative URLs)
const API = ''
const MERGE_WINDOW_MS = 60000 // time window to correlate local-unsynced and server-created tasks (60s for better cross-device sync)

let labelMigrationDone = false

const normalizeTitleKey = (title?: string | null) =>
  (title || '').trim().toLowerCase().replace(/\s+/g, ' ')

function normalizeLabelIdsArray(input: any): string[] {
  if (!input) return []
  if (typeof input === 'string') {
    try {
      return normalizeLabelIdsArray(JSON.parse(input))
    } catch {
      return []
    }
  }
  if (Array.isArray(input)) {
    return input.map((id) => String(id))
  }
  return []
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

async function ensureLocalLabelIdsAreStrings() {
  if (labelMigrationDone) return
  try {
    await db.todos.toCollection().modify((todo) => {
      if (Array.isArray((todo as any).labelIds)) {
        const normalized = (todo as any).labelIds.map((id: any) => String(id))
        const changed = normalized.some((val: string, idx: number) => val !== (todo as any).labelIds[idx])
        if (changed) {
          ;(todo as any).labelIds = normalized
        }
      }
    })
  } catch (e) {
    logger.warn('sync:labels:migration_failed', { error: String(e) })
  } finally {
    labelMigrationDone = true
  }
}

function serializeLabelIds(ids?: string[]): string | null {
  if (!ids || !ids.length) return null
  const normalized = ids.map((id) => String(id)).filter(Boolean)
  return normalized.length ? JSON.stringify(normalized) : null
}

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
  assigned_to: number | null  // DEPRECATED
  assigneeIds: string | null  // NEW: JSON array of user IDs
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
    await ensureLocalLabelIdsAreStrings()
    try { useSync.getState().setPhase('running') } catch {}
    // 1. Fetch tasks from server
    const { items: taskItems } = await api('/api/tasks')
    const serverTasks: ServerTask[] = taskItems || []

    // 2. Fetch labels from server
    const { items: labelItems } = await api('/api/labels')
    const previousLabels = await db.labels.toArray()
    const nameToServerId = new Map<string, string>()
    for (const label of labelItems || []) {
      nameToServerId.set((label.name || '').trim().toLowerCase(), String(label.id))
    }
    const idRemap = new Map<string, string>()
    previousLabels.forEach((label) => {
      const key = (label.name || '').trim().toLowerCase()
      const nextId = nameToServerId.get(key)
      if (nextId && nextId !== label.id) {
        idRemap.set(label.id, nextId)
      }
    })
    // Clear local labels and re-add from server
    await db.labels.clear()
    for (const label of labelItems || []) {
      const labelData: any = {
        id: String(label.id),
        name: label.name,
        color: label.color || '#0ea5e9',
        shared: !!label.shared,
      }
      // Only add ownerId if it exists (avoid undefined in indexed fields)
      if (label.owner_id) {
        labelData.ownerId = String(label.owner_id)
      }
      await db.labels.add(labelData)
    }
    let remapApplied = false
    if (idRemap.size) {
      await db.todos.toCollection().modify((todo) => {
        const ids = (todo as any).labelIds
        if (!Array.isArray(ids) || !ids.length) return
        let changed = false
        const next = ids.map((id: string) => {
          const mapped = idRemap.get(id)
          if (mapped && mapped !== id) {
            changed = true
            return mapped
          }
          return String(id)
        })
        if (changed) {
          remapApplied = true
          ;(todo as any).labelIds = next
        }
      })
      // Update server tasks so labels column references the new IDs as well
      for (const st of serverTasks) {
        const original = normalizeLabelIdsArray(st.labels)
        if (!original.length) continue
        const remapped = original.map((id) => idRemap.get(id) ?? id)
        if (!arraysEqual(original, remapped)) {
          try {
            await api(`/api/tasks/${st.id}`, { method: 'PATCH', body: JSON.stringify({ labels: JSON.stringify(remapped) }) })
            st.labels = JSON.stringify(remapped)
          } catch (e) {
            logger.warn('sync:labels:server_patch_failed', { taskId: st.id, error: String(e) })
          }
        }
      }
      if (remapApplied) {
        await pushPendingTodos().catch(() => {})
      }
    }

    // 3. Fetch users from server
    const { items: userItems } = await api('/api/users').catch(() => ({ items: [] }))
    // Clear local users and re-add from server
    await db.users.clear()
    for (const user of userItems || []) {
      await db.users.add({
        id: String(user.id),
        name: user.username,
        email: user.email || undefined,
        role: user.role || 'adult',
      })
    }

    // 4. Update or create local user record to match currentUser
    let localUserId = String(currentUser.id)
    const localUsers = await db.users.toArray()
    if (!localUsers.find(u => u.id === localUserId)) {
      await db.users.add({
        id: localUserId,
        name: currentUser.username,
        email: currentUser.email || undefined,
        role: currentUser.role || 'adult',
      })
    }

    // 5. Sync tasks: convert server tasks to local format
    const existingTodos = await Todos.list()
    const serverIds = new Set(serverTasks.map((t) => t.id))
    const stale = existingTodos.filter((t) => t.serverId && !serverIds.has(t.serverId))
    if (stale.length) {
      await db.todos.bulkDelete(stale.map((t) => t.id))
    }
    const existingByServerId = new Map(
      existingTodos
        .filter(t => t.serverId)
        .map(t => [t.serverId, t])
    )

    for (const st of serverTasks) {
      const localTodo = existingByServerId.get(st.id)
      const labelIds = normalizeLabelIdsArray(st.labels)
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
          const unsynced = (await db.todos.toArray()).filter(t => t.serverId === undefined)
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

    await dedupeLocalTitles()

    logger.info('sync:tasks+labels+users', { tasks: serverTasks.length, labels: (labelItems || []).length, users: (userItems || []).length })
    try {
      useSync.getState().setPhase('done')
      useSync.getState().setLastSyncAt(Date.now())
    } catch {}
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
        labels: serializeLabelIds(todo.labelIds),
        attributes: todo.attributes ? JSON.stringify(todo.attributes) : null,
        assigneeIds: todo.assigneeIds && todo.assigneeIds.length > 0
          ? JSON.stringify(todo.assigneeIds.map(id => Number(id)))
          : null,
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
        labels: serializeLabelIds(todo.labelIds),
        attributes: todo.attributes ? JSON.stringify(todo.attributes) : null,
        clientId: todo.clientId || undefined,
        assigneeIds: todo.assigneeIds && todo.assigneeIds.length > 0
          ? JSON.stringify(todo.assigneeIds.map(id => Number(id)))
          : null,
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
let reconnectTimer: any = null
const MIN_RECONNECT_DELAY = 1000 // 1s
const MAX_RECONNECT_DELAY = 30000 // 30s

function calculateReconnectDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
  const delay = Math.min(MIN_RECONNECT_DELAY * Math.pow(2, attempt), MAX_RECONNECT_DELAY)
  return delay
}

/**
 * Push any locally created todos that haven't been assigned a serverId yet.
 * Safe to run after login or occasionally as a repair task.
 */
export async function pushPendingTodos() {
  try {
  const pending = (await db.todos.toArray()).filter(t => t.serverId === undefined)
    for (const t of pending) {
      await pushTodoToServer(t as any)
    }
    logger.info('sync:pending:push_complete', { count: pending.length })
  } catch (e) {
    logger.error('sync:pending:push_failed', { error: String(e) })
  }
}

/**
 * Sync labels from server to local database
 */
async function syncLabelsFromServer() {
  try {
    const response = await fetch(`${API}/api/labels`, { credentials: 'include' })
    if (!response.ok) {
      logger.warn('sync:labels:fetch_failed', { status: response.status })
      return
    }

    const data = await response.json()
    const serverLabels = data.items || []

    // Upsert labels into local database
    for (const serverLabel of serverLabels) {
      const existing = await db.labels.where('id').equals(String(serverLabel.id)).first()

      if (existing) {
        // Update existing label
        const updateData: any = {
          name: serverLabel.name,
          color: serverLabel.color || '#0ea5e9',
          shared: serverLabel.shared === 1,
        }
        // Only add ownerId if it exists
        if (serverLabel.owner_id) {
          updateData.ownerId = String(serverLabel.owner_id)
        }
        await db.labels.update(String(serverLabel.id), updateData)
      } else {
        // Add new label
        const labelData: any = {
          id: String(serverLabel.id),
          name: serverLabel.name,
          color: serverLabel.color || '#0ea5e9',
          shared: serverLabel.shared === 1,
        }
        // Only add ownerId if it exists
        if (serverLabel.owner_id) {
          labelData.ownerId = String(serverLabel.owner_id)
        }
        await db.labels.add(labelData)
      }
    }

    logger.info('sync:labels:complete', { count: serverLabels.length })
  } catch (e) {
    logger.error('sync:labels:failed', { error: String(e) })
  }
}

export function startRealtimeSync(currentUser: ServerUser) {
  if (es) return
  try {
    // Clear any pending reconnection timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    // Set UI status: connecting
    try { useRealtime.getState().setStatus('connecting') } catch {}
    // Use withCredentials so cookies are sent for auth
    // Note: Some older browsers may not support withCredentials; modern browsers do
    es = new EventSource(`${API}/api/events`, { withCredentials: true } as any)
    es.onopen = () => {
      try { useRealtime.getState().setStatus('connected') } catch {}
      logger.info('sse:connected', {})
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
        // Trigger UI update for deleted todo
        import('../db/dexieClient').then(({ todoBus }) => {
          todoBus.dispatchEvent(new CustomEvent('todo:mutated'))
        }).catch(() => {})
        window.dispatchEvent(new CustomEvent('todos:refresh'))
      } catch {}
    })
    es.addEventListener('labels:updated', async (ev: MessageEvent) => {
      try {
        // Trigger a full label sync from server
        await syncLabelsFromServer()
        // Dispatch events to refresh UI components
        window.dispatchEvent(new CustomEvent('labels:refresh'))
        import('../db/dexieClient').then(({ labelBus }) => {
          labelBus.dispatchEvent(new CustomEvent('label:updated'))
        }).catch(() => {})
        try { useRealtime.getState().markEvent() } catch {}
      } catch {}
    })
    es.addEventListener('task:created', async (ev: MessageEvent) => {
      try {
        const { task } = JSON.parse(ev.data)
        await applyServerTask(task, currentUser)
        try { useRealtime.getState().markEvent() } catch {}
      } catch {}
    })
    // v0.0.55: Saved filter sync events
    es.addEventListener('saved-filter.created', async (ev: MessageEvent) => {
      try {
        // Trigger a full filter sync from server
        const { syncFiltersFromServer } = await import('./syncFilters')
        await syncFiltersFromServer()
        try { useRealtime.getState().markEvent() } catch {}
      } catch {}
    })
    es.addEventListener('saved-filter.updated', async (ev: MessageEvent) => {
      try {
        // Trigger a full filter sync from server
        const { syncFiltersFromServer } = await import('./syncFilters')
        await syncFiltersFromServer()
        try { useRealtime.getState().markEvent() } catch {}
      } catch {}
    })
    es.addEventListener('saved-filter.deleted', async (ev: MessageEvent) => {
      try {
        // Trigger a full filter sync from server
        const { syncFiltersFromServer } = await import('./syncFilters')
        await syncFiltersFromServer()
        try { useRealtime.getState().markEvent() } catch {}
      } catch {}
    })
    es.onerror = (e: any) => {
      // Mark as error but keep connection (browser will retry)
      try { useRealtime.getState().setStatus('error', e?.message || 'connection error') } catch {}
      logger.warn('sse:error', { error: e?.message || 'unknown' })

      if (es && (es as any).readyState === 2 /* CLOSED */) {
        // Connection closed; set disconnected and schedule reconnect with backoff
        try { useRealtime.getState().setStatus('disconnected') } catch {}
        es = null

        // Schedule reconnection with exponential backoff
        const attempt = useRealtime.getState().reconnectAttempt
        const delay = calculateReconnectDelay(attempt)
        const nextReconnectAt = Date.now() + delay

        try {
          useRealtime.getState().incrementReconnect()
          useRealtime.getState().setNextReconnectAt(nextReconnectAt)
        } catch {}

        logger.info('sse:schedule_reconnect', { attempt, delay, nextReconnectAt })

        reconnectTimer = setTimeout(() => {
          logger.info('sse:attempting_reconnect', { attempt: attempt + 1 })
          startRealtimeSync(currentUser)
        }, delay)
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
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  try { useRealtime.getState().reset() } catch {}
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
  const labelIds = normalizeLabelIdsArray(item.labels)
  const attributes = item.attributes ? JSON.parse(item.attributes) : {}

  // Parse assigneeIds from server (JSON array → string array for Dexie)
  let assigneeIds: string[] = []
  if (item.assigneeIds) {
    try {
      const parsed = JSON.parse(item.assigneeIds) as number[]
      assigneeIds = parsed.map(id => String(id))
    } catch {}
  } else if (item.assigned_to) {
    // Backwards compatibility
    assigneeIds = [String(item.assigned_to)]
  }

  const patch: Partial<Todo> = {
    title: item.title,
    completed: !!item.completed,
    userId: localUserId,
    workflowId: item.workflow || undefined,
    workflowStage: item.workflowStage || undefined,
    labelIds,
    assigneeIds,  // NOW SYNCED!
    attributes,
    order: new Date(item.created_at).getTime(),
    createdAt: item.created_at,
    serverId: item.id,
  }
  if (existing) {
    // Detect potential conflicts: local changes that differ from server
    let hasConflict = false
    const conflicts: string[] = []

    if (existing.title !== patch.title && existing.updatedAt && item.created_at) {
      const localUpdate = new Date(existing.updatedAt).getTime()
      const serverUpdate = new Date(item.created_at).getTime()
      if (localUpdate > serverUpdate) {
        hasConflict = true
        conflicts.push('title')
      }
    }

    if (existing.completed !== patch.completed && existing.updatedAt) {
      hasConflict = true
      conflicts.push('completed')
    }

    if (hasConflict) {
      // Log conflict for debugging
      logger.warn('sync:conflict_detected', {
        todoId: existing.id,
        serverId: item.id,
        conflicts,
        localTitle: existing.title,
        serverTitle: patch.title,
      })

      // Store conflict info for user review
      try {
        useSync.getState().addConflict({
          todoId: existing.id,
          localVersion: {
            title: existing.title,
            completed: existing.completed,
            updatedAt: existing.updatedAt,
          },
          serverVersion: {
            title: patch.title,
            completed: patch.completed,
          },
          timestamp: Date.now(),
        })
      } catch {}

      // For now, apply server version (last-write-wins from server)
      // Future enhancement: show conflict resolution UI
    }

    await db.todos.update(existing.id, patch)
    // Trigger UI update events for real-time sync
    import('../db/dexieClient').then(({ todoBus }) => {
      todoBus.dispatchEvent(new CustomEvent('todo:mutated'))
    }).catch(() => {})
    window.dispatchEvent(new CustomEvent('todos:refresh'))
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
  // Trigger UI update for new todo
  window.dispatchEvent(new CustomEvent('todos:refresh'))
}

async function dedupeLocalTitles() {
  const todos = await db.todos.toArray()
  const keepers = new Map<string, Todo>()
  const toDelete: Todo[] = []

  const prefer = (a: Todo, b: Todo) => {
    const labelsA = Array.isArray(a.labelIds) ? a.labelIds.length : 0
    const labelsB = Array.isArray(b.labelIds) ? b.labelIds.length : 0
    if (labelsB > labelsA) return b
    if (labelsA > labelsB) return a
    if (!a.serverId && b.serverId) return b
    if (a.serverId && !b.serverId) return a
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return createdB < createdA ? b : a
  }

  for (const todo of todos) {
    const key = normalizeTitleKey(todo.title)
    if (!key) continue
    const current = keepers.get(key)
    if (!current) {
      keepers.set(key, todo)
      continue
    }
    const best = prefer(current, todo)
    const loser = best === current ? todo : current
    keepers.set(key, best)
    toDelete.push(loser)
  }

  if (!toDelete.length) return

  await db.todos.bulkDelete(toDelete.map((t) => t.id))
  for (const todo of toDelete) {
    if (todo.serverId) {
      try { await deleteTodoFromServer(todo.serverId) } catch {}
    }
  }
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
