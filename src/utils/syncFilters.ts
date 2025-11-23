import { SavedFilters, db } from '../db/dexieClient'
import type { SavedFilter } from '../db/schema'
import { logger } from './logger'

const API = ''

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export interface ServerSavedFilter {
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

function serverToLocal(sf: ServerSavedFilter): SavedFilter {
  return {
    id: sf.id,
    name: sf.name,
    slug: sf.slug,
    icon: sf.icon || undefined,
    labelFilterIds: sf.label_filter_ids ? JSON.parse(sf.label_filter_ids) : undefined,
    attributeFilters: sf.attribute_filters ? JSON.parse(sf.attribute_filters) : undefined,
    statusFilter: sf.status_filter || undefined,
    sortBy: sf.sort_by || undefined,
    viewMode: (sf.view_mode as any) || undefined,
    userId: String(sf.user_id),
    showInSidebar: sf.show_in_sidebar === 1,
    isSystem: sf.is_system === 1,
    isDefault: sf.is_default === 1,
    parentId: sf.parent_id || undefined,
    order: sf.filter_order || undefined,
  }
}

function localToServer(lf: SavedFilter): Partial<ServerSavedFilter> {
  return {
    id: lf.id,
    name: lf.name,
    slug: lf.slug,
    icon: lf.icon || null,
    label_filter_ids: lf.labelFilterIds ? JSON.stringify(lf.labelFilterIds) : null,
    attribute_filters: lf.attributeFilters ? JSON.stringify(lf.attributeFilters) : null,
    status_filter: lf.statusFilter || null,
    sort_by: lf.sortBy || null,
    view_mode: lf.viewMode || null,
    user_id: Number(lf.userId),
    show_in_sidebar: lf.showInSidebar !== false ? 1 : 0,
    is_system: lf.isSystem ? 1 : 0,
    is_default: lf.isDefault ? 1 : 0,
    parent_id: lf.parentId || null,
    order: lf.order || null,
  }
}

/**
 * Sync saved filters from server to local IndexedDB
 */
export async function syncFiltersFromServer() {
  try {
    const { items: serverFilters } = await api('/api/saved-filters')
    const localFilters = await SavedFilters.list()

    // Map server filters by ID for quick lookup
    const serverMap = new Map<string, ServerSavedFilter>()
    for (const sf of serverFilters) {
      serverMap.set(sf.id, sf)
    }

    // Map local filters by ID
    const localMap = new Map<string, SavedFilter>()
    for (const lf of localFilters) {
      // Skip system filters like @me, all, backlog - they're client-generated
      if (lf.isSystem) continue
      localMap.set(lf.id, lf)
    }

    // 1. Add/update filters from server
    for (const sf of serverFilters) {
      const local = localMap.get(sf.id)
      if (!local) {
        // New filter from server, add it
        const converted = serverToLocal(sf)
        await db.savedFilters.put(converted)
        logger.info('sync:filter:added_from_server', { id: sf.id, name: sf.name })
      } else {
        // Filter exists locally, check if server is newer (we don't have version tracking on client yet)
        // For now, server wins (since version field is tracked server-side)
        const converted = serverToLocal(sf)
        await db.savedFilters.put(converted)
        logger.info('sync:filter:updated_from_server', { id: sf.id, name: sf.name })
      }
    }

    // 2. Delete local filters that don't exist on server (except system filters)
    for (const lf of localFilters) {
      if (lf.isSystem) continue // Skip system filters
      if (!serverMap.has(lf.id)) {
        await SavedFilters.remove(lf.id)
        logger.info('sync:filter:deleted_not_on_server', { id: lf.id, name: lf.name })
      }
    }

    logger.info('sync:filters:complete', { serverCount: serverFilters.length, localCount: localFilters.length })

    // Dispatch event to refresh UI
    window.dispatchEvent(new Event('saved-filters:refresh'))
  } catch (err) {
    logger.error('sync:filters:failed', { error: String(err) })
  }
}

/**
 * Push local saved filters to server
 * Called when user creates/updates a filter
 */
export async function pushFilterToServer(filter: SavedFilter) {
  try {
    // Skip system filters
    if (filter.isSystem) return

    const serverData = localToServer(filter)
    const payload = {
      ...serverData,
      client_id: filter.id, // Use filter ID as client_id for deduplication
    }

    // Try to create/update on server
    await api('/api/saved-filters', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    logger.info('sync:filter:pushed_to_server', { id: filter.id, name: filter.name })
  } catch (err) {
    logger.error('sync:filter:push_failed', { id: filter.id, error: String(err) })
  }
}

/**
 * Delete a filter from server
 */
export async function deleteFilterFromServer(filterId: string) {
  try {
    await api(`/api/saved-filters/${filterId}`, {
      method: 'DELETE',
    })
    logger.info('sync:filter:deleted_from_server', { id: filterId })
  } catch (err) {
    logger.error('sync:filter:delete_failed', { id: filterId, error: String(err) })
  }
}

/**
 * Update a filter on server
 */
export async function updateFilterOnServer(filter: SavedFilter) {
  try {
    // Skip system filters
    if (filter.isSystem) return

    const serverData = localToServer(filter)

    await api(`/api/saved-filters/${filter.id}`, {
      method: 'PATCH',
      body: JSON.stringify(serverData),
    })

    logger.info('sync:filter:updated_on_server', { id: filter.id, name: filter.name })
  } catch (err) {
    logger.error('sync:filter:update_failed', { id: filter.id, error: String(err) })
  }
}
