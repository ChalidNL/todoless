// pb_hooks/routes/tasks.js
// REST API endpoints for tasks collection

routerAdd(
  'GET',
  '/api/v1/tasks',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const userId = authRecord.id
    const familyId = authRecord.get('family_id')
    const filterParams = { userId: userId, familyId: familyId }

    let filter = 'user = {:userId}'
    if (familyId) {
      const labelAccess = '(label = "" || (label.family:each = {:familyId} && (label.visibility:each = "family" || (label:length = 1 && ((label.visibility = "private" && label.owner = {:userId}) || (label.visibility = "shared" && (label.owner = {:userId} || label.shared_with ?= {:userId})))))))'
      filter = '(' + filter + ' || (is_private = false && user.family_id = {:familyId} && ' + labelAccess + '))'
    }

    const requestedSort = $request.queryParam('sort') || '-created'
    const allowedSorts = ['created', '-created', 'due_date', '-due_date', 'title', '-title', 'priority', '-priority', 'status', '-status']
    const sort = allowedSorts.indexOf(requestedSort) !== -1 ? requestedSort : '-created'
    const status = $request.queryParam('status')
    if (status) {
      filter += ' && status = {:status}'
      filterParams.status = status
    }

    const result = $app.dao().findRecordsByFilter('tasks', filter, sort, 0, 0, filterParams)
    return c.json(200, result)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'GET',
  '/api/v1/tasks/:id',
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

    const canViewTask = (task) => {
      if (String(task.get('user') || '') === authRecord.id) return true
      if (task.get('is_private')) return false

      const familyId = String(authRecord.get('family_id') || '')
      if (!familyId) return false
      try {
        const taskOwner = $app.dao().findRecordById('users', task.get('user'))
        if (!taskOwner || String(taskOwner.get('family_id') || '') !== familyId) return false
      } catch (_) {
        return false
      }

      const rawLabels = task.get('label') || []
      const labelIds = Array.isArray(rawLabels) ? rawLabels : (rawLabels ? [rawLabels] : [])
      if (labelIds.length === 0) return true

      for (let i = 0; i < labelIds.length; i++) {
        let label
        try {
          label = $app.dao().findRecordById('labels', labelIds[i])
        } catch (_) {
          return false
        }
        const visibility = String(label.get('visibility') || '')
        const labelFamily = String(label.get('family') || '')
        if (labelFamily !== familyId) return false
        if (visibility === 'family') continue
        if (labelIds.length !== 1) return false
        if (String(label.get('owner') || label.get('user') || '') === authRecord.id) continue
        const sharedWith = label.get('shared_with') || []
        if (visibility === 'shared' && Array.isArray(sharedWith) && sharedWith.indexOf(authRecord.id) !== -1) continue
        return false
      }
      return true
    }
    if (!canViewTask(record)) {
      return c.json(404, { 'error': 'Task not found' })
    }

    return c.json(200, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'POST',
  '/api/v1/tasks',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const body = $request.body()
    const collection = $app.dao().findCollectionByNameOrId('tasks')
    const record = new Record(collection)
    const rawLabels = body.has('label') ? body.get('label') : body.get('labels')
    const canonicalLabels = Array.isArray(rawLabels) ? rawLabels : (rawLabels ? [rawLabels] : [])

    const data = new RecordUpsertAction($app, record)
      .loadRequest(body)
      .set('user', authRecord.id)
      .set('title', body.get('title') || '')
      .set('status', body.get('status') || 'todo')
      .set('blocked', body.get('blocked') || false)
      .set('focus', body.get('focus') || false)
      .set('priority', body.get('priority') || '')
      .set('horizon', body.get('horizon') || '')
      .set('due_date', body.get('due_date') || '')
      .set('repeat_interval', body.get('repeat_interval') || '')
      .set('labels', canonicalLabels)
      .set('label', canonicalLabels)
      .set('is_private', body.get('is_private') || false)
      .set('archived', body.get('archived') || false)
      .set('flag', body.get('flag') || false)
      .set('linked_to', body.get('linked_to') || '')
      .set('linked_type', body.get('linked_type') || '')
      .set('linked_item_ids', body.get('linked_item_ids') || [])
      .set('linked_note_ids', body.get('linked_note_ids') || [])

    if (body.get('blocked_comment')) data.set('blocked_comment', body.get('blocked_comment'))
    if (body.get('assigned_to')) data.set('assigned_to', body.get('assigned_to'))
    if (body.get('sprint_id')) data.set('sprint_id', body.get('sprint_id'))
    if (body.get('completed_at')) data.set('completed_at', body.get('completed_at'))
    if (body.get('completed_by')) data.set('completed_by', body.get('completed_by'))

    data.submit()

    return c.json(201, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'PATCH',
  '/api/v1/tasks/:id',
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
    const data = new RecordUpsertAction($app, record).loadRequest(body)

    if (body.has('labels') || body.has('label')) {
      const rawLabels = body.has('label') ? body.get('label') : body.get('labels')
      const canonicalLabels = Array.isArray(rawLabels) ? rawLabels : (rawLabels ? [rawLabels] : [])
      data.set('labels', canonicalLabels)
      data.set('label', canonicalLabels)
    }

    if (body.has('title')) data.set('title', body.get('title'))
    if (body.has('status')) data.set('status', body.get('status'))
    if (body.has('blocked')) data.set('blocked', body.get('blocked'))
    if (body.has('blocked_comment')) data.set('blocked_comment', body.get('blocked_comment'))
    if (body.has('focus')) data.set('focus', body.get('focus'))
    if (body.has('priority')) data.set('priority', body.get('priority'))
    if (body.has('horizon')) data.set('horizon', body.get('horizon'))
    if (body.has('assigned_to')) data.set('assigned_to', body.get('assigned_to'))
    if (body.has('sprint_id')) data.set('sprint_id', body.get('sprint_id'))
    if (body.has('due_date')) data.set('due_date', body.get('due_date'))
    if (body.has('repeat_interval')) data.set('repeat_interval', body.get('repeat_interval'))
    if (body.has('completed_at')) data.set('completed_at', body.get('completed_at'))
    if (body.has('completed_by')) data.set('completed_by', body.get('completed_by'))

    if (body.has('is_private')) data.set('is_private', body.get('is_private'))
    if (body.has('archived')) data.set('archived', body.get('archived'))
    if (body.has('flag')) data.set('flag', body.get('flag'))
    if (body.has('linked_to')) data.set('linked_to', body.get('linked_to'))
    if (body.has('linked_type')) data.set('linked_type', body.get('linked_type'))
    if (body.has('linked_item_ids')) data.set('linked_item_ids', body.get('linked_item_ids'))
    if (body.has('linked_note_ids')) data.set('linked_note_ids', body.get('linked_note_ids'))

    data.submit()

    return c.json(200, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'DELETE',
  '/api/v1/tasks/:id',
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

    $app.dao().deleteRecord(record)
    return c.json(200, { 'deleted': true })
  },
  $apis.requireRecordAuth()
)
