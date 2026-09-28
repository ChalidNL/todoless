import type { Entry, Item, Task } from '../types';

/**
 * Realtime event shape delivered by PocketBase realtime subscriptions.
 * `action` is one of 'create' | 'update' | 'delete'; `record` is the full
 * record for create/update and (in current PocketBase versions) also for
 * delete, which is all the reducer below needs.
 */
export interface RealtimeEvent<T = any> {
  action: string;
  record: T;
}

/** Insert `next` at the front when absent, otherwise replace in place. */
export function upsertById<T extends { id: string }>(list: T[], next: T): T[] {
  const idx = list.findIndex((entry) => entry.id === next.id);
  if (idx === -1) return [next, ...list];
  const copy = [...list];
  copy[idx] = next;
  return copy;
}

/** Remove the entry with the given id, keeping order. */
export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((entry) => entry.id !== id);
}

/**
 * Upsert an Entry into the unified list while preserving the ordering that
 * `refreshEntries()` produces: the tasks section first (newest first, matching
 * the API's `sort: '-created'`), followed by the items section (newest first).
 * New tasks go to the front of the task section; new items to the front of the
 * item section; updates replace in place.
 */
export function upsertEntry(list: Entry[], next: Entry): Entry[] {
  const idx = list.findIndex((entry) => entry.id === next.id);
  if (idx !== -1) {
    const copy = [...list];
    copy[idx] = next;
    return copy;
  }
  if (next.type === 'task') return [next, ...list];
  const firstItemIdx = list.findIndex((entry) => entry.type === 'item');
  const insertAt = firstItemIdx === -1 ? list.length : firstItemIdx;
  return [...list.slice(0, insertAt), next, ...list.slice(insertAt)];
}

/** Convert a normalized Task to its unified Entry shape (mirrors refreshEntries). */
export function taskToEntry(task: Task): Entry {
  return {
    ...task,
    type: 'task' as const,
    completed: task.status === 'done',
  };
}

/** Convert a normalized Item to its unified Entry shape (mirrors refreshEntries). */
export function itemToEntry(item: Item): Entry {
  return {
    ...item,
    type: 'item' as const,
    status: item.completed ? ('done' as const) : ('todo' as const),
    blocked: false,
    flag: false,
    focus: item.focus ?? false,
    completed: item.completed,
  };
}