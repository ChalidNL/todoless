// pb_hooks/cron/recurring-tasks.js
// Cron job: process recurring tasks that were marked as done
// Runs every hour to check for completed recurring tasks and create their next occurrence

function addMonthsPreservingDay(baseDate, monthsToAdd) {
  const year = baseDate.getUTCFullYear()
  const monthIndex = baseDate.getUTCMonth() + monthsToAdd
  const targetYear = year + Math.floor(monthIndex / 12)
  const normalizedMonth = ((monthIndex % 12) + 12) % 12
  const daysInMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(baseDate.getUTCDate(), daysInMonth)

  return new Date(Date.UTC(
    targetYear,
    normalizedMonth,
    targetDay,
    baseDate.getUTCHours(),
    baseDate.getUTCMinutes(),
    baseDate.getUTCSeconds(),
    baseDate.getUTCMilliseconds()
  ))
}

function getMonthlyWeekdayParts(baseDate) {
  const dayOfMonth = baseDate.getUTCDate()
  const occurrenceIndex = Math.floor((dayOfMonth - 1) / 7)
  const weekdayIndex = baseDate.getUTCDay()
  const nextSameWeekday = new Date(baseDate.getTime())
  nextSameWeekday.setUTCDate(dayOfMonth + 7)

  return {
    weekdayIndex,
    occurrenceIndex,
    isLastOccurrence: nextSameWeekday.getUTCMonth() !== baseDate.getUTCMonth(),
  }
}

function getNthWeekdayInFollowingMonth(baseDate) {
  const targetMonthSeed = addMonthsPreservingDay(baseDate, 1)
  const targetYear = targetMonthSeed.getUTCFullYear()
  const targetMonth = targetMonthSeed.getUTCMonth()
  const { weekdayIndex, occurrenceIndex, isLastOccurrence } = getMonthlyWeekdayParts(baseDate)

  const firstDayOfMonth = new Date(Date.UTC(
    targetYear,
    targetMonth,
    1,
    baseDate.getUTCHours(),
    baseDate.getUTCMinutes(),
    baseDate.getUTCSeconds(),
    baseDate.getUTCMilliseconds()
  ))

  const firstWeekdayOffset = (weekdayIndex - firstDayOfMonth.getUTCDay() + 7) % 7
  const firstWeekdayDate = 1 + firstWeekdayOffset
  let targetDay = firstWeekdayDate + (occurrenceIndex * 7)

  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()

  if (isLastOccurrence || targetDay > daysInMonth) {
    const lastDayOfMonth = new Date(Date.UTC(
      targetYear,
      targetMonth,
      daysInMonth,
      baseDate.getUTCHours(),
      baseDate.getUTCMinutes(),
      baseDate.getUTCSeconds(),
      baseDate.getUTCMilliseconds()
    ))
    const reverseOffset = (lastDayOfMonth.getUTCDay() - weekdayIndex + 7) % 7
    targetDay = daysInMonth - reverseOffset
  }

  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    targetDay,
    baseDate.getUTCHours(),
    baseDate.getUTCMinutes(),
    baseDate.getUTCSeconds(),
    baseDate.getUTCMilliseconds()
  ))
}

function getNextRecurringDate(repeatInterval, baseDate) {
  const nextDate = new Date(baseDate.getTime())

  switch (repeatInterval) {
    case 'day':
      nextDate.setUTCDate(nextDate.getUTCDate() + 1)
      return nextDate
    case 'week':
      nextDate.setUTCDate(nextDate.getUTCDate() + 7)
      return nextDate
    case 'month':
      return addMonthsPreservingDay(baseDate, 1)
    case 'month_weekday':
      return getNthWeekdayInFollowingMonth(baseDate)
    case 'year':
      nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1)
      return nextDate
    default:
      return null
  }
}

cronAdd('recurring-tasks', '0 * * * *', () => {
  const now = new Date()
  const dao = $app.dao()

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

    const nextDate = getNextRecurringDate(repeatInterval, baseDate)
    if (!nextDate) continue

    const archiveAction = new RecordUpsertAction($app, task)
      .set('archived', true)
      .set('archived_at', now.toISOString())
    archiveAction.submit()

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
