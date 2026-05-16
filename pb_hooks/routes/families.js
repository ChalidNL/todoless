// pb_hooks/routes/families.js
// REST API endpoints for families collection

// GET /api/todoless/families - list families (user's own)
routerAdd(
  'GET',
  '/api/todoless/families',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const userId = authRecord.id
    const familyId = authRecord.get('family_id')

    if (familyId) {
      const record = $app.dao().findRecordById('families', familyId)
      if (record) {
        return c.json(200, [{
          'id': record.id,
          'name': record.get('name'),
          'created_by': record.get('created_by'),
        }])
      }
    }

    // Return families created by this user
    const records = $app.dao().findRecordsByFilter('families', 'created_by = "' + userId + '"', '-created', 0, 0)
    const result = []
    for (let i = 0; i < records.length; i++) {
      result.push({
        'id': records[i].id,
        'name': records[i].get('name'),
        'created_by': records[i].get('created_by'),
      })
    }

    return c.json(200, result)
  },
  $apis.requireRecordAuth()
)

// GET /api/todoless/families/:id - get a specific family
routerAdd(
  'GET',
  '/api/todoless/families/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('families', id)
    if (!record) {
      return c.json(404, { 'error': 'Family not found' })
    }

    return c.json(200, {
      'id': record.id,
      'name': record.get('name'),
      'created_by': record.get('created_by'),
    })
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/families - create a family
routerAdd(
  'POST',
  '/api/todoless/families',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const body = $request.body()
    const collection = $app.dao().findCollectionByNameOrId('families')
    const record = new Record(collection)

    const data = new RecordUpsertAction($app, record)
      .loadRequest(body)
      .set('name', body.get('name') || '')
      .set('created_by', authRecord.id)

    data.submit()

    return c.json(201, {
      'id': record.id,
      'name': record.get('name'),
      'created_by': record.get('created_by'),
    })
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/families/join/:id - join a family (sets user's family_id)
routerAdd(
  'POST',
  '/api/todoless/families/join/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const familyId = c.pathParam('id')
    const family = $app.dao().findRecordById('families', familyId)
    if (!family) {
      return c.json(404, { 'error': 'Family not found' })
    }

    const data = new RecordUpsertAction($app, authRecord)
      .set('family_id', familyId)
    data.submit()

    return c.json(200, {
      'message': 'Joined family',
      'family_id': familyId,
    })
  },
  $apis.requireRecordAuth()
)

// POST /api/todoless/families/leave - leave current family
routerAdd(
  'POST',
  '/api/todoless/families/leave',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const data = new RecordUpsertAction($app, authRecord)
      .set('family_id', '')
    data.submit()

    return c.json(200, {
      'message': 'Left family',
    })
  },
  $apis.requireRecordAuth()
)
