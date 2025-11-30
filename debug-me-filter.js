// Debug script om de @me filter te inspecteren
// Voer dit uit in de browser console

import { db } from './src/db/dexieClient'

async function debugMeFilter() {
  const filters = await db.savedFilters.toArray()
  const meFilter = filters.find(f => f.normalizedName === '@me')

  console.log('=== @me Filter Debug ===')
  console.log('Filter found:', meFilter)
  if (meFilter) {
    console.log('Query JSON:', meFilter.queryJson)
    console.log('Selected Assignee IDs:', meFilter.queryJson?.selectedAssigneeIds)
  }

  // Check current user
  const { user } = await import('./src/store/auth')
  console.log('Current user ID:', user?.id)
}

debugMeFilter()
