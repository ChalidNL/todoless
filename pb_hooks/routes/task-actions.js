// pb_hooks/routes/task-actions.js
// REST API endpoints for specialized task operations (archive, convert, bulk actions)

// POST /api/todoless/tasks/:id/archive
// Archive a completed task
routerAdd(
  'POST',
  '/api/todoless/tasks/:id/archive',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('tasks', id)
    if (!record) {
      return c.json(404, { 'error': 'Task not found' })
    }

    if (record.get('user') !== authRecord.id) {
      return c.json(403, { 'error': 'Forbidden' })
    }

    const retentionDays = $request.queryParam('retention') || '30'
    const retentionMs = parseInt(retentionDays) * 24 * 60 * 60 * 1000
    const now = new Date()
    const deleteAfter = retentionMs > 0 ? new Date(now.getTime() + retentionMs) : null

    const data = new RecordUpsertAction($app, record)
      .set('archived', true)
      .set('archived_at', now.toISOString())

    if (deleteAfter) {
      data.set('delete_after', deleteAfter.toISOString())
    }

    data.submit()

    return c.json(200, record)
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/tasks/archive-done
// Archive all completed tasks
routerAdd(
  'POST',
  '/api/todoless/tasks/archive-done',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const userId = authRecord.id
    const familyId = authRecord.get('family_id')

    let filter = 'status = "done" && archived = false'
    if (familyId) {
      filter = 'status = "done" && archived = false && user.family_id = "' + familyId + '"'
    } else {
      filter = 'status = "done" && archived = false && user.id = "' + userId + '"'
    }

    const records = $app.dao().findRecordsByFilter('tasks', filter, '-created', 0, 0)
    const now = new Date()
    const archived = []

    for (let i = 0; i < records.length; i++) {
      const data = new RecordUpsertAction($app, records[i])
        .set('archived', true)
        .set('archived_at', now.toISOString())
      data.submit()
      archived.push(records[i].id)
    }

    return c.json(200, { 'archived': archived, 'count': archived.length })
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/tasks/:id/convert-to-item
// Convert a task to an item
routerAdd(
  'POST',
  '/api/todoless/tasks/:id/convert-to-item',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const task = $app.dao().findRecordById('tasks', id)
    if (!task) {
      return c.json(404, { 'error': 'Task not found' })
    }

    if (task.get('user') !== authRecord.id) {
      return c.json(403, { 'error': 'Forbidden' })
    }

    // Create item from task
    const itemCollection = $app.dao().findCollectionByNameOrId('items')
    const item = new Record(itemCollection)
    const itemData = new RecordUpsertAction($app, item)
      .set('user', authRecord.id)
      .set('title', task.get('title'))
      .set('completed', task.get('status') === 'done')
      .set('labels', task.get('labels') || [])

    itemData.submit()

    // Delete the task
    $app.dao().deleteRecord(task)

    return c.json(200, {
      'message': 'Task converted to item',
      'item_id': item.id,
    })
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/items/:id/convert-to-task
// Convert an item to a task
routerAdd(
  'POST',
  '/api/todoless/items/:id/convert-to-task',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const item = $app.dao().findRecordById('items', id)
    if (!item) {
      return c.json(404, { 'error': 'Item not found' })
    }

    if (item.get('user') !== authRecord.id) {
      return c.json(403, { 'error': 'Forbidden' })
    }

    // Create task from item
    const taskCollection = $app.dao().findCollectionByNameOrId('tasks')
    const task = new Record(taskCollection)
    const taskData = new RecordUpsertAction($app, task)
      .set('user', authRecord.id)
      .set('title', item.get('title'))
      .set('status', item.get('completed') ? 'done' : 'todo')
      .set('blocked', false)
      .set('labels', item.get('labels') || [])

    taskData.submit()

    // Delete the item
    $app.dao().deleteRecord(item)

    return c.json(200, {
      'message': 'Item converted to task',
      'task_id': task.id,
    })
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/tasks/uncheck-all-done
// Reset all done tasks to todo
routerAdd(
  'POST',
  '/api/todoless/tasks/uncheck-all-done',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const userId = authRecord.id
    const records = $app.dao().findRecordsByFilter('tasks', 'status = "done" && user.id = "' + userId + '"', '-created', 0, 0)
    const updated = []

    for (let i = 0; i < records.length; i++) {
      const data = new RecordUpsertAction($app, records[i])
        .set('status', 'todo')
        .set('completed_at', null)
      data.submit()
      updated.push(records[i].id)
    }

    return c.json(200, { 'updated': updated, 'count': updated.length })
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/items/uncheck-all-done
// Reset all completed items to incomplete
routerAdd(
  'POST',
  '/api/todoless/items/uncheck-all-done',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const userId = authRecord.id
    const records = $app.dao().findRecordsByFilter('items', 'completed = true && user.id = "' + userId + '"', '-created', 0, 0)
    const updated = []

    for (let i = 0; i < records.length; i++) {
      const data = new RecordUpsertAction($app, records[i])
        .set('completed', false)
      data.submit()
      updated.push(records[i].id)
    }

    return c.json(200, { 'updated': updated, 'count': updated.length })
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/tasks/:id/move
// Move a task to a different status
routerAdd(
  'POST',
  '/api/todoless/tasks/:id/move',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('tasks', id)
    if (!record) {
      return c.json(404, { 'error': 'Task not found' })
    }

    if (record.get('user') !== authRecord.id) {
      return c.json(403, { 'error': 'Forbidden' })
    }

    const body = $request.body()
    const status = body.get('status')
    if (!status || ['backlog', 'todo', 'done'].indexOf(status) === -1) {
      return c.json(400, { 'error': 'Invalid status. Must be: backlog, todo, or done' })
    }

    const data = new RecordUpsertAction($app, record)
      .loadRequest(body)
      .set('status', status)

    if (status === 'done') {
      data.set('completed_at', new Date().toISOString())
    } else {
      data.set('completed_at', null)
    }

    data.submit()

    return c.json(200, record)
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/sprints/new
// Create a new sprint based on current settings
routerAdd(
  'POST',
  '/api/todoless/sprints/new',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const userId = authRecord.id

    // Get user's settings for sprint config
    const settingsRows = $app.dao().findRecordsByFilter('app_settings', 'user = "' + userId + '"', '-created', 1, 0)
    let duration = '2weeks'
    let startDay = 1

    if (settingsRows.length > 0) {
      duration = settingsRows[0].get('sprint_duration') || '2weeks'
      startDay = settingsRows[0].get('sprint_start_day') || 1
    }

    let durationDays = 14
    if (duration === '1week') durationDays = 7
    if (duration === '3weeks') durationDays = 21
    if (duration === '1month') durationDays = 30

    const now = new Date()
    const currentDay = now.getDay()
    let daysUntilStart = startDay - currentDay
    if (daysUntilStart <= 0) daysUntilStart += 7

    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() + daysUntilStart)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000)

    // Count existing sprints for numbering
    const existingSprints = $app.dao().findRecordsByFilter('sprints', 'user.id = "' + userId + '"', '-created', 0, 0)

    const collection = $app.dao().findCollectionByNameOrId('sprints')
    const record = new Record(collection)

    // ISO week calculation (simplified)
    const jan1 = new Date(startDate.getFullYear(), 0, 1)
    const days = Math.floor((startDate - jan1) / (24 * 60 * 60 * 1000))
    const weekNumber = Math.ceil((days + jan1.getDay() + 1) / 7)

    const data = new RecordUpsertAction($app, record)
      .set('user', userId)
      .set('name', 'Sprint ' + (existingSprints.length + 1))
      .set('start_date', startDate.toISOString())
      .set('end_date', endDate.toISOString())
      .set('duration', duration)
      .set('week_number', weekNumber)
      .set('year', startDate.getFullYear())

    data.submit()

    return c.json(201, record)
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/sprints/:id/archive-tasks
// Archive all done tasks in a sprint
routerAdd(
  'POST',
  '/api/todoless/sprints/:id/archive-tasks',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const sprintId = c.pathParam('id')
    const sprint = $app.dao().findRecordById('sprints', sprintId)
    if (!sprint) {
      return c.json(404, { 'error': 'Sprint not found' })
    }

    const records = $app.dao().findRecordsByFilter('tasks', 'status = "done" && sprint_id = "' + sprintId + '" && archived = false', '-created', 0, 0)
    const now = new Date()
    const archived = []

    for (let i = 0; i < records.length; i++) {
      const data = new RecordUpsertAction($app, records[i])
        .set('archived', true)
        .set('archived_at', now.toISOString())
      data.submit()
      archived.push(records[i].id)
    }

    return c.json(200, { 'archived': archived, 'count': archived.length })
  },
  $apis.requireRecordAuth()
)
