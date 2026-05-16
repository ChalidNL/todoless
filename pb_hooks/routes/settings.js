// pb_hooks/routes/settings.js
// REST API endpoints for app_settings collection

// Public endpoint: returns ONLY bootstrap status for first-run onboarding detection
// This replaces the insecure public listRule on app_settings that exposed all user settings
routerAdd(
  'GET',
  '/api/todoless/setup-status',
  (c) => {
    try {
      const userRows = $app.dao().findRecordsByFilter('users', '', '-created', 1, 0)
      const settingsRows = $app.dao().findRecordsByFilter('app_settings', 'setup_complete = true', '-created', 1, 0)
      return c.json(200, {
        has_users: userRows.length > 0,
        setup_complete: settingsRows.length > 0,
      })
    } catch {
      return c.json(200, { has_users: true, setup_complete: false })
    }
  }
)

routerAdd(
  'GET',
  '/api/todoless/settings',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const userId = authRecord.id
    const rows = $app.dao().findRecordsByFilter('app_settings', 'user = "' + userId + '"', '-created', 1, 0)

    if (rows.length === 0) {
      // Return defaults if no settings exist
      return c.json(200, {
        'user': userId,
        'sprint_duration': '2weeks',
        'sprint_start_day': 1,
        'language': 'en',
        'archive_retention_days': 30,
        'auto_cleanup': true,
        'theme': 'light',
        'setup_complete': false,
      })
    }

    return c.json(200, rows[0])
  },
  $apis.requireRecordAuth()
)

routerAdd(
  'PATCH',
  '/api/todoless/settings',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const userId = authRecord.id
    const rows = $app.dao().findRecordsByFilter('app_settings', 'user = "' + userId + '"', '-created', 1, 0)

    const body = $request.body()

    if (rows.length === 0) {
      // Create new settings
      const collection = $app.dao().findCollectionByNameOrId('app_settings')
      const record = new Record(collection)
      const data = new RecordUpsertAction($app, record)
        .loadRequest(body)
        .set('user', userId)

      if (body.has('sprint_duration')) data.set('sprint_duration', body.get('sprint_duration'))
      if (body.has('sprint_start_day')) data.set('sprint_start_day', body.get('sprint_start_day'))
      if (body.has('language')) data.set('language', body.get('language'))
      if (body.has('archive_retention_days')) data.set('archive_retention_days', body.get('archive_retention_days'))
      if (body.has('auto_cleanup')) data.set('auto_cleanup', body.get('auto_cleanup'))
      if (body.has('theme')) data.set('theme', body.get('theme'))
      if (body.has('setup_complete')) data.set('setup_complete', body.get('setup_complete'))

      data.submit()
      return c.json(201, record)
    }

    const record = rows[0]
    const data = new RecordUpsertAction($app, record).loadRequest(body)

    if (body.has('sprint_duration')) data.set('sprint_duration', body.get('sprint_duration'))
    if (body.has('sprint_start_day')) data.set('sprint_start_day', body.get('sprint_start_day'))
    if (body.has('language')) data.set('language', body.get('language'))
    if (body.has('archive_retention_days')) data.set('archive_retention_days', body.get('archive_retention_days'))
    if (body.has('auto_cleanup')) data.set('auto_cleanup', body.get('auto_cleanup'))
    if (body.has('theme')) data.set('theme', body.get('theme'))
    if (body.has('setup_complete')) data.set('setup_complete', body.get('setup_complete'))

    data.submit()
    return c.json(200, record)
  },
  $apis.requireRecordAuth()
)
