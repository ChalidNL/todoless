// pb_hooks/routes/users.js
// REST API endpoints for user management

// GET /api/todoless/users - list all users
routerAdd(
  'GET',
  '/api/todoless/users',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const users = $app.dao().findCollectionByNameOrId('users')
    const records = $app.dao().findRecordsByFilter('users', '', 'name', 0, 0)

    const result = []
    for (let i = 0; i < records.length; i++) {
      result.push({
        'id': records[i].id,
        'email': records[i].get('email'),
        'name': records[i].get('name'),
        'avatar': records[i].get('avatar'),
        'role': records[i].get('role'),
        'family_id': records[i].get('family_id'),
      })
    }

    return c.json(200, result)
  },
  $apis.requireRecordAuth()
)

// GET /api/todoless/users/:id - get a specific user
routerAdd(
  'GET',
  '/api/todoless/users/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const id = c.pathParam('id')
    const record = $app.dao().findRecordById('users', id)
    if (!record) {
      return c.json(404, { 'error': 'User not found' })
    }

    return c.json(200, {
      'id': record.id,
      'email': record.get('email'),
      'name': record.get('name'),
      'avatar': record.get('avatar'),
      'role': record.get('role'),
      'family_id': record.get('family_id'),
    })
  },
  $apis.requireRecordAuth()
)

// PATCH /api/todoless/users/:id - update a user
routerAdd(
  'PATCH',
  '/api/todoless/users/:id',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    // Any authenticated user can update any user (multi-user)
    const id = c.pathParam('id')

    const record = $app.dao().findRecordById('users', id)
    if (!record) {
      return c.json(404, { 'error': 'User not found' })
    }

    const body = $request.body()
    const data = new RecordUpsertAction($app, record).loadRequest(body)

    if (body.has('name')) data.set('name', body.get('name'))
    if (body.has('avatar')) data.set('avatar', body.get('avatar'))
    if (body.has('family_id')) data.set('family_id', body.get('family_id'))
    if (body.has('firstName') || body.has('first_name')) data.set('first_name', body.get('firstName') || body.get('first_name'))
    if (body.has('lastName') || body.has('last_name')) data.set('last_name', body.get('lastName') || body.get('last_name'))
    if (body.has('displayName') || body.has('display_name')) data.set('display_name', body.get('displayName') || body.get('display_name'))

    // Any user can change roles (multi-user)
    if (body.has('role')) {
      data.set('role', body.get('role'))
    }

    // Password change
    if (body.has('password')) {
      data.set('password', body.get('password'))
      data.set('passwordConfirm', body.get('password'))
    }

    data.submit()

    return c.json(200, {
      'id': record.id,
      'email': record.get('email'),
      'name': record.get('name'),
      'first_name': record.get('first_name'),
      'last_name': record.get('last_name'),
      'displayName': record.get('displayName'),
      'avatar': record.get('avatar'),
      'role': record.get('role'),
      'family_id': record.get('family_id'),
    })
  },
  $apis.requireRecordAuth()
)
