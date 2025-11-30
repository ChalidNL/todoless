// v0.0.57: Completely rebuilt to match Labels sync architecture
import { SavedFilters, db } from '../db/dexieClient'
import type { SavedFilter, FilterQuery } from '../db/schema'
import { logger } from './logger'

const API = ''

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// v0.0.57: ServerSavedFilter now matches backend SavedFilterRow exactly
export interface ServerSavedFilter {
  id: number
  name: string
  normalized_name: string
  query_json: string  // JSON string
  menu_visible: 0 | 1
  shared: 0 | 1
  owner_id: number
  ranking: number
  created_at: string
  updated_at: string
  version: number
}

// v0.0.57: Convert server format to local format (like Labels)
function serverToLocal(sf: ServerSavedFilter): SavedFilter {
  let queryJson: FilterQuery
  try {
    queryJson = JSON.parse(sf.query_json)
  } catch {
    queryJson = {} // Fallback for invalid JSON
  }

  return {
    id: sf.id,
    name: sf.name,
    normalizedName: sf.normalized_name,
    queryJson,
    menuVisible: sf.menu_visible === 1,
    shared: sf.shared === 1,
    ownerId: sf.owner_id,
    ranking: sf.ranking,
    createdAt: sf.created_at,
    updatedAt: sf.updated_at,
    version: sf.version,
  }
}

// v0.0.57: Convert local format to server POST body format
// Backend expects camelCase in request body, returns snake_case in response
function localToServer(lf: SavedFilter): any {
  return {
    name: lf.name,
    normalizedName: lf.normalizedName,
    queryJson: lf.queryJson, // Backend expects object, not stringified
    menuVisible: lf.menuVisible,
    shared: lf.shared,
    ownerId: lf.ownerId,
    ranking: lf.ranking,
  }
}

/**
 * v0.0.57: Sync saved filters from server to local IndexedDB (like Labels sync)
 * Server-first architecture - server is source of truth
 */
export async function syncFiltersFromServer() {
  try {
    const { items: serverFilters } = await api('/api/saved-filters')
    const localFilters = await SavedFilters.list()

    // Map server filters by ID for quick lookup
    const serverMap = new Map<number, ServerSavedFilter>()
    for (const sf of serverFilters) {
      serverMap.set(sf.id, sf)
    }

    // Map local filters by ID
    const localMap = new Map<number, SavedFilter>()
    for (const lf of localFilters) {
      localMap.set(lf.id, lf)
    }

    // 1. Add/update filters from server (upsert with version check like Labels)
    for (const sf of serverFilters) {
      const local = localMap.get(sf.id)
      const converted = serverToLocal(sf)

      if (!local) {
        // New filter from server, add it
        await db.savedFilters.put(converted)
        logger.info('sync:filter:added_from_server', { id: sf.id, name: sf.name })
      } else {
        // Filter exists locally, check version (server-first: server wins if newer)
        if (sf.version > local.version) {
          await db.savedFilters.put(converted)
          logger.info('sync:filter:updated_from_server', { id: sf.id, name: sf.name, oldVersion: local.version, newVersion: sf.version })
        } else {
          logger.debug('sync:filter:local_newer', { id: sf.id, localVersion: local.version, serverVersion: sf.version })
        }
      }
    }

    // 2. Delete local filters that don't exist on server
    for (const lf of localFilters) {
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
 * v0.0.57: Push a new filter to server (like Labels.add)
 */
export async function pushFilterToServer(filter: SavedFilter) {
  try {
    const serverData = localToServer(filter)

    const response = await api('/api/saved-filters', {
      method: 'POST',
      body: JSON.stringify(serverData),
    })

    // Update local filter with server-assigned ID
    const serverFilter: ServerSavedFilter = response.item
    const converted = serverToLocal(serverFilter)
    await db.savedFilters.put(converted)

    logger.info('sync:filter:pushed_to_server', { localId: filter.id, serverId: serverFilter.id, name: filter.name })

    return serverFilter.id
  } catch (err) {
    logger.error('sync:filter:push_failed', { id: filter.id, error: String(err) })
    throw err
  }
}

/**
 * v0.0.57: Delete a filter from server (like Labels.remove)
 */
export async function deleteFilterFromServer(filterId: number) {
  try {
    await api(`/api/saved-filters/${filterId}`, {
      method: 'DELETE',
    })
    logger.info('sync:filter:deleted_from_server', { id: filterId })
  } catch (err) {
    logger.error('sync:filter:delete_failed', { id: filterId, error: String(err) })
    throw err
  }
}

/**
 * v0.0.57: Update a filter on server (like Labels.update)
 */
export async function updateFilterOnServer(filterId: number, updates: Partial<SavedFilter>) {
  try {
    // Convert updates to server format (camelCase for request body)
    const serverUpdates: any = {}
    if (updates.name !== undefined) {
      serverUpdates.name = updates.name
      // Backend will compute normalized_name from name
    }
    if (updates.queryJson !== undefined) {
      serverUpdates.queryJson = updates.queryJson
    }
    if (updates.menuVisible !== undefined) {
      serverUpdates.menuVisible = updates.menuVisible
    }
    if (updates.shared !== undefined) {
      serverUpdates.shared = updates.shared
    }
    if (updates.ranking !== undefined) {
      serverUpdates.ranking = updates.ranking
    }

    const response = await api(`/api/saved-filters/${filterId}`, {
      method: 'PATCH',
      body: JSON.stringify(serverUpdates),
    })

    // Update local with server response
    const serverFilter: ServerSavedFilter = response.item
    const converted = serverToLocal(serverFilter)
    await db.savedFilters.put(converted)

    logger.info('sync:filter:updated_on_server', { id: filterId, name: converted.name })
  } catch (err) {
    logger.error('sync:filter:update_failed', { id: filterId, error: String(err) })
    throw err
  }
}
