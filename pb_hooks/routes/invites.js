// pb_hooks/routes/invites.js
// REST API endpoints for invite_codes collection

routerAdd(
  'GET',
  '/api/todoless/invites',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const userId = authRecord.id
    const filter = 'user.id = "' + userId + '"'
    const sort = $request.queryParam('sort') || '-created'

    const result = $app.dao().findRecordsByFilter('invite_codes', filter, sort, 0, 0)
    return c.json(200, result)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'GET',
  '/api/todoless/invites/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('invite_codes', id)
    if (!record) {
      return c.json(404, { 'error': 'Invite not found' })
    }

    return c.json(200, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'POST',
  '/api/todoless/invites',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const body = $request.body()
    const collection = $app.dao().findCollectionByNameOrId('invite_codes')
    const record = new Record(collection)

    const data = new RecordUpsertAction($app, record)
      .loadRequest(body)
      .set('user', authRecord.id)
      .set('code', body.get('code') || '')
      .set('used', false)

    if (body.has('expires_at')) data.set('expires_at', body.get('expires_at'))

    data.submit()

    return c.json(201, record)
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'DELETE',
  '/api/todoless/invites/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('invite_codes', id)
    if (!record) {
      return c.json(404, { 'error': 'Invite not found' })
    }

    if (record.get('user') !== authRecord.id) {
      return c.json(403, { 'error': 'Forbidden' })
    }

    $app.dao().deleteRecord(record)
    return c.json(200, { 'deleted': true })
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/invites/generate
// Generates a random 6-digit invite code
routerAdd(
  'POST',
  '/api/todoless/invites/generate',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000)  // 1 hour

    const collection = $app.dao().findCollectionByNameOrId('invite_codes')
    const record = new Record(collection)
    const data = new RecordUpsertAction($app, record)
      .set('user', authRecord.id)
      .set('code', code)
      .set('expires_at', expiresAt.toISOString())
      .set('used', false)

    data.submit()

    return c.json(201, {
      'id': record.id,
      'code': code,
      'expires_at': expiresAt.toISOString(),
    })
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/invites/:id/use
// Marks an invite code as used. Server-side endpoint bypasses updateRule.
// Any authenticated user can call this to consume an invite during registration.
routerAdd(
  'POST',
  '/api/todoless/invites/:id/use',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const collection = $app.dao().findCollectionByNameOrId('invite_codes')
    const record = $app.dao().findRecordById('invite_codes', id)

    if (!record) {
      return c.json(404, { 'error': 'Invite not found' })
    }
    if (record.get('used')) {
      return c.json(409, { 'error': 'Invite already used' })
    }
    if (new Date(record.get('expires_at')) <= new Date()) {
      return c.json(410, { 'error': 'Invite expired' })
    }

    const data = new RecordUpsertAction($app, record)
      .set('used', true)
      .set('used_by', authRecord.id)
      .set('used_at', new Date().toISOString())

    data.submit()

    return c.json(200, { 'used': true, 'id': record.id })
  },
  $apis.requireRecordAuth()
)
