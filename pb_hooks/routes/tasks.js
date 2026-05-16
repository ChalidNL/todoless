// pb_hooks/routes/tasks.js
// REST API endpoints for tasks collection

routerAdd(
  'GET',
  '/api/todoless/tasks',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const userId = authRecord.id
    const familyId = authRecord.get('family_id')

    let filter = ''
    if (familyId) {
      filter = 'user.family_id = "' + familyId + '"'
    } else {
      filter = 'user.id = "' + userId + '"'
    }

    const sort = $request.queryParam('sort') || '-created'
    const status = $request.queryParam('status')
    if (status) {
      filter += ' && status = "' + status + '"'
    }

    const result = $app.dao().findRecordsByFilter('tasks', filter, sort, 0, 0)
    return c.json(200, result)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'GET',
  '/api/todoless/tasks/:id',
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

    return c.json(200, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'POST',
  '/api/todoless/tasks',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const body = $request.body()
    const collection = $app.dao().findCollectionByNameOrId('tasks')
    const record = new Record(collection)

    const data = new RecordUpsertAction($app, record)
      .loadRequest(body)
      .set('user', authRecord.id)
      .set('title', body.get('title') || '')
      .set('status', body.get('status') || 'todo')
      .set('blocked', body.get('blocked') || false)
      .set('priority', body.get('priority') || '')
      .set('horizon', body.get('horizon') || '')
      .set('due_date', body.get('due_date') || '')
      .set('repeat_interval', body.get('repeat_interval') || '')
      .set('labels', body.get('labels') || [])
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

    data.submit()

    return c.json(201, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'PATCH',
  '/api/todoless/tasks/:id',
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

    if (body.has('title')) data.set('title', body.get('title'))
    if (body.has('status')) data.set('status', body.get('status'))
    if (body.has('blocked')) data.set('blocked', body.get('blocked'))
    if (body.has('blocked_comment')) data.set('blocked_comment', body.get('blocked_comment'))
    if (body.has('priority')) data.set('priority', body.get('priority'))
    if (body.has('horizon')) data.set('horizon', body.get('horizon'))
    if (body.has('assigned_to')) data.set('assigned_to', body.get('assigned_to'))
    if (body.has('sprint_id')) data.set('sprint_id', body.get('sprint_id'))
    if (body.has('due_date')) data.set('due_date', body.get('due_date'))
    if (body.has('repeat_interval')) data.set('repeat_interval', body.get('repeat_interval'))
    if (body.has('completed_at')) data.set('completed_at', body.get('completed_at'))
    if (body.has('labels')) data.set('labels', body.get('labels'))
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
  '/api/todoless/tasks/:id',
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
