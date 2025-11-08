import Dexie, { Table } from 'dexie'
import type { Label, Todo, User, Workflow, SavedView, List, AttributeDef, PointsEntry, AppSettings, Note } from './schema'
import { logger } from '../utils/logger'

class TodolessDB extends Dexie {
  labels!: Table<Label, string>
  todos!: Table<Todo, string>
  users!: Table<User, string>
  workflows!: Table<Workflow, string>
  savedViews!: Table<SavedView, string>
  lists!: Table<List, string>
  attributes!: Table<AttributeDef, string>
  points!: Table<PointsEntry, string>
  settings!: Table<AppSettings, string>
  notes!: Table<Note, string>

  constructor() {
    super('todoless')

    this.version(1).stores({
      labels: 'id, name, shared, workflowId',
      todos: 'id, userId, completed',
      users: 'id, name',
      workflows: 'id, name',
      savedViews: 'id, name, userId',
    })

    // v2: add lists table and extend todos indexes
    this.version(2).stores({
      labels: 'id, name, shared, workflowId',
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

    this.on('populate', async () => {
      const userId = 'local-user'
      await this.users.add({ id: userId, name: 'You', themeColor: '#0ea5e9' })
      const labelA: Label = { id: generateUUID(), name: 'Inbox', color: '#0ea5e9', shared: false }
      const labelB: Label = { id: generateUUID(), name: 'Groceries', color: '#84cc16', shared: false }
      const labelC: Label = { id: generateUUID(), name: 'Work', color: '#f97316', shared: true }
      await this.labels.bulkAdd([labelA, labelB, labelC])
      await this.todos.bulkAdd([
        { id: generateUUID(), title: 'Welcome to Todoless', completed: false, labelIds: [labelA.id], userId },
        { id: generateUUID(), title: 'Add your first label', completed: false, labelIds: [labelA.id], userId },
        { id: generateUUID(), title: 'Buy milk', completed: false, labelIds: [labelB.id], userId },
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
  list: () => db.labels.toArray(),
  add: async (l: Omit<Label, 'id'>) => {
    const id = generateUUID()
    await db.labels.add({ ...l, id })
    try {
      const added = await db.labels.get(id)
      labelBus.dispatchEvent(new CustomEvent('label:added', { detail: added }))
    } catch (e) {
      /* ignore */
    }
    return id
  },
  update: (id: string, patch: Partial<Label>) => db.labels.update(id, patch),
  remove: (id: string) => db.labels.delete(id),
}

export const Todos = {
  list: () => db.todos.toArray(),
  add: async (t: Omit<Todo, 'id'>) => {
    const id = generateUUID()
    const clientId = (t as any).clientId || generateUUID()
    await db.todos.add({ ...t, id, clientId })
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

// Saved Views helpers
export const SavedViews = {
  list: () => db.savedViews.toArray(),
  get: (id: string) => db.savedViews.get(id),
  update: (id: string, patch: Partial<SavedView>) => db.savedViews.update(id, patch),
  add: async (input: Omit<SavedView, 'id' | 'userId'> & { userId?: string }) => {
    const id = generateUUID()
    const view: SavedView = {
      id,
      name: input.name,
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
    await db.savedViews.add(view)
    return id
  },
  remove: (id: string) => db.savedViews.delete(id),
  ensureMeView: async () => {
    try {
      const me = await db.savedViews.get('me')
      // Determine current user id (first user or fallback)
      const users = await db.users.toArray()
      const currentUserId = users[0]?.id || 'local-user'
      if (!me) {
        const view: SavedView = {
          id: 'me',
          name: '@me',
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
        await db.savedViews.put(view)
      } else {
        // Keep user binding updated if empty
        if (!me.userId) {
          await db.savedViews.update('me', { userId: currentUserId })
        }
        if (me.isSystem !== true) {
          await db.savedViews.update('me', { isSystem: true })
        }
      }
    } catch (e) {
      // ignore
    }
  },
  ensureDefaultViews: async () => {
    try {
      const users = await db.users.toArray()
      const currentUserId = users[0]?.id || 'local-user'
      
      // Default "All" view (always visible)
      const allView = await db.savedViews.get('all')
      if (!allView) {
        await db.savedViews.put({
          id: 'all',
          name: 'All',
          icon: '⭐',
          labelFilterIds: [],
          attributeFilters: {},
          sortBy: 'created',
          viewMode: 'list',
          userId: currentUserId,
          showInSidebar: true,
          isSystem: true,
          isDefault: true,
        })
      } else if (!allView.isDefault) {
        await db.savedViews.update('all', { isDefault: true, icon: '⭐' })
      }
      
      // Default "Backlog" view (hidden by default)
      const backlogView = await db.savedViews.get('backlog')
      if (!backlogView) {
        await db.savedViews.put({
          id: 'backlog',
          name: 'Backlog',
          icon: '⭐',
          labelFilterIds: [],
          attributeFilters: { workflowStage: 'Backlog' },
          sortBy: 'created',
          viewMode: 'list',
          userId: currentUserId,
          showInSidebar: false, // hidden by default
          isSystem: true,
          isDefault: true,
        })
      } else if (!backlogView.isDefault) {
        await db.savedViews.update('backlog', { isDefault: true, icon: '⭐' })
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
      createdAt: now,
      updatedAt: now,
      userId: n.userId || 'local-user',
    }
    await db.notes.add(note)
    return id
  },
  update: async (id: string, patch: Partial<Note>) => {
    if (!patch.updatedAt) patch.updatedAt = new Date().toISOString()
    return db.notes.update(id, patch)
  },
  remove: (id: string) => db.notes.delete(id),
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

