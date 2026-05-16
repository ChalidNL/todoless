/**
 * Offline-aware API wrapper.
 * Wraps the existing api-client to provide offline-first behavior:
 * - Reads: try network, fall back to IndexedDB cache
 * - Writes: try network, queue on failure
 * - Sync engine handles reconnection flushing
 */

import { api } from './api-client';
import { syncEngine } from './sync-engine';
import * as offline from './offline-store';
import type { EntityCollection } from './offline-store';
import type {
  Task, Item, Note, Label, Shop, Sprint,
  CalendarEvent, AppSettings, User, Reward, Goal, Project,
} from '../types';

// --- Helper: read with offline fallback ---
async function readWithFallback<T>(
  collection: EntityCollection,
  networkFn: () => Promise<T>,
): Promise<T> {
  if (syncEngine.isOnline()) {
    try {
      const result = await networkFn();
      // Cache successful read
      return result;
    } catch (e: any) {
      if (isNetworkError(e)) {
        syncEngine.goOffline();
        // Fall through to cache
      } else {
        throw e;
      }
    }
  }

  // Fall back to local cache
  return (await offline.getCollection<T>(collection)) as T;
}

function isNetworkError(error: any): boolean {
  const msg = (error?.message || '').toLowerCase();
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('offline') ||
    error?.name === 'NetworkError' ||
    error?.status === 0
  );
}

// --- Offline-aware API ---

export const offlineApi = {
  tasks: {
    async list(status?: string): Promise<Task[]> {
      return readWithFallback('tasks', () => api.tasks.list(status));
    },
    async create(data: Partial<Task>): Promise<Task | null> {
      const result = await syncEngine.tryOrQueue(
        'tasks', 'create',
        () => api.tasks.create(data),
        data,
      );
      if (result.queued) {
        // Optimistic: create locally with temp ID
        const localTask = { ...data, id: crypto.randomUUID(), createdAt: Date.now() } as Task;
        await offline.putRecord('tasks', localTask);
        return localTask;
      }
      return (result.result as Task) ?? null;
    },
    async update(id: string, data: Partial<Task>): Promise<Task | null> {
      const result = await syncEngine.tryOrQueue(
        'tasks', 'update',
        () => api.tasks.update(id, data),
        data, id,
      );
      if (result.queued) {
        // Optimistic update
        const existing = await offline.getRecord<Task>('tasks', id);
        if (existing) {
          await offline.putRecord('tasks', { ...existing, ...data });
        }
      }
      return (result.result as Task) ?? null;
    },
    async delete(id: string): Promise<void> {
      const result = await syncEngine.tryOrQueue(
        'tasks', 'delete',
        () => api.tasks.delete(id),
        {}, id,
      );
      if (result.queued) {
        await offline.deleteRecord('tasks', id);
      }
    },
  },

  items: {
    async list(): Promise<Item[]> {
      return readWithFallback('items', () => api.items.list());
    },
    async create(data: Partial<Item>): Promise<Item | null> {
      const result = await syncEngine.tryOrQueue(
        'items', 'create',
        () => api.items.create(data),
        data,
      );
      if (result.queued) {
        const localItem = { ...data, id: crypto.randomUUID(), createdAt: Date.now() } as Item;
        await offline.putRecord('items', localItem);
        return localItem;
      }
      return (result.result as Item) ?? null;
    },
    async update(id: string, data: Partial<Item>): Promise<Item | null> {
      const result = await syncEngine.tryOrQueue(
        'items', 'update',
        () => api.items.update(id, data),
        data, id,
      );
      if (result.queued) {
        const existing = await offline.getRecord<Item>('items', id);
        if (existing) {
          await offline.putRecord('items', { ...existing, ...data });
        }
      }
      return (result.result as Item) ?? null;
    },
    async delete(id: string): Promise<void> {
      const result = await syncEngine.tryOrQueue(
        'items', 'delete',
        () => api.items.delete(id),
        {}, id,
      );
      if (result.queued) {
        await offline.deleteRecord('items', id);
      }
    },
  },

  notes: {
    async list(): Promise<Note[]> {
      return readWithFallback('notes', () => api.notes.list());
    },
    async create(data: Partial<Note>): Promise<Note | null> {
      const result = await syncEngine.tryOrQueue(
        'notes', 'create',
        () => api.notes.create(data),
        data,
      );
      if (result.queued) {
        const localNote = { ...data, id: crypto.randomUUID(), createdAt: Date.now() } as Note;
        await offline.putRecord('notes', localNote);
        return localNote;
      }
      return (result.result as Note) ?? null;
    },
    async update(id: string, data: Partial<Note>): Promise<Note | null> {
      const result = await syncEngine.tryOrQueue(
        'notes', 'update',
        () => api.notes.update(id, data),
        data, id,
      );
      if (result.queued) {
        const existing = await offline.getRecord<Note>('notes', id);
        if (existing) {
          await offline.putRecord('notes', { ...existing, ...data });
        }
      }
      return (result.result as Note) ?? null;
    },
    async delete(id: string): Promise<void> {
      const result = await syncEngine.tryOrQueue(
        'notes', 'delete',
        () => api.notes.delete(id),
        {}, id,
      );
      if (result.queued) {
        await offline.deleteRecord('notes', id);
      }
    },
  },

  labels: {
    async list(): Promise<Label[]> {
      return readWithFallback('labels', () => api.labels.list());
    },
    async create(data: Partial<Label>): Promise<Label | null> {
      const result = await syncEngine.tryOrQueue(
        'labels', 'create',
        () => api.labels.create(data),
        data,
      );
      if (result.queued) {
        const localLabel = { ...data, id: crypto.randomUUID() } as Label;
        await offline.putRecord('labels', localLabel);
        return localLabel;
      }
      return (result.result as Label) ?? null;
    },
    async update(id: string, data: Partial<Label>): Promise<Label | null> {
      const result = await syncEngine.tryOrQueue(
        'labels', 'update',
        () => api.labels.update(id, data),
        data, id,
      );
      if (result.queued) {
        const existing = await offline.getRecord<Label>('labels', id);
        if (existing) {
          await offline.putRecord('labels', { ...existing, ...data });
        }
      }
      return (result.result as Label) ?? null;
    },
    async delete(id: string): Promise<void> {
      const result = await syncEngine.tryOrQueue(
        'labels', 'delete',
        () => api.labels.delete(id),
        {}, id,
      );
      if (result.queued) {
        await offline.deleteRecord('labels', id);
      }
    },
  },

  shops: {
    async list(): Promise<Shop[]> {
      return readWithFallback('shops', () => api.shops.list());
    },
    async create(data: Partial<Shop>): Promise<Shop | null> {
      const result = await syncEngine.tryOrQueue(
        'shops', 'create',
        () => api.shops.create(data),
        data,
      );
      if (result.queued) {
        const localShop = { ...data, id: crypto.randomUUID() } as Shop;
        await offline.putRecord('shops', localShop);
        return localShop;
      }
      return (result.result as Shop) ?? null;
    },
    async update(id: string, data: Partial<Shop>): Promise<Shop | null> {
      const result = await syncEngine.tryOrQueue(
        'shops', 'update',
        () => api.shops.update(id, data),
        data, id,
      );
      if (result.queued) {
        const existing = await offline.getRecord<Shop>('shops', id);
        if (existing) {
          await offline.putRecord('shops', { ...existing, ...data });
        }
      }
      return (result.result as Shop) ?? null;
    },
    async delete(id: string): Promise<void> {
      const result = await syncEngine.tryOrQueue(
        'shops', 'delete',
        () => api.shops.delete(id),
        {}, id,
      );
      if (result.queued) {
        await offline.deleteRecord('shops', id);
      }
    },
  },

  sprints: {
    async list(): Promise<Sprint[]> {
      return readWithFallback('sprints', () => api.sprints.list());
    },
    async create(data: Partial<Sprint>): Promise<Sprint | null> {
      const result = await syncEngine.tryOrQueue(
        'sprints', 'create',
        () => api.sprints.create(data),
        data,
      );
      if (result.queued) {
        const localSprint = { ...data, id: crypto.randomUUID() } as Sprint;
        await offline.putRecord('sprints', localSprint);
        return localSprint;
      }
      return (result.result as Sprint) ?? null;
    },
    async update(id: string, data: Partial<Sprint>): Promise<Sprint | null> {
      const result = await syncEngine.tryOrQueue(
        'sprints', 'update',
        () => api.sprints.update(id, data),
        data, id,
      );
      if (result.queued) {
        const existing = await offline.getRecord<Sprint>('sprints', id);
        if (existing) {
          await offline.putRecord('sprints', { ...existing, ...data });
        }
      }
      return (result.result as Sprint) ?? null;
    },
    async delete(id: string): Promise<void> {
      const result = await syncEngine.tryOrQueue(
        'sprints', 'delete',
        () => api.sprints.delete(id),
        {}, id,
      );
      if (result.queued) {
        await offline.deleteRecord('sprints', id);
      }
    },
  },

  calendar: {
    async list(): Promise<CalendarEvent[]> {
      return readWithFallback('calendar_events', () => api.calendar.list());
    },
    async create(data: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
      const result = await syncEngine.tryOrQueue(
        'calendar_events', 'create',
        () => api.calendar.create(data),
        data,
      );
      if (result.queued) {
        const localEvent = { ...data, id: crypto.randomUUID(), createdAt: Date.now() } as CalendarEvent;
        await offline.putRecord('calendar_events', localEvent);
        return localEvent;
      }
      return (result.result as CalendarEvent) ?? null;
    },
    async update(id: string, data: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
      const result = await syncEngine.tryOrQueue(
        'calendar_events', 'update',
        () => api.calendar.update(id, data),
        data, id,
      );
      if (result.queued) {
        const existing = await offline.getRecord<CalendarEvent>('calendar_events', id);
        if (existing) {
          await offline.putRecord('calendar_events', { ...existing, ...data });
        }
      }
      return (result.result as CalendarEvent) ?? null;
    },
    async delete(id: string): Promise<void> {
      const result = await syncEngine.tryOrQueue(
        'calendar_events', 'delete',
        () => api.calendar.delete(id),
        {}, id,
      );
      if (result.queued) {
        await offline.deleteRecord('calendar_events', id);
      }
    },
  },

  rewards: {
    async list(): Promise<Reward[]> {
      return readWithFallback('rewards', () => api.rewards.list());
    },
    async create(data: Partial<Reward>): Promise<Reward | null> {
      const result = await syncEngine.tryOrQueue(
        'rewards', 'create',
        () => api.rewards.create(data),
        data,
      );
      if (result.queued) {
        const localReward = { ...data, id: crypto.randomUUID() } as Reward;
        await offline.putRecord('rewards', localReward);
        return localReward;
      }
      return (result.result as Reward) ?? null;
    },
    async delete(id: string): Promise<void> {
      const result = await syncEngine.tryOrQueue(
        'rewards', 'delete',
        () => api.rewards.delete(id),
        {}, id,
      );
      if (result.queued) {
        await offline.deleteRecord('rewards', id);
      }
    },
  },

  goals: {
    async list(): Promise<Goal[]> {
      return readWithFallback('goals', () => api.goals.list());
    },
    async create(data: Partial<Goal>): Promise<Goal | null> {
      const result = await syncEngine.tryOrQueue(
        'goals', 'create',
        () => api.goals.create(data),
        data,
      );
      if (result.queued) {
        const localGoal = { ...data, id: crypto.randomUUID(), createdBy: '' } as Goal;
        await offline.putRecord('goals', localGoal);
        return localGoal;
      }
      return (result.result as Goal) ?? null;
    },
    async update(id: string, data: Partial<Goal>): Promise<Goal | null> {
      const result = await syncEngine.tryOrQueue(
        'goals', 'update',
        () => api.goals.update(id, data),
        data, id,
      );
      if (result.queued) {
        const existing = await offline.getRecord<Goal>('goals', id);
        if (existing) {
          await offline.putRecord('goals', { ...existing, ...data });
        }
      }
      return (result.result as Goal) ?? null;
    },
    async delete(id: string): Promise<void> {
      const result = await syncEngine.tryOrQueue(
        'goals', 'delete',
        () => api.goals.delete(id),
        {}, id,
      );
      if (result.queued) {
        await offline.deleteRecord('goals', id);
      }
    },
  },

  settings: {
    async get(): Promise<AppSettings> {
      return readWithFallback('settings', () => api.settings.get());
    },
    async update(data: Partial<AppSettings>): Promise<AppSettings | null> {
      const result = await syncEngine.tryOrQueue(
        'settings', 'update',
        () => api.settings.update(data),
        data,
      );
      if (result.queued) {
        const existing = await offline.getRecord<AppSettings>('settings', 'current');
        const merged = { ...existing, ...data, id: 'current' };
        await offline.putRecord('settings', merged);
        return merged;
      }
      return (result.result as AppSettings) ?? null;
    },
  },

  // Projects uses the pocketbase-client, not the REST api client
  // Will be handled via the pocketbase-client directly

  // Export original api for auth and other non-offline operations
  _original: api,
};

// Initialize sync engine with API client
syncEngine.setApiClient(api);

export type OfflineApiClient = typeof offlineApi;
