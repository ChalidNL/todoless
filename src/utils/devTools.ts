import { db, Labels, Lists, Notes, SavedFilters, Todos, Users, Workflows, ensureDefaults, clearLocalData } from '../db/dexieClient'
import type { Label, List, Note, Todo, Workflow, User } from '../db/schema'

function uuid(): string {
  try {
    // Prefer native when available
    // @ts-ignore
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      // @ts-ignore
      return crypto.randomUUID()
    }
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Remove ALL local data from Dexie. Does not touch remote/server.
 */
export async function flushDatabase() {
  // First, delete ALL server data (todos, labels, notes, etc.)
  try {
    // Get all todos with serverIds and delete from server
    const todos = await Todos.list()
    for (const todo of todos) {
      if (todo.serverId) {
        try {
          await fetch(`/api/tasks/${todo.serverId}`, {
            method: 'DELETE',
            credentials: 'include'
          })
        } catch (e) {
          console.warn('Failed to delete server todo:', e)
        }
      }
    }

    // Delete all labels from server
    const labels = await Labels.list()
    for (const label of labels) {
      if (label.id) {
        try {
          await fetch(`/api/labels/${label.id}`, {
            method: 'DELETE',
            credentials: 'include'
          })
        } catch (e) {
          console.warn('Failed to delete server label:', e)
        }
      }
    }

    // Delete all notes from server
    const notes = await Notes.list()
    for (const note of notes) {
      if (note.id) {
        try {
          await fetch(`/api/notes/${note.id}`, {
            method: 'DELETE',
            credentials: 'include'
          })
        } catch (e) {
          console.warn('Failed to delete server note:', e)
        }
      }
    }
  } catch (e) {
    console.warn('Failed to clear server data:', e)
  }

  // Then clear local data
  await clearLocalData()

  // TEST-ONLY: Also clear cookies, localStorage, and sessionStorage for a full reset
  try {
    // Clear all cookies (browser only)
    if (typeof document !== 'undefined') {
      document.cookie.split(';').forEach(function(c) {
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
      });
    }
    // Clear localStorage and sessionStorage
    if (typeof localStorage !== 'undefined') localStorage.clear()
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
    // Clear any service worker caches
    if (typeof caches !== 'undefined' && caches.keys) {
      caches.keys().then(keys => keys.forEach(key => caches.delete(key)))
    }
  } catch {}

  // Re-seed minimal defaults that the app assumes (users, default workflow, default views)
  const me: User = { id: 'local-user', name: 'You', themeColor: '#0ea5e9' }
  await db.users.put(me)
  await ensureDefaults()
  // HOTFIX 0.0.57: Default filters are now created in dexieClient.ts ensureDefaultFilters()
  // No need to call separate methods here

  // Trigger full UI refresh
  window.dispatchEvent(new CustomEvent('todos:refresh'))
  window.dispatchEvent(new CustomEvent('labels:refresh'))
  window.dispatchEvent(new CustomEvent('saved-filters:refresh'))
}

/**
 * Import a rich set of mock data to exercise UI flows.
 * This will FLUSH existing local data first to avoid duplicate collisions.
 */
export async function importMockData() {
  // Start clean for deterministic data
  await flushDatabase()

  // Users
  const me: User = { id: 'local-user', name: 'You', email: 'you@example.com', themeColor: '#0ea5e9' }
  const alice: User = { id: uuid(), name: 'Alice', email: 'alice@example.com', themeColor: '#8b5cf6' }
  const bob: User = { id: uuid(), name: 'Bob', email: 'bob@example.com', themeColor: '#10b981' }
  await db.users.bulkPut([me, alice, bob])

  // Labels
  const labels: Label[] = [
    { id: uuid(), name: 'Inbox', color: '#0ea5e9', shared: true },
    { id: uuid(), name: 'Work', color: '#f97316', shared: true },
    { id: uuid(), name: 'Personal', color: '#6366f1', shared: true },
    { id: uuid(), name: 'Urgent', color: '#ef4444', shared: true },
    { id: uuid(), name: 'Groceries', color: '#84cc16', shared: true },
  ]
  await db.labels.bulkAdd(labels)

  // Lists
  const lists: List[] = [
    { id: uuid(), name: 'Personal', description: 'Personal stuff', labelIds: [labels[2].id] },
    { id: uuid(), name: 'Work', description: 'Work items', labelIds: [labels[1].id] },
    { id: uuid(), name: 'Groceries', description: 'Things to buy', labelIds: [labels[4].id] },
  ]
  await db.lists.bulkAdd(lists)

  // Workflow: ensure default exists and add another custom one
  const defaultWf = await db.workflows.get('default-kanban') as Workflow | undefined
  const bugFlow: Workflow = {
    id: uuid(),
    name: 'Bug flow',
    stages: ['Report', 'Triage', 'Fix', 'Verify', 'Done'],
    basedOn: 'label',
    labelIds: [labels[1].id, labels[3].id],
    checkboxOnly: false,
  }
  if (defaultWf) {
    await db.workflows.put(defaultWf)
  }
  await db.workflows.add(bugFlow)

  // Todos
  const now = new Date()
  const iso = (d: Date) => d.toISOString()
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)

  const todos: Todo[] = [
    { id: uuid(), title: 'Welcome to Todoless', completed: false, labelIds: [labels[0].id], userId: me.id, createdAt: iso(now), priority: 'medium' },
    { id: uuid(), title: 'Plan sprint', completed: false, labelIds: [labels[1].id], userId: me.id, dueDate: iso(addDays(now, 1)), priority: 'high', workflowId: 'default-kanban', workflowStage: 'To Do' },
    { id: uuid(), title: 'Fix production bug', completed: false, labelIds: [labels[1].id, labels[3].id], userId: me.id, blocked: true, priority: 'high', workflowId: bugFlow.id, workflowStage: 'Triage', assigneeIds: [alice.id] },
    { id: uuid(), title: 'Buy milk', completed: false, labelIds: [labels[4].id], userId: me.id, listId: lists[2].id, priority: 'low' },
    { id: uuid(), title: 'Gym workout', completed: false, labelIds: [labels[2].id], userId: me.id, repeat: 'weekly', dueDate: iso(addDays(now, 7)), priority: 'medium' },
    { id: uuid(), title: 'Book vacation', completed: false, labelIds: [labels[2].id], userId: me.id, dueDate: iso(addDays(now, 30)), priority: 'low' },
  ]
  await db.todos.bulkAdd(todos)

  // Notes
  const notes: Note[] = [
    { id: uuid(), title: 'Project ideas', content: '- AI feature\n- Offline mode', labelIds: [labels[1].id], pinned: true, archived: false, shared: true, sharedWith: [alice.id], flagged: false, createdAt: iso(now), updatedAt: iso(now), userId: me.id },
    { id: uuid(), title: 'Shopping list', content: 'Milk\nEggs\nBread', labelIds: [labels[4].id], pinned: false, archived: false, shared: true, sharedWith: [], flagged: false, createdAt: iso(now), updatedAt: iso(now), userId: me.id },
    { id: uuid(), title: 'Q4 OKRs', content: 'Grow MAU to 10k', labelIds: [labels[1].id, labels[3].id], pinned: false, archived: false, shared: true, sharedWith: [bob.id], flagged: true, createdAt: iso(now), updatedAt: iso(now), userId: me.id, dueDate: iso(addDays(now, 14)) },
  ]
  await db.notes.bulkAdd(notes)

  // Link a note to a todo
  const note0 = notes[0]
  const todo0 = todos[1]
  await db.notes.update(note0.id, { linkedTodoIds: [todo0.id] })
  await db.todos.update(todo0.id, { linkedNoteIds: [note0.id] })

  // HOTFIX 0.0.57: Default filters are now created in dexieClient.ts ensureDefaultFilters()
  // No need to call separate methods here

  await db.savedViews.put({
    id: uuid(),
    name: 'High Priority',
    icon: '🔥',
    sortBy: 'created',
    viewMode: 'list',
    userId: me.id,
    labelFilterIds: [],
    attributeFilters: { priority: 'high' },
    showInSidebar: true,
  })
}
