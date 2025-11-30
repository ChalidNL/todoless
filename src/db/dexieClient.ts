/**
 * TEST-ONLY: Normalize all todos to use userId for assignment and filtering.
 * Converts any legacy displayName references to userId if found.
 * Run once after import/migration to clean up local data.
 */
export async function normalizeTodosUserMapping() {
  const users = await db.users.toArray()
  const userMap: Record<string, string> = {}
  users.forEach(u => {
    if (u.name) userMap[u.name.toLowerCase()] = u.id
    if (u.username) userMap[u.username.toLowerCase()] = u.id
  })
  const todos = await db.todos.toArray()
  for (const todo of todos) {
    let changed = false
    // Fix main userId
    if (todo.userId && !users.find(u => u.id === todo.userId)) {
      // Try to map by displayName
      const mappedId = userMap[(todo.userId || '').toLowerCase()]
      if (mappedId) {
        todo.userId = mappedId
        changed = true
      }
    }
    // Fix assigneeIds
    if (Array.isArray(todo.assigneeIds)) {
      const nextAssignees = todo.assigneeIds.map(aid => {
        if (users.find(u => u.id === aid)) return aid
        const mappedId = userMap[(aid || '').toLowerCase()]
        return mappedId || aid
      })
      if (JSON.stringify(nextAssignees) !== JSON.stringify(todo.assigneeIds)) {
        todo.assigneeIds = nextAssignees
        changed = true
      }
    }
    if (changed) {
      const updates: Partial<Todo> = {}
      if (todo.userId) updates.userId = todo.userId
      if (todo.assigneeIds) updates.assigneeIds = todo.assigneeIds
      await db.todos.update(todo.id, updates)
    }
  }
}
import Dexie, { Table } from 'dexie'
import type { Label, Todo, User, Workflow, SavedFilter, List, AttributeDef, PointsEntry, AppSettings, Note } from './schema'
import { logger } from '../utils/logger'

class TodolessDB extends Dexie {
  labels!: Table<Label, string>
  todos!: Table<Todo, string>
  users!: Table<User, string>
  workflows!: Table<Workflow, string>
  savedFilters!: Table<SavedFilter, number>  // v0.0.57: Changed from string to number
  lists!: Table<List, string>
  attributes!: Table<AttributeDef, string>
  points!: Table<PointsEntry, string>
  settings!: Table<AppSettings, string>
  notes!: Table<Note, string>

  constructor() {
    super('todoless')

    this.version(1).stores({
      labels: 'id, name, shared, workflowId, userId',
      todos: 'id, userId, completed',
      users: 'id, name',
      workflows: 'id, name',
      savedViews: 'id, name, userId',
    })

    // v2: add lists table and extend todos indexes
    this.version(2).stores({
      todos: 'id, userId, completed, labelIds, listId, assignee, dueDate', // Updated index
      lists: 'id, name',
    })

    // v3: 1.7 updates - workflows link labels, todos track workflowId/assigneeIds/blocked
    this.version(3).stores({
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, blocked',
      users: 'id, name, email',
      workflows: 'id, name, labelIds',
      attributes: 'id, name, type',
    })

    // v4: add checkboxOnly flag to workflows
    this.version(4).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, blocked',
      workflows: 'id, name, labelIds, checkboxOnly',
    })

    // v5: add 'order' to todos for list reordering
    this.version(5).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, blocked, order, createdAt, priority',
      users: 'id, name, email',
    })

    // v6: lists visibility, attributes defaultValue, users extended fields
    this.version(6).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, blocked, order, createdAt, priority',
      users: 'id, name, email, role, ageGroup',
      lists: 'id, name, visibility',
      attributes: 'id, name, type, defaultValue',
    })

    // v7: add points table and settings
    this.version(7).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, blocked, order, createdAt, priority',
      points: 'id, userId, todoId, date',
      settings: 'id',
    })

    // v10: add dueTime and repeat fields to todos
    this.version(10).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority',
    })

    // v11: add notes table
    this.version(11).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority',
      users: 'id, name, email, role, ageGroup',
      notes: 'id, userId, createdAt, updatedAt, pinned, archived',
    })

    // v12: add default workflow and views (non-indexed fields: isDefault, hideBacklog)
    this.version(12).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority',
      users: 'id, name, email, role, ageGroup',
    }).upgrade(async (tx) => {
      // Ensure default workflow exists
      const defaultWorkflow = await tx.table('workflows').get('default-kanban')
      if (!defaultWorkflow) {
        await tx.table('workflows').add({
          id: 'default-kanban',
          name: 'Kanban flow',
          stages: ['Backlog', 'To Do', 'In Progress', 'Done'],
          isDefault: true,
          hideBacklog: false,
        })
      }
      // Seed legacy default attribute "Workflow" as select (will be upgraded in v13)
      const existingAttrs = await tx.table('attributes').toArray()
      const hasWorkflowAttr = existingAttrs.some((a: any) => (a.name || '').toLowerCase() === 'workflow')
      if (!hasWorkflowAttr) {
        await tx.table('attributes').add({
          id: generateUUID(),
          name: 'Workflow',
          type: 'select',
          defaultValue: 'Kanban',
          options: [
            { value: 'Kanban', label: 'Kanban' },
          ],
        } as AttributeDef)
      }
    })

    // v13: ensure default Workflow attribute is of type 'workflow' pointing to default-kanban
    this.version(13).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority',
    }).upgrade(async (tx) => {
      // Make sure default-kanban exists (defensive)
      const defaultWf = await tx.table('workflows').get('default-kanban')
      if (!defaultWf) {
        await tx.table('workflows').add({
          id: 'default-kanban',
          name: 'Kanban flow',
          stages: ['Backlog', 'To Do', 'In Progress', 'Done'],
          isDefault: true,
          hideBacklog: false,
        })
      }

      const attrs: AttributeDef[] = await tx.table('attributes').toArray()
      const wfAttr = attrs.find(a => (a.name || '').toLowerCase() === 'workflow')
      if (wfAttr) {
        // Convert to type 'workflow' and set defaultValue to workflow id
        await tx.table('attributes').update(wfAttr.id, {
          type: 'workflow',
          defaultValue: 'default-kanban',
          isDefault: true,
          options: undefined,
        })
      } else {
        // Create the default Workflow attribute
        await tx.table('attributes').add({
          id: generateUUID(),
          name: 'Workflow',
          type: 'workflow',
          defaultValue: 'default-kanban',
          isDefault: true,
        } as AttributeDef)
      }
    })

    // v14: add serverId index to todos for server sync
    this.version(14).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority, serverId',
    })

    // v15: add clientId index to todos for robust de-duplication with server
    this.version(15).stores({
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority, serverId, clientId',
    })

    // v16: add userId index to labels for query and sync
    this.version(16).stores({
      labels: 'id, name, shared, workflowId, userId',
    })

    // v17: add ownerId to labels, shared to todos and notes for privacy model
    this.version(17).stores({
      labels: 'id, name, shared, workflowId, userId, ownerId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority, serverId, clientId, shared',
      notes: 'id, userId, createdAt, updatedAt, pinned, archived, shared',
    }).upgrade(async (tx) => {
      // Migrate existing data to default shared=true
      const labels = await tx.table('labels').toArray()
      for (const label of labels) {
        if (label.shared === undefined || label.shared === null) {
          await tx.table('labels').update(label.id, { shared: true })
        }
      }

      const todos = await tx.table('todos').toArray()
      for (const todo of todos) {
        if (todo.shared === undefined || todo.shared === null) {
          await tx.table('todos').update(todo.id, { shared: true })
        }
      }

      const notes = await tx.table('notes').toArray()
      for (const note of notes) {
        if (note.shared === undefined || note.shared === null) {
          await tx.table('notes').update(note.id, { shared: true })
        }
      }
    })

    // v18: Rename savedViews → savedFilters (terminology refactoring)
    this.version(18).stores({
      savedFilters: 'id, name, userId',
      savedViews: null, // Delete old table
    }).upgrade(async (tx) => {
      // Migrate data from savedViews to savedFilters
      try {
        const oldViews = await tx.table('savedViews').toArray()
        if (oldViews && oldViews.length > 0) {
          await tx.table('savedFilters').bulkAdd(oldViews)
          logger.info('dexie:migration', { message: `Migrated ${oldViews.length} views to filters` })
        }
      } catch (e) {
        logger.warn('dexie:migration', { message: 'No old savedViews to migrate', error: String(e) })
      }
    })

    // v19: v0.0.55 - Add notes sync persistence (serverId, clientId, version)
    this.version(19).stores({
      notes: 'id, userId, createdAt, updatedAt, pinned, archived, shared, serverId, clientId, version',
    }).upgrade(async (tx) => {
      // Initialize clientId and version for existing notes
      const notes = await tx.table('notes').toArray()
      for (const note of notes) {
        if (!note.clientId) {
          await tx.table('notes').update(note.id, {
            clientId: note.id, // Use existing id as clientId for existing notes
            version: 1, // Initialize version
          })
        }
      }
      logger.info('dexie:migration:v19', { message: `Initialized sync fields for ${notes.length} notes` })
    })

    // v20: v0.0.57 - Rebuild savedFilters to match Labels architecture EXACTLY
    // BREAKING CHANGE: This will clear all existing saved filters
    this.version(20).stores({
      savedFilters: 'id, name, normalizedName, shared, ownerId, createdAt, updatedAt, version, menuVisible',
    }).upgrade(async (tx) => {
      // CLEAR all existing savedFilters - they are incompatible with new schema
      await tx.table('savedFilters').clear()
      logger.info('dexie:migration:v20', { message: 'Cleared savedFilters for v0.0.57 schema rebuild' })
    })

    // v0.0.57: Add ranking field to savedFilters
    this.version(21).stores({
      labels: 'id, name, shared, workflowId, userId, ownerId',
      savedFilters: 'id, name, normalizedName, shared, ownerId, ranking, createdAt, updatedAt, version, menuVisible',
    }).upgrade(async (tx) => {
      // Add default ranking = 0 to all existing filters
      const filters = await tx.table('savedFilters').toArray()
      for (const filter of filters) {
        if (filter.ranking === undefined) {
          await tx.table('savedFilters').update(filter.id, { ranking: 0 })
        }
      }
      logger.info('dexie:migration:v21', { message: 'Added ranking field to savedFilters' })
    })

    this.on('populate', async () => {
      const userId = 'local-user'
      await this.users.add({ id: userId, name: 'You', themeColor: '#0ea5e9' })
      const labelA: Label = { id: generateUUID(), name: 'Inbox', color: '#0ea5e9', shared: true, ownerId: userId }
      const labelB: Label = { id: generateUUID(), name: 'Groceries', color: '#84cc16', shared: true, ownerId: userId }
      const labelC: Label = { id: generateUUID(), name: 'Work', color: '#f97316', shared: true, ownerId: userId }
      await this.labels.bulkAdd([labelA, labelB, labelC])
      await this.todos.bulkAdd([
        { id: generateUUID(), title: 'Welcome to Todoless', completed: false, labelIds: [labelA.id], userId, shared: true },
        { id: generateUUID(), title: 'Add your first label', completed: false, labelIds: [labelA.id], userId, shared: true },
        { id: generateUUID(), title: 'Buy milk', completed: false, labelIds: [labelB.id], userId, shared: true },
      ])
      // Example list
      const inboxList: List = { id: generateUUID(), name: 'My List', description: 'Example list', labelIds: [labelA.id] }
      await this.lists.add(inboxList)
      
      // Default Kanban workflow (with star marker via isDefault)
      const defaultWorkflow: Workflow = {
        id: 'default-kanban',
        name: 'Kanban flow',
        stages: ['Backlog', 'To Do', 'In Progress', 'Done'],
        isDefault: true,
        hideBacklog: false,
      }
      await this.workflows.add(defaultWorkflow)

      // Add default Workflow attribute if missing on populate
      const existing = await this.attributes.toArray()
      const hasWorkflowAttr = existing.some(a => (a.name || '').toLowerCase() === 'workflow')
      if (!hasWorkflowAttr) {
        await this.attributes.add({
          id: generateUUID(),
          name: 'Workflow',
          type: 'workflow',
          defaultValue: 'default-kanban',
          isDefault: true,
        } as AttributeDef)
      }
    })
  }
}

export const db = new TodolessDB()

// Simple event bus for todo changes so UI can subscribe and update immediately
export const todoBus = new EventTarget()
export const labelBus = new EventTarget()
export const notesBus = new EventTarget()

// UUID generator with fallback for browsers that don't support crypto.randomUUID
function generateUUID(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch (e) {
    // Fallback if crypto.randomUUID throws
  }
  // Fallback: generate UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Convenience CRUD helpers (minimal)
export const Labels = {
  /**
   * Find a label by name (case-insensitive). If not found, create it.
   */
  findOrCreate: async (name: string) => {
    const labels = await db.labels.toArray()
    const found = labels.find(l => l.name.trim().toLowerCase() === name.trim().toLowerCase())
    if (found) return found.id
    // TEST-ONLY: random color for new labels
    const colors = [
      '#0ea5e9', // blue
      '#f59e42', // orange
      '#10b981', // green
      '#ef4444', // red
      '#a78bfa', // purple
      '#fbbf24', // yellow
      '#6366f1', // indigo
      '#14b8a6', // teal
      '#eab308', // gold
      '#f472b6', // pink
    ]
    const color = colors[Math.floor(Math.random() * colors.length)]
    // Get current user for ownerId
    const users = await db.users.toArray()
    const currentUserId = users[0]?.id || 'local-user'
    return await Labels.add({ name: name.trim(), color, shared: true, ownerId: currentUserId })
  },
  list: () => db.labels.toArray(),
  add: async (l: Omit<Label, 'id'>) => {
    const id = generateUUID()
    // Default shared to true if not specified
    const labelData = { ...l, id, shared: l.shared !== undefined ? l.shared : true }
    await db.labels.add(labelData)
    logger.info('label:add', { id, name: l.name })
    try {
      const added = await db.labels.get(id)
      labelBus.dispatchEvent(new CustomEvent('label:added', { detail: added }))

      // Push to server immediately
      try {
        await fetch('/api/labels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: l.name, color: l.color, shared: labelData.shared })
        })
      } catch (e) {
        logger.warn('label:add:server_failed', { id, error: String(e) })
      }
    } catch (e) {
      /* ignore */
    }
    return id
  },
  update: async (id: string, patch: Partial<Label>) => {
    const res = await db.labels.update(id, patch)
    try {
      const updated = await db.labels.get(id)
      labelBus.dispatchEvent(new CustomEvent('label:updated', { detail: updated }))
    } catch (e) {
      /* ignore */
    }
    return res
  },
  remove: async (id: string) => {
    const res = await db.labels.delete(id)
    try {
      labelBus.dispatchEvent(new CustomEvent('label:removed', { detail: { id } }))
    } catch (e) {
      /* ignore */
    }
    return res
  },
}

export const Todos = {
  list: () => db.todos.toArray(),
  add: async (t: Omit<Todo, 'id'>) => {
    const id = generateUUID()
    const clientId = (t as any).clientId || generateUUID()
    // Default shared to true if not specified
    const todoData = { ...t, id, clientId, shared: t.shared !== undefined ? t.shared : true }
    await db.todos.add(todoData)
    logger.info('todo:add', { id, title: t.title })
    try {
      const added = await db.todos.get(id)
      todoBus.dispatchEvent(new CustomEvent('todo:added', { detail: added }))
      // Queue sync to server (coalesced, non-blocking)
      import('../utils/syncTasks').then(({ scheduleUpsert }) => {
        if (added) scheduleUpsert(added)
      }).catch(() => {})
    } catch (e) {
      /* ignore */
    }
    return id
  },
  update: async (id: string, patch: Partial<Todo>) => {
    const before = await db.todos.get(id)
    
    // Auto-clear blocked when completing a todo
    if (patch.completed === true && before?.blocked) {
      patch = { ...patch, blocked: false }
    }
    
  const res = await db.todos.update(id, patch)
  logger.info('todo:update', { id, patch })
    
    // Award points when marking complete
    if (before && patch.completed === true && before.completed !== true) {
      const entry: PointsEntry = {
        id: generateUUID(),
        userId: before.userId || 'local-user',
        todoId: before.id,
        points: 10,
        date: new Date().toISOString(),
      }
      await db.points.add(entry)
    }
    // emit an event so listeners can react immediately
    try {
      const updated = await db.todos.get(id)
      todoBus.dispatchEvent(new CustomEvent('todo:updated', { detail: updated }))
      // Queue sync to server (coalesced)
      import('../utils/syncTasks').then(({ scheduleUpsert }) => {
        if (updated) scheduleUpsert(updated)
      }).catch(() => {})
    } catch (e) {
      /* ignore */
    }
    return res
  },
  remove: async (id: string) => {
    const todo = await db.todos.get(id)
    const res = await db.todos.delete(id)
    logger.warn('todo:remove', { id })
    try {
      todoBus.dispatchEvent(new CustomEvent('todo:removed', { detail: { id } }))
      // Queue delete to server (coalesced)
      import('../utils/syncTasks').then(({ scheduleDelete }) => {
        scheduleDelete(id, todo?.serverId || undefined)
      }).catch(() => {})
    } catch (e) {
      /* ignore */
    }
    return res
  },
}

// High-level mutate helper that updates DB and emits a consistent event
export async function mutateTodo(id: string, patch: Partial<Todo>) {
  await Todos.update(id, patch)
  const updated = await db.todos.get(id)
  todoBus.dispatchEvent(new CustomEvent('todo:mutated', { detail: updated }))
  return updated
}

export const Workflows = {
  list: () => db.workflows.toArray(),
  add: (w: Omit<Workflow, 'id'>) => db.workflows.add({ ...w, id: generateUUID() }),
  update: (id: string, patch: Partial<Workflow>) => db.workflows.update(id, patch),
  remove: (id: string) => db.workflows.delete(id),
}

export const Lists = {
  list: () => db.lists.toArray(),
  add: (l: Omit<List, 'id'>) => db.lists.add({ ...l, id: generateUUID() }),
  update: (id: string, patch: Partial<List>) => db.lists.update(id, patch),
  remove: (id: string) => db.lists.delete(id),
}

export const Users = {
  list: () => db.users.toArray(),
  update: (id: string, patch: Partial<User>) => db.users.update(id, patch),
}

export const Attributes = {
  list: () => db.attributes.toArray(),
  add: (a: Omit<AttributeDef, 'id'>) => db.attributes.add({ ...a, id: generateUUID() }),
  update: (id: string, patch: Partial<AttributeDef>) => db.attributes.update(id, patch),
  remove: (id: string) => db.attributes.delete(id),
}

export const Points = {
  list: () => db.points.toArray(),
}

export const Settings = {
  get: (id: string) => db.settings.get(id),
  set: (s: AppSettings) => db.settings.put(s),
}

// Saved Filters helpers

// v0.0.57: Saved Filters helpers moved to savedFiltersHelpers.ts
export { SavedFilters } from './savedFiltersHelpers'

export const Notes = {
  list: () => db.notes.toArray(),
  add: async (n: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'userId'> & { userId?: string }) => {
    const id = generateUUID()
    const clientId = generateUUID() // v0.0.55: Generate clientId for sync tracking
    const now = new Date().toISOString()
    const note: Note = {
      id,
      title: n.title || '',
      content: n.content || '',
      labelIds: n.labelIds || [],
      pinned: n.pinned || false,
      archived: n.archived || false,
      shared: n.shared !== undefined ? n.shared : true,
      createdAt: now,
      updatedAt: now,
      userId: n.userId || 'local-user',
      clientId, // v0.0.55: For deduplication during sync
      version: 1, // v0.0.55: Initial version for conflict resolution
    }
    await db.notes.add(note)
    try {
      const added = await db.notes.get(id)
      notesBus.dispatchEvent(new CustomEvent('note:added', { detail: added }))
    } catch {}
    return id
  },
  update: async (id: string, patch: Partial<Note>) => {
    if (!patch.updatedAt) patch.updatedAt = new Date().toISOString()
    await db.notes.update(id, patch)
    try {
      const updated = await db.notes.get(id)
      notesBus.dispatchEvent(new CustomEvent('note:updated', { detail: updated }))
    } catch {}
  },
  remove: async (id: string) => {
    await db.notes.delete(id)
    notesBus.dispatchEvent(new CustomEvent('note:removed', { detail: { id } }))
  },
}

// Clear all local data (used on logout for security)
export async function clearLocalData() {
  try {
    await Promise.all([
      db.labels.clear(),
      db.todos.clear(),
      db.users.clear(),
      db.workflows.clear(),
      db.savedFilters.clear(), // v0.0.57: Fixed from savedViews
      db.lists.clear(),
      db.attributes.clear(),
      db.points.clear(),
      db.settings.clear(),
      db.notes.clear(),
    ])

    // Trigger UI refresh events so all components update
    todoBus.dispatchEvent(new CustomEvent('todo:mutated'))
    labelBus.dispatchEvent(new CustomEvent('label:updated'))
    window.dispatchEvent(new CustomEvent('todos:refresh'))
    window.dispatchEvent(new CustomEvent('labels:refresh'))
  } catch (e) {
    // ignore
  }
}

// Defensive runtime check to ensure default workflow + attribute exist for existing DBs
export async function ensureDefaults() {
  try {
    const wf = await db.workflows.get('default-kanban')
    if (!wf) {
      await db.workflows.add({
        id: 'default-kanban',
        name: 'Kanban flow',
        stages: ['Backlog', 'To Do', 'In Progress', 'Done'],
        isDefault: true,
        hideBacklog: false,
      } as Workflow)
    }
    const attrs = await db.attributes.toArray()
    const wfAttr = attrs.find(a => (a.name || '').toLowerCase() === 'workflow')
    if (!wfAttr) {
      await db.attributes.add({
        id: generateUUID(),
        name: 'Workflow',
        type: 'workflow',
        defaultValue: 'default-kanban',
        isDefault: true,
      } as AttributeDef)
    } else if (wfAttr.type !== 'workflow' || wfAttr.defaultValue !== 'default-kanban' || (wfAttr as any).options) {
      await db.attributes.update(wfAttr.id, { type: 'workflow', defaultValue: 'default-kanban', options: undefined, isDefault: true })
    }
  } catch (e) {
    // ignore
  }
}

// v0.0.57: Ensure default saved filters exist (All, @me)
export async function ensureDefaultFilters(userId: number) {
  try {
    const { pushFilterToServer } = await import('../utils/syncFilters')
    const { SavedFilters } = await import('./savedFiltersHelpers')
    const filters = await SavedFilters.list()

    // Check if "All" filter exists
    const allFilter = filters.find(f => f.normalizedName === 'all')
    if (!allFilter) {
      const newFilter = {
        id: 0, // Will be assigned by server
        name: 'All',
        normalizedName: 'all',
        queryJson: {
          // HOTFIX: Removed showCompleted: false to let completed tasks show at bottom
          showArchived: false,
        },
        menuVisible: true,
        shared: true,
        ownerId: userId,
        ranking: 0, // Default ranking (alphabetical)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      }
      // v0.0.57: Push to server first (server-first architecture)
      await pushFilterToServer(newFilter)
      logger.info('filters:default:created', { name: 'All' })
    } else {
      // HOTFIX: Migrate existing "All" filters that have showCompleted: false
      const hasShowCompletedFalse = allFilter.queryJson.showCompleted === false

      if (hasShowCompletedFalse) {
        logger.info('filters:all:migrating', { showCompleted: allFilter.queryJson.showCompleted })
        const updatedQueryJson = {
          ...allFilter.queryJson,
        }
        // Remove showCompleted to let completed tasks show at bottom
        delete updatedQueryJson.showCompleted

        const updatedFilter = {
          ...allFilter,
          queryJson: updatedQueryJson,
          updatedAt: new Date().toISOString(),
          version: allFilter.version + 1,
        }
        await pushFilterToServer(updatedFilter)
        logger.info('filters:all:migrated', { name: 'All' })
      }
    }

    // Check if "@me" filter exists
    const meFilter = filters.find(f => f.normalizedName === '@me')
    if (!meFilter) {
      const newFilter = {
        id: 0, // Will be assigned by server
        name: '@me',
        normalizedName: '@me',
        queryJson: {
          // HOTFIX: Use '@me' as special marker instead of static userId
          // This will be dynamically replaced with currentUserId in evaluateFilterQuery
          selectedAssigneeIds: ['@me'],
          // Don't filter completed tasks - let them show at bottom
          showArchived: false,
        },
        menuVisible: true,
        shared: true,
        ownerId: userId,
        ranking: 0, // Default ranking (alphabetical)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      }
      // v0.0.57: Push to server first (server-first architecture)
      await pushFilterToServer(newFilter)
      logger.info('filters:default:created', { name: '@me' })
    } else if (meFilter && meFilter.queryJson?.selectedAssigneeIds) {
      // HOTFIX: Migrate existing @me filters that have static userId to use '@me' marker
      const assigneeIds = meFilter.queryJson.selectedAssigneeIds
      const hasStaticUserId = assigneeIds.length === 1 && assigneeIds[0] !== '@me' && /^\d+$/.test(assigneeIds[0])
      const hasShowCompletedFalse = meFilter.queryJson.showCompleted === false

      if (hasStaticUserId || hasShowCompletedFalse) {
        logger.info('filters:@me:migrating', { oldIds: assigneeIds, showCompleted: meFilter.queryJson.showCompleted })
        const updatedQueryJson = {
          ...meFilter.queryJson,
          selectedAssigneeIds: hasStaticUserId ? ['@me'] : assigneeIds,
        }
        // Remove showCompleted to let completed tasks show at bottom
        delete updatedQueryJson.showCompleted

        const updatedFilter = {
          ...meFilter,
          queryJson: updatedQueryJson,
          updatedAt: new Date().toISOString(),
          version: meFilter.version + 1,
        }
        await pushFilterToServer(updatedFilter)
        logger.info('filters:@me:migrated', { name: '@me' })
      }
    }

    // Dispatch refresh event so UI updates
    window.dispatchEvent(new Event('saved-filters:refresh'))
  } catch (e) {
    logger.error('filters:default:failed', { error: String(e) })
  }
}
