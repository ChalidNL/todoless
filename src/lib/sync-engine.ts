/**
 * Sync engine: online/offline detection and mutation queue flushing.
 *
 * When online: operations go to PocketBase directly, results are cached locally.
 * When offline: operations are queued in IndexedDB, data is read from cache.
 * On reconnect: queued mutations are replayed to PocketBase in order.
 */

import type { ApiClient } from './api-client';
import type { QueuedMutation, EntityCollection } from './offline-store';
import * as offline from './offline-store';

type OnlineStatus = 'online' | 'offline';
type SyncStateListener = (status: OnlineStatus) => void;

class SyncEngine {
  private status: OnlineStatus = 'online';
  private listeners: SyncStateListener[] = [];
  private api: ApiClient | null = null;
  private syncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.status = navigator.onLine ? 'online' : 'offline';
      window.addEventListener('online', () => this.setOnline(true));
      window.addEventListener('offline', () => this.setOnline(false));
    }
  }

  /** Bind the API client (needed for mutation replay). */
  setApiClient(api: ApiClient) {
    this.api = api;
  }

  /** Get current online status. */
  isOnline(): boolean {
    return this.status === 'online';
  }

  getStatus(): OnlineStatus {
    return this.status;
  }

  /** Subscribe to status changes. Returns unsubscribe fn. */
  onChange(listener: SyncStateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Set online status directly (used by external code on detection). */
  goOffline() {
    this.setOnline(false);
  }

  private setOnline(online: boolean) {
    const newStatus: OnlineStatus = online ? 'online' : 'offline';
    if (newStatus === this.status) return;
    this.status = newStatus;
    this.listeners.forEach((l) => l(this.status));
    if (online) {
      void this.flushQueue();
    }
  }

  /** Attempt to flush queued mutations to the server. */
  async flushQueue(): Promise<void> {
    if (this.syncing || !this.api || this.status !== 'online') return;
    this.syncing = true;

    try {
      const mutations = await offline.getQueuedMutations();
      // Sort by timestamp (oldest first)
      mutations.sort((a, b) => a.timestamp - b.timestamp);

      for (const mutation of mutations) {
        const success = await this.replayMutation(mutation);
        if (success) {
          await offline.dequeueMutation(mutation.id);
        } else {
          // Stop on first failure to preserve ordering
          console.warn('sync-engine: mutation replay failed, stopping flush');
          break;
        }
      }

      // After flush, refresh all data from server to get authoritative state
      if (await offline.hasPendingMutations() === false) {
        await this.refreshAllFromServer();
      }
    } finally {
      this.syncing = false;
    }
  }

  private async replayMutation(mutation: QueuedMutation): Promise<boolean> {
    if (!this.api) return false;

    try {
      switch (mutation.collection) {
        case 'tasks': {
          const t = this.api.tasks;
          if (mutation.operation === 'create') await t.create(mutation.payload);
          else if (mutation.operation === 'update') await t.update(mutation.recordId!, mutation.payload);
          else if (mutation.operation === 'delete') await t.delete(mutation.recordId!);
          break;
        }
        case 'items': {
          const i = this.api.items;
          if (mutation.operation === 'create') await i.create(mutation.payload);
          else if (mutation.operation === 'update') await i.update(mutation.recordId!, mutation.payload);
          else if (mutation.operation === 'delete') await i.delete(mutation.recordId!);
          break;
        }
        case 'notes': {
          const n = this.api.notes;
          if (mutation.operation === 'create') await n.create(mutation.payload);
          else if (mutation.operation === 'update') await n.update(mutation.recordId!, mutation.payload);
          else if (mutation.operation === 'delete') await n.delete(mutation.recordId!);
          break;
        }
        case 'labels': {
          const l = this.api.labels;
          if (mutation.operation === 'create') await l.create(mutation.payload);
          else if (mutation.operation === 'update') await l.update(mutation.recordId!, mutation.payload);
          else if (mutation.operation === 'delete') await l.delete(mutation.recordId!);
          break;
        }
        case 'shops': {
          const s = this.api.shops;
          if (mutation.operation === 'create') await s.create(mutation.payload);
          else if (mutation.operation === 'update') await s.update(mutation.recordId!, mutation.payload);
          else if (mutation.operation === 'delete') await s.delete(mutation.recordId!);
          break;
        }
        case 'sprints': {
          const sp = this.api.sprints;
          if (mutation.operation === 'create') await sp.create(mutation.payload);
          else if (mutation.operation === 'update') await sp.update(mutation.recordId!, mutation.payload);
          else if (mutation.operation === 'delete') await sp.delete(mutation.recordId!);
          break;
        }
        case 'calendar_events': {
          const c = this.api.calendar;
          if (mutation.operation === 'create') await c.create(mutation.payload);
          else if (mutation.operation === 'update') await c.update(mutation.recordId!, mutation.payload);
          else if (mutation.operation === 'delete') await c.delete(mutation.recordId!);
          break;
        }
        case 'rewards': {
          const r = this.api.rewards;
          if (mutation.operation === 'create') await r.create(mutation.payload);
          else if (mutation.operation === 'delete') await r.delete(mutation.recordId!);
          break;
        }
        case 'goals': {
          const g = this.api.goals;
          if (mutation.operation === 'create') await g.create(mutation.payload);
          else if (mutation.operation === 'update') await g.update(mutation.recordId!, mutation.payload);
          else if (mutation.operation === 'delete') await g.delete(mutation.recordId!);
          break;
        }
        case 'projects':
          // Projects use the api-client (pocketbase-client), not the REST api client.
          // Handled separately.
          break;
        case 'settings': {
          const st = this.api.settings;
          if (mutation.operation === 'update') await st.update(mutation.payload);
          break;
        }
      }
      return true;
    } catch (e) {
      console.error(`sync-engine: replay failed for ${mutation.collection}/${mutation.operation}`, e);
      return false;
    }
  }

  /** Refresh all collections from server after successful sync. */
  private async refreshAllFromServer(): Promise<void> {
    if (!this.api) return;
    try {
      const [tasks, items, notes, labels, shops, sprints, calendar, rewards, goals] =
        await Promise.all([
          this.api.tasks.list(),
          this.api.items.list(),
          this.api.notes.list(),
          this.api.labels.list(),
          this.api.shops.list(),
          this.api.sprints.list(),
          this.api.calendar.list(),
          this.api.rewards.list(),
          this.api.goals.list(),
        ]);

      await Promise.all([
        offline.syncSuccess('tasks', tasks),
        offline.syncSuccess('items', items),
        offline.syncSuccess('notes', notes),
        offline.syncSuccess('labels', labels),
        offline.syncSuccess('shops', shops),
        offline.syncSuccess('sprints', sprints),
        offline.syncSuccess('calendar_events', calendar),
        offline.syncSuccess('rewards', rewards),
        offline.syncSuccess('goals', goals),
      ]);
    } catch (e) {
      console.error('sync-engine: refreshAllFromServer failed', e);
    }
  }

  /**
   * Try a network operation; if it fails and we're offline, queue the mutation.
   * Returns { success, queued } where queued means the mutation was saved locally.
   */
  async tryOrQueue<T>(
    collection: EntityCollection,
    operation: 'create' | 'update' | 'delete',
    networkFn: () => Promise<T>,
    payload: any,
    recordId?: string,
  ): Promise<{ success: boolean; queued: boolean; result?: T }> {
    // If online, try network first
    if (this.status === 'online') {
      try {
        const result = await networkFn();
        // Update local cache with server response
        return { success: true, queued: false, result };
      } catch (e: any) {
        // Check if this is a network error (we're actually offline)
        if (this.isNetworkError(e)) {
          this.setOnline(false);
          // Fall through to queue
        } else {
          // Not a network error — propagate
          throw e;
        }
      }
    }

    // Queue the mutation
    await offline.enqueueMutation(collection, operation, payload, recordId);
    return { success: false, queued: true };
  }

  isNetworkError(error: any): boolean {
    // PocketBase / fetch network errors
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
}

// Singleton
export const syncEngine = new SyncEngine();
