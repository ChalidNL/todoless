// pb_hooks/routes/goals.js
// REST API endpoints for goals collection

routerAdd(
  'GET',
  '/api/todoless/goals',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const userId = authRecord.id
    const filter = 'user.id = "' + userId + '"'
    const sort = $request.queryParam('sort') || '-created'

    const result = $app.dao().findRecordsByFilter('goals', filter, sort, 0, 0)
    return c.json(200, result)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'GET',
  '/api/todoless/goals/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('goals', id)
    if (!record) {
      return c.json(404, { 'error': 'Goal not found' })
    }

    return c.json(200, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'POST',
  '/api/todoless/goals',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const body = $request.body()
    const collection = $app.dao().findCollectionByNameOrId('goals')
    const record = new Record(collection)

    const data = new RecordUpsertAction($app, record)
      .loadRequest(body)
      .set('user', authRecord.id)
      .set('title', body.get('title') || '')
      .set('points_required', body.get('points_required') || 0)
      .set('points_current', body.get('points_current') || 0)
      .set('completed', body.get('completed') || false)

    if (body.has('description')) data.set('description', body.get('description'))
    if (body.has('target_user')) data.set('target_user', body.get('target_user'))
    if (body.has('completed_at')) data.set('completed_at', body.get('completed_at'))

    data.submit()

    return c.json(201, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'PATCH',
  '/api/todoless/goals/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('goals', id)
    if (!record) {
      return c.json(404, { 'error': 'Goal not found' })
    }

    if (record.get('user') !== authRecord.id) {
      return c.json(403, { 'error': 'Forbidden' })
    }

    const body = $request.body()
    const data = new RecordUpsertAction($app, record).loadRequest(body)

    if (body.has('title')) data.set('title', body.get('title'))
    if (body.has('description')) data.set('description', body.get('description'))
    if (body.has('points_required')) data.set('points_required', body.get('points_required'))
    if (body.has('points_current')) data.set('points_current', body.get('points_current'))
    if (body.has('target_user')) data.set('target_user', body.get('target_user'))
    if (body.has('completed')) data.set('completed', body.get('completed'))
    if (body.has('completed_at')) data.set('completed_at', body.get('completed_at'))

    data.submit()

    return c.json(200, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'DELETE',
  '/api/todoless/goals/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('goals', id)
    if (!record) {
      return c.json(404, { 'error': 'Goal not found' })
    }

    if (record.get('user') !== authRecord.id) {
      return c.json(403, { 'error': 'Forbidden' })
    }

    $app.dao().deleteRecord(record)
    return c.json(200, { 'deleted': true })
  },
  $apis.requireRecordAuth()
)
