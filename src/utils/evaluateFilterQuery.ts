// v0.0.57: Query engine for evaluating SavedFilter queryJson
// This is the core logic that makes saved filters work

import type { Todo } from '../db/schema'
import type { FilterQuery } from '../db/schema'
import { parseDueToDate } from './date'

/**
 * Evaluate a FilterQuery against a list of todos
 * Returns filtered todos that match the query
 *
 * This uses the EXACT same logic as useFilters.ts makeFilter()
 *
 * @param currentUserId - Optional current user ID for dynamic @me filter evaluation
 */
export function evaluateFilterQuery(todos: Todo[], query: FilterQuery, currentUserId?: string): Todo[] {
  let next = todos

  // v0.0.57: Support EMPTY parameter for labels
  if (query.selectedLabelIds && query.selectedLabelIds.length > 0) {
    const hasEmpty = query.selectedLabelIds.includes('EMPTY')
    const regularIds = query.selectedLabelIds.filter(id => id !== 'EMPTY')

    if (hasEmpty && regularIds.length === 0) {
      // Only EMPTY selected: show tasks with no labels
      next = next.filter((t) => !t.labelIds || t.labelIds.length === 0)
    } else if (hasEmpty && regularIds.length > 0) {
      // EMPTY + other labels: show tasks with ALL selected labels OR no labels
      next = next.filter((t) => {
        const hasNoLabels = !t.labelIds || t.labelIds.length === 0
        const hasAllLabels = regularIds.every((id) => t.labelIds.includes(id))
        return hasNoLabels || hasAllLabels
      })
    } else {
      // Only regular labels: show tasks with ALL selected labels
      next = next.filter((t) => regularIds.every((id) => t.labelIds.includes(id)))
    }
  }

  if (query.selectedWorkflowIds && query.selectedWorkflowIds.length > 0) {
    next = next.filter((t) => t.workflowId && query.selectedWorkflowIds!.includes(t.workflowId))
  }

  // v0.0.57: Support EMPTY parameter for assignees
  if (query.selectedAssigneeIds && query.selectedAssigneeIds.length > 0) {
    const hasEmpty = query.selectedAssigneeIds.includes('EMPTY')
    // HOTFIX: Support @me dynamic marker - replace with currentUserId
    let regularIds = query.selectedAssigneeIds.filter(id => id !== 'EMPTY')
    if (currentUserId && regularIds.includes('@me')) {
      regularIds = regularIds.map(id => id === '@me' ? currentUserId : id)
    }

    if (hasEmpty && regularIds.length === 0) {
      // Only EMPTY selected: show tasks with no assignees
      next = next.filter((t) => !t.assigneeIds || t.assigneeIds.length === 0)
    } else if (hasEmpty && regularIds.length > 0) {
      // EMPTY + other assignees: show tasks with ANY selected assignee OR no assignees
      next = next.filter((t) => {
        const hasNoAssignees = !t.assigneeIds || t.assigneeIds.length === 0
        const hasAnyAssignee = (t.assigneeIds || []).some((id) => regularIds.includes(id))
        return hasNoAssignees || hasAnyAssignee
      })
    } else {
      // Only regular assignees: show tasks with ANY selected assignee
      next = next.filter((t) => {
        const ids = t.assigneeIds || []
        return ids.some((id) => regularIds.includes(id))
      })
    }
  }

  if (query.blockedOnly) {
    next = next.filter((t) => t.blocked)
  }

  if (query.dueStart || query.dueEnd) {
    const startD = query.dueStart ? parseDueToDate(query.dueStart) : null
    const endD = query.dueEnd ? parseDueToDate(query.dueEnd) : null
    next = next.filter((t) => {
      const raw = (t as any).dueDate || (t as any).attributes?.dueDate
      const d = raw ? parseDueToDate(raw) : null
      if (!d) return false
      if (startD && d < startD) return false
      if (endD) {
        const endCopy = new Date(endD)
        endCopy.setHours(23, 59, 59, 999)
        if (d > endCopy) return false
      }
      return true
    })
  }

  // Filter by completion status if specified
  if (query.showCompleted === false) {
    next = next.filter((t) => !t.completed)
  }

  // Filter by archived status if specified
  if (query.showArchived === false) {
    next = next.filter((t) => !(t as any).archived)
  }

  return next
}
