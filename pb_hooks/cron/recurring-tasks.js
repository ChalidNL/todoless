// pb_hooks/cron/recurring-tasks.js
// Cron job: process recurring tasks that were marked as done
// Runs every hour to check for completed recurring tasks and create their next occurrence

cronAdd('recurring-tasks', '0 * * * *', () => {
  const now = new Date()
  const dao = $app.dao()

  // Find all tasks that are:
  // - status = 'done'
  // - have a repeat_interval set
  // - not already archived
  const recurringDoneTasks = dao.findRecordsByFilter(
    'tasks',
    'status = "done" && repeat_interval != "" && archived = false',
    '-created',
    0,
    0
  )

  const collection = dao.findCollectionByNameOrId('tasks')

  for (let i = 0; i < recurringDoneTasks.length; i++) {
    const task = recurringDoneTasks[i]
    const repeatInterval = task.get('repeat_interval')
    const userId = task.get('user')

    if (!repeatInterval || !userId) continue

    // Calculate the next due date based on the original due_date or completed_at
    let baseDate
    const dueDate = task.get('due_date')
    const completedAt = task.get('completed_at')

    if (dueDate) {
      baseDate = new Date(dueDate)
    } else if (completedAt) {
      baseDate = new Date(completedAt)
    } else {
      baseDate = now
    }

    // Calculate next occurrence
    const nextDate = new Date(baseDate)
    switch (repeatInterval) {
      case 'week':
        nextDate.setDate(nextDate.getDate() + 7)
        break
      case 'month':
        nextDate.setMonth(nextDate.getMonth() + 1)
        break
      case 'year':
        nextDate.setFullYear(nextDate.getFullYear() + 1)
        break
      default:
        continue
    }

    // Archive the completed task
    const archiveAction = new RecordUpsertAction($app, task)
      .set('archived', true)
      .set('archived_at', now.toISOString())
    archiveAction.submit()

    // Create the next occurrence
    const newRecord = new Record(collection)
    const labels = task.get('labels') || []
    const newData = new RecordUpsertAction($app, newRecord)
      .set('user', userId)
      .set('title', task.get('title'))
      .set('status', 'todo')
      .set('blocked', false)
      .set('priority', task.get('priority') || '')
      .set('horizon', task.get('horizon') || '')
      .set('due_date', nextDate.toISOString())
      .set('repeat_interval', repeatInterval)
      .set('labels', labels)
      .set('is_private', task.get('is_private') || false)
      .set('archived', false)

    if (task.get('assigned_to')) {
      newData.set('assigned_to', task.get('assigned_to'))
    }
    if (task.get('blocked_comment')) {
      newData.set('blocked_comment', task.get('blocked_comment'))
    }

    newData.submit()
  }
})
