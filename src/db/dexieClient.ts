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
  savedFilters!: Table<SavedFilter, string>
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
      labels: 'id, name, shared, workflowId, userId',
      todos: 'id, userId, completed, labelIds, listId, assignee, dueDate',
      users: 'id, name',
      workflows: 'id, name',
      savedViews: 'id, name, userId',
      lists: 'id, name',
    })

    // v3: 1.7 updates - workflows link labels, todos track workflowId/assigneeIds/blocked
    this.version(3).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, blocked',
      users: 'id, name, email',
      workflows: 'id, name, labelIds',
      savedViews: 'id, name, userId',
      lists: 'id, name',
      attributes: 'id, name, type',
    })

    // v4: add checkboxOnly flag to workflows
    this.version(4).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, blocked',
      users: 'id, name, email',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedViews: 'id, name, userId',
      lists: 'id, name',
      attributes: 'id, name, type',
    })

    // v5: add 'order' to todos for list reordering
    this.version(5).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, blocked, order, createdAt, priority',
      users: 'id, name, email',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedViews: 'id, name, userId',
      lists: 'id, name',
      attributes: 'id, name, type',
    })

    // v6: lists visibility, attributes defaultValue, users extended fields
    this.version(6).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, blocked, order, createdAt, priority',
      users: 'id, name, email, role, ageGroup',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedViews: 'id, name, userId',
      lists: 'id, name, visibility',
      attributes: 'id, name, type, defaultValue',
    })

    // v7: add points table and settings
    this.version(7).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, blocked, order, createdAt, priority',
      users: 'id, name, email, role, ageGroup',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedViews: 'id, name, userId',
      lists: 'id, name, visibility',
      attributes: 'id, name, type, defaultValue',
      points: 'id, userId, todoId, date',
      settings: 'id',
    })

    // v10: add dueTime and repeat fields to todos
    this.version(10).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority',
      users: 'id, name, email, role, ageGroup',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedViews: 'id, name, userId',
      lists: 'id, name, visibility',
      attributes: 'id, name, type, defaultValue',
      points: 'id, userId, todoId, date',
      settings: 'id',
    })

    // v11: add notes table
    this.version(11).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority',
      users: 'id, name, email, role, ageGroup',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedViews: 'id, name, userId',
      lists: 'id, name, visibility',
      attributes: 'id, name, type, defaultValue',
      points: 'id, userId, todoId, date',
      settings: 'id',
      notes: 'id, userId, createdAt, updatedAt, pinned, archived',
    })

    // v12: add default workflow and views (non-indexed fields: isDefault, hideBacklog)
    this.version(12).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority',
      users: 'id, name, email, role, ageGroup',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedViews: 'id, name, userId',
      lists: 'id, name, visibility',
      attributes: 'id, name, type, defaultValue',
      points: 'id, userId, todoId, date',
      settings: 'id',
      notes: 'id, userId, createdAt, updatedAt, pinned, archived',
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
      users: 'id, name, email, role, ageGroup',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedViews: 'id, name, userId',
      lists: 'id, name, visibility',
      attributes: 'id, name, type, defaultValue',
      points: 'id, userId, todoId, date',
      settings: 'id',
      notes: 'id, userId, createdAt, updatedAt, pinned, archived',
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
      users: 'id, name, email, role, ageGroup',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedViews: 'id, name, userId',
      lists: 'id, name, visibility',
      attributes: 'id, name, type, defaultValue',
      points: 'id, userId, todoId, date',
      settings: 'id',
      notes: 'id, userId, createdAt, updatedAt, pinned, archived',
    })

    // v15: add clientId index to todos for robust de-duplication with server
    this.version(15).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority, serverId, clientId',
      users: 'id, name, email, role, ageGroup',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedViews: 'id, name, userId',
      lists: 'id, name, visibility',
      attributes: 'id, name, type, defaultValue',
      points: 'id, userId, todoId, date',
      settings: 'id',
      notes: 'id, userId, createdAt, updatedAt, pinned, archived',
    })

    // v16: add userId index to labels for query and sync
    this.version(16).stores({
      labels: 'id, name, shared, workflowId, userId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority, serverId, clientId',
      users: 'id, name, email, role, ageGroup',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedViews: 'id, name, userId',
      lists: 'id, name, visibility',
      attributes: 'id, name, type, defaultValue',
      points: 'id, userId, todoId, date',
      settings: 'id',
      notes: 'id, userId, createdAt, updatedAt, pinned, archived',
    })

    // v17: add ownerId to labels, shared to todos and notes for privacy model
    this.version(17).stores({
      labels: 'id, name, shared, workflowId, userId, ownerId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority, serverId, clientId, shared',
      users: 'id, name, email, role, ageGroup',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedViews: 'id, name, userId',
      lists: 'id, name, visibility',
      attributes: 'id, name, type, defaultValue',
      points: 'id, userId, todoId, date',
      settings: 'id',
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
      labels: 'id, name, shared, workflowId, userId, ownerId',
      todos: 'id, userId, completed, labelIds, listId, workflowId, assigneeIds, dueDate, dueTime, repeat, blocked, order, createdAt, priority, serverId, clientId, shared',
      users: 'id, name, email, role, ageGroup',
      workflows: 'id, name, labelIds, checkboxOnly',
      savedFilters: 'id, name, userId',
      lists: 'id, name, visibility',
      attributes: 'id, name, type, defaultValue',
      points: 'id, userId, todoId, date',
      settings: 'id',
      notes: 'id, userId, createdAt, updatedAt, pinned, archived, shared',
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
export const SavedFilters = {
  list: () => db.savedFilters.toArray(),
  get: (id: string) => db.savedFilters.get(id),
  getBySlug: async (slug: string) => {
    const filters = await db.savedFilters.toArray()
    return filters.find((f) => f.slug === slug)
  },
  update: (id: string, patch: Partial<SavedFilter>) => db.savedFilters.update(id, patch),
  add: async (input: Omit<SavedFilter, 'id' | 'userId'> & { userId?: string }) => {
    const id = generateUUID()
    const filter: SavedFilter = {
      id,
      name: input.name,
      slug: input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      labelFilterIds: input.labelFilterIds || [],
      attributeFilters: input.attributeFilters || {},
      statusFilter: input.statusFilter,
      sortBy: input.sortBy,
      viewMode: input.viewMode,
      icon: input.icon,
      showInSidebar: input.showInSidebar,
      isSystem: input.isSystem,
      userId: input.userId || 'local-user',
    }
    await db.savedFilters.add(filter)
    return id
  },
  remove: (id: string) => db.savedFilters.delete(id),
  ensureMeFilter: async () => {
    try {
      const me = await db.savedFilters.get('me')
      // Determine current user id (first user or fallback)
      const users = await db.users.toArray()
      const currentUserId = users[0]?.id || 'local-user'
      if (!me) {
        const filter: SavedFilter = {
          id: 'me',
          name: '@me',
          slug: 'me',
          icon: '🙋',
          labelFilterIds: [],
          attributeFilters: {
            assignees: currentUserId,
            sort: 'created',
            blockedOnly: '0',
            workflows: '',
            dueStart: '',
            dueEnd: '',
          },
          sortBy: 'created',
          viewMode: 'list',
          userId: currentUserId,
          showInSidebar: true,
          isSystem: true,
        }
        await db.savedFilters.put(filter)
      } else {
        // Keep user binding updated if empty
        if (!me.userId) {
          await db.savedFilters.update('me', { userId: currentUserId })
        }
        if (me.isSystem !== true) {
          await db.savedFilters.update('me', { isSystem: true })
        }
        // Ensure slug is set (for existing filters created before v0.0.53)
        if (!me.slug) {
          await db.savedFilters.update('me', { slug: 'me' })
        }
      }
    } catch (e) {
      // ignore
    }
  },
  ensureDefaultFilters: async () => {
    try {
      const users = await db.users.toArray()
      const currentUserId = users[0]?.id || 'local-user'

      // Default "All" filter (always visible)
      const allFilter = await db.savedFilters.get('all')
      if (!allFilter) {
        await db.savedFilters.put({
          id: 'all',
          name: 'All',
          slug: 'all',
          icon: '📋',
          labelFilterIds: [],
          attributeFilters: {},
          sortBy: 'created',
          viewMode: 'list',
          userId: currentUserId,
          showInSidebar: true,
          isSystem: true,
          isDefault: true,
        })
      } else {
        // Ensure isDefault and slug are set, and update icon for visual consistency
        if (!allFilter.isDefault || !allFilter.slug || allFilter.icon === '⭐') {
          await db.savedFilters.update('all', { isDefault: true, icon: '📋', slug: 'all' })
        }
      }

      // Default "Backlog" filter (hidden by default)
      const backlogFilter = await db.savedFilters.get('backlog')
      if (!backlogFilter) {
        await db.savedFilters.put({
          id: 'backlog',
          name: 'Backlog',
          slug: 'backlog',
          icon: '📦',
          labelFilterIds: [],
          attributeFilters: { workflowStage: 'Backlog' },
          sortBy: 'created',
          viewMode: 'list',
          userId: currentUserId,
          showInSidebar: false, // hidden by default
          isSystem: true,
          isDefault: true,
        })
      } else {
        // Ensure isDefault and slug are set, and update icon for visual consistency
        if (!backlogFilter.isDefault || !backlogFilter.slug || backlogFilter.icon === '⭐') {
          await db.savedFilters.update('backlog', { isDefault: true, icon: '📦', slug: 'backlog' })
        }
      }
    } catch (e) {
      // ignore
    }
  },
}

export const Notes = {
  list: () => db.notes.toArray(),
  add: async (n: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'userId'> & { userId?: string }) => {
    const id = generateUUID()
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
      db.savedViews.clear(),
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
