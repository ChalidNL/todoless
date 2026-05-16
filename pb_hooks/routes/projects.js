// pb_hooks/routes/projects.js
// REST API endpoints for projects collection

routerAdd(
  'GET',
  '/api/todoless/projects',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const userId = authRecord.id
    const filter = 'user.id = "' + userId + '"'
    const sort = $request.queryParam('sort') || '-created'

    const status = $request.queryParam('status')
    if (status) {
      filter += ' && status = "' + status + '"'
    }

    const result = $app.dao().findRecordsByFilter('projects', filter, sort, 0, 0)
    return c.json(200, result)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'GET',
  '/api/todoless/projects/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('projects', id)
    if (!record) {
      return c.json(404, { 'error': 'Project not found' })
    }

    return c.json(200, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'POST',
  '/api/todoless/projects',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const body = $request.body()
    const collection = $app.dao().findCollectionByNameOrId('projects')
    const record = new Record(collection)

    const data = new RecordUpsertAction($app, record)
      .loadRequest(body)
      .set('user', authRecord.id)
      .set('title', body.get('title') || '')
      .set('color', body.get('color') || '#6366f1')
      .set('status', body.get('status') || 'active')
      .set('task_ids', body.get('task_ids') || [])

    if (body.has('description')) data.set('description', body.get('description'))
    if (body.has('due_date')) data.set('due_date', body.get('due_date'))

    data.submit()

    return c.json(201, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'PATCH',
  '/api/todoless/projects/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('projects', id)
    if (!record) {
      return c.json(404, { 'error': 'Project not found' })
    }

    if (record.get('user') !== authRecord.id) {
      return c.json(403, { 'error': 'Forbidden' })
    }

    const body = $request.body()
    const data = new RecordUpsertAction($app, record).loadRequest(body)

    if (body.has('title')) data.set('title', body.get('title'))
    if (body.has('description')) data.set('description', body.get('description'))
    if (body.has('color')) data.set('color', body.get('color'))
    if (body.has('status')) data.set('status', body.get('status'))
    if (body.has('task_ids')) data.set('task_ids', body.get('task_ids'))
    if (body.has('due_date')) data.set('due_date', body.get('due_date'))

    data.submit()

    return c.json(200, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'DELETE',
  '/api/todoless/projects/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('projects', id)
    if (!record) {
      return c.json(404, { 'error': 'Project not found' })
    }

    if (record.get('user') !== authRecord.id) {
      return c.json(403, { 'error': 'Forbidden' })
    }

    $app.dao().deleteRecord(record)
    return c.json(200, { 'deleted': true })
  },
  $apis.requireRecordAuth()
)
