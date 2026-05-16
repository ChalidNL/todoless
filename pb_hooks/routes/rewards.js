// pb_hooks/routes/rewards.js
// REST API endpoints for rewards collection

routerAdd(
  'GET',
  '/api/todoless/rewards',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const filter = ''  // rewards are visible to all authenticated users
    const sort = $request.queryParam('sort') || '-created'

    const result = $app.dao().findRecordsByFilter('rewards', filter, sort, 0, 0)
    return c.json(200, result)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'GET',
  '/api/todoless/rewards/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('rewards', id)
    if (!record) {
      return c.json(404, { 'error': 'Reward not found' })
    }

    return c.json(200, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'POST',
  '/api/todoless/rewards',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const body = $request.body()
    const collection = $app.dao().findCollectionByNameOrId('rewards')
    const record = new Record(collection)

    const data = new RecordUpsertAction($app, record)
      .loadRequest(body)
      .set('user', authRecord.id)
      .set('title', body.get('title') || '')
      .set('points', body.get('points') || 0)
      .set('awarded_by', authRecord.id)

    if (body.has('earned_by')) data.set('earned_by', body.get('earned_by'))
    if (body.has('earned_at')) data.set('earned_at', body.get('earned_at'))
    if (body.has('reason')) data.set('reason', body.get('reason'))
    if (body.has('task_id')) data.set('task_id', body.get('task_id'))

    data.submit()

    return c.json(201, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'DELETE',
  '/api/todoless/rewards/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('rewards', id)
    if (!record) {
      return c.json(404, { 'error': 'Reward not found' })
    }

    if (record.get('user') !== authRecord.id) {
      return c.json(403, { 'error': 'Forbidden' })
    }

    $app.dao().deleteRecord(record)
    return c.json(200, { 'deleted': true })
  },
  $apis.requireRecordAuth()
)
