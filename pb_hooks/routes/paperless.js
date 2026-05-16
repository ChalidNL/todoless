// pb_hooks/routes/paperless.js
// Paperless-ngx integration: webhook handler and task auto-creation
//
// Flow: Paperless scans doc -> webhook hits Todoless -> checks 'todo' tag -> creates task
// Supports both webhook push (instant) and polling (fallback).

// ---------------------------------------------------------------------------
// Webhook: POST /api/integrations/paperless/webhook
// Called by Paperless-ngx when a document is added/updated.
// Validates webhook secret, checks for 'todo' tag, creates task.
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/api/integrations/paperless/webhook',
  (c) => {
    const body = $request.body()
    const docId = body.get('document_id') || body.get('id')

    if (!docId) {
      return c.json(400, { error: 'Missing document_id' })
    }

    // Validate webhook secret (required)
    const secret = $env.get('PAPERLESS_WEBHOOK_SECRET')
    if (!secret) {
      return c.json(503, { error: 'Webhook secret not configured' })
    }
    const providedSecret = (
      $request.header('X-Paperless-Webhook-Secret') ||
      $request.header('X-Webhook-Secret') ||
      String($request.header('Authorization') || '').replace(/^Bearer\s+/i, '') ||
      ''
    ).trim()
    if (!providedSecret || providedSecret !== secret.trim()) {
      return c.json(401, { error: 'Invalid webhook secret' })
    }

    // Process: check tag, dedup, create task
    const result = processPaperlessDocument(parseInt(docId))

    if (result.error) {
      return c.json(500, result)
    }

    if (result.skipped) {
      return c.json(200, result)
    }

    return c.json(201, result)
  }
)

// ---------------------------------------------------------------------------
// Polling: GET /api/integrations/paperless/poll
// Authenticated endpoint — fetches recent Paperless docs with todo tag
// that haven't been synced yet.
// ---------------------------------------------------------------------------
routerAdd(
  'GET',
  '/api/integrations/paperless/poll',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { error: 'Unauthorized' })
    }

    const config = getPaperlessConfig(authRecord.id)
    if (!config || !config.enabled) {
      return c.json(503, { error: 'Paperless not configured or disabled' })
    }

    // Fetch unprocessed docs from Paperless
    const docs = fetchPaperlessDocsWithTag(config, config.todoTag || 'todo')

    return c.json(200, { documents: docs })
  },
  $apis.requireRecordAuth()
)

// ---------------------------------------------------------------------------
// Test connection: GET /api/integrations/paperless/test
// Verifies Paperless connectivity and tag lookup.
// ---------------------------------------------------------------------------
routerAdd(
  'GET',
  '/api/integrations/paperless/test',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { error: 'Unauthorized' })
    }

    const config = getPaperlessConfig(authRecord.id)
    if (!config) {
      return c.json(503, { error: 'Paperless not configured', configured: false })
    }

    // Test connectivity by fetching tags
    try {
      const resp = paperlessFetch(config, '/tags/')
      if (resp.statusCode !== 200) {
        return c.json(502, {
          error: 'Failed to connect to Paperless',
          status: resp.statusCode,
          configured: true,
        })
      }

      const tags = resp.json()
      const todoTag = (tags.results || []).find(function(t) {
        return (t.name || '').toLowerCase() === 'todo'
      })

      return c.json(200, {
        connected: true,
        configured: true,
        todoTagFound: !!todoTag,
        todoTagId: todoTag ? todoTag.id : null,
        totalTags: tags.count || 0,
      })
    } catch (e) {
      return c.json(502, {
        error: 'Connection failed: ' + e.message,
        configured: true,
      })
    }
  },
  $apis.requireRecordAuth()
)

// ---------------------------------------------------------------------------
// Configure: POST /api/integrations/paperless/config
// Sets or updates Paperless connection for the authenticated user.
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/api/integrations/paperless/config',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { error: 'Unauthorized' })
    }

    const body = $request.body()
    const api_url = body.get('api_url') || ''
    const api_key = body.get('api_key') || ''
    const todoTag = body.get('todo_tag') || 'todo'
    const enabled = body.get('enabled') !== 'false' && body.get('enabled') !== false

    if (!api_url || !api_key) {
      return c.json(400, { error: 'api_url and api_key are required' })
    }

    const existing = getPaperlessConfig(authRecord.id)

    if (existing) {
      existing.set('api_url', api_url)
      existing.set('api_key', api_key)
      existing.set('config_data', { todo_tag: todoTag, enabled: enabled })
      existing.set('enabled', enabled)
      $app.dao().saveRecord(existing)
      return c.json(200, { message: 'Updated', config: paperlessConfigToJSON(existing) })
    }

    const collection = $app.dao().findCollectionByNameOrId('integrations')
    const record = new Record(collection)
    const form = new RecordUpsertAction($app, record)
    form.set('type', 'paperless')
    form.set('api_url', api_url)
    form.set('api_key', api_key)
    form.set('config_data', { todo_tag: todoTag, enabled: enabled })
    form.set('enabled', enabled)
    form.set('user', authRecord.id)
    form.submit()

    return c.json(201, { message: 'Created', config: paperlessConfigToJSON(record) })
  },
  $apis.requireRecordAuth()
)

// ---------------------------------------------------------------------------
// Manual sync: POST /api/integrations/paperless/sync
// Triggers a full sync — scans recent Paperless docs and creates tasks.
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/api/integrations/paperless/sync',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { error: 'Unauthorized' })
    }

    const config = getPaperlessConfig(authRecord.id)
    if (!config || !config.enabled) {
      return c.json(503, { error: 'Paperless not configured or disabled' })
    }

    const docs = fetchPaperlessDocsWithTag(config, config.todoTag || 'todo')
    var results = []

    for (var i = 0; i < docs.length; i++) {
      var doc = docs[i]
      var result = processPaperlessDocument(doc.id)
      results.push(result)
    }

    return c.json(200, { synced: results.length, results: results })
  },
  $apis.requireRecordAuth()
)

// ===================================================================
// Helpers
// ===================================================================

// Get Paperless config for a user from the integrations collection
function getPaperlessConfig(userId) {
  var rows = $app.dao().findRecordsByFilter(
    'integrations',
    'type = "paperless" && user = "' + userId + '"',
    '-created',
    1,
    0
  )

  if (rows.length === 0) return null

  var rec = rows[0]
  var configData = {}
  try {
    configData = rec.get('config_data') || {}
  } catch(e) {}

  return {
    record: rec,
    api_url: rec.get('api_url') || '',
    api_key: rec.get('api_key') || '',
    todoTag: configData.todo_tag || 'todo',
    enabled: rec.get('enabled') === true,
  }
}

// Convert config record to safe JSON (no secrets)
function paperlessConfigToJSON(rec) {
  var configData = {}
  try { configData = rec.get('config_data') || {} } catch(e) {}

  return {
    api_url: rec.get('api_url'),
    todo_tag: configData.todo_tag || 'todo',
    enabled: rec.get('enabled'),
    last_sync: rec.get('last_sync'),
  }
}

// HTTP fetch helper for Paperless API
function paperlessFetch(config, path) {
  var url = config.api_url.replace(/\/+$/, '') + path
  return new Fetch(url)
    .header('Authorization', 'Token ' + config.api_key)
    .header('Content-Type', 'application/json')
    .get()
}

// Fetch documents from Paperless that have the given tag name
function fetchPaperlessDocsWithTag(config, tagName) {
  // First, find the tag ID
  var tagResp = paperlessFetch(config, '/tags/?name=' + encodeURIComponent(tagName))
  if (tagResp.statusCode !== 200) return []

  var tags = tagResp.json()
  var todoTag = null
  var results = tags.results || []
  for (var i = 0; i < results.length; i++) {
    if ((results[i].name || '').toLowerCase() === tagName.toLowerCase()) {
      todoTag = results[i]
      break
    }
  }
  if (!todoTag) return []

  // Fetch documents with this tag
  var docResp = paperlessFetch(config, '/documents/?tags__id=' + todoTag.id + '&ordering=-created&page_size=50')
  if (docResp.statusCode !== 200) return []

  var docs = docResp.json()
  return docs.results || []
}

// Check if a document has already been processed
function isDocumentProcessed(docId) {
  var rows = $app.dao().findRecordsByFilter(
    'paperless_sync',
    'document_id = ' + parseInt(docId),
    '',
    1,
    0
  )
  return rows.length > 0
}

// Record a processed document in the sync tracking collection
function recordProcessed(docId, docTitle, taskId, status, errorMsg) {
  var collection = $app.dao().findCollectionByNameOrId('paperless_sync')
  var record = new Record(collection)
  var form = new RecordUpsertAction($app, record)
  form.set('document_id', parseInt(docId))
  form.set('document_title', docTitle || '')
  form.set('status', status)
  if (taskId) form.set('task_id', taskId)
  if (errorMsg) form.set('error_message', errorMsg)
  form.submit()
  return record.id
}

// Main: process a Paperless document — check tag, dedup, create task
function processPaperlessDocument(docId) {
  // Dedup check
  if (isDocumentProcessed(docId)) {
    return { skipped: true, document_id: docId, reason: 'Already processed' }
  }

  // Get config — use admin as fallback since webhooks are unauthenticated
  var allConfigs = $app.dao().findRecordsByFilter(
    'integrations',
    'type = "paperless" && enabled = true',
    '-created',
    1,
    0
  )

  if (allConfigs.length === 0) {
    return { error: 'Paperless not configured' }
  }

  var configRec = allConfigs[0]
  var configData = {}
  try { configData = configRec.get('config_data') || {} } catch(e) {}

  var config = {
    api_url: configRec.get('api_url'),
    api_key: configRec.get('api_key'),
    todoTag: configData.todo_tag || 'todo',
    userId: configRec.get('user'),
  }

  // Fetch document from Paperless
  var resp
  try {
    resp = paperlessFetch(config, '/documents/' + docId + '/')
  } catch (e) {
    recordProcessed(docId, null, null, 'error', e.message)
    return { error: 'Failed to fetch document: ' + e.message }
  }

  if (resp.statusCode !== 200) {
    recordProcessed(docId, null, null, 'error', 'HTTP ' + resp.statusCode)
    return { error: 'Document not found in Paperless (HTTP ' + resp.statusCode + ')' }
  }

  var doc = resp.json()
  var docTitle = doc.title || 'Untitled'
  var docTags = doc.tags || []

  // Check if document has the todo tag
  var hasTodoTag = false
  var tagIdsToCheck = []

  // If tags are IDs, fetch tag details to check names
  if (docTags.length > 0 && typeof docTags[0] === 'number') {
    // Tags are stored as IDs — need to check if any match the todo tag
    var tagResp = paperlessFetch(config, '/tags/?id__in=' + docTags.join(','))
    if (tagResp.statusCode === 200) {
      var tagData = tagResp.json()
      var tagResults = tagData.results || []
      for (var i = 0; i < tagResults.length; i++) {
        if ((tagResults[i].name || '').toLowerCase() === config.todoTag.toLowerCase()) {
          hasTodoTag = true
          break
        }
      }
    }
  } else if (docTags.length > 0 && typeof docTags[0] === 'object') {
    // Tags are objects with name property
    for (var j = 0; j < docTags.length; j++) {
      if ((docTags[j].name || '').toLowerCase() === config.todoTag.toLowerCase()) {
        hasTodoTag = true
        break
      }
    }
  }

  if (!hasTodoTag) {
    recordProcessed(docId, docTitle, null, 'skipped', 'No todo tag')
    return { skipped: true, document_id: docId, title: docTitle, reason: 'No todo tag found' }
  }

  // Create task in Todoless
  var taskCollection = $app.dao().findCollectionByNameOrId('tasks')
  var taskRecord = new Record(taskCollection)
  var taskForm = new RecordUpsertAction($app, taskRecord)

  var taskTitle = docTitle
  // Extract text content snippet if available
  var content = doc.content || ''
  if (content && content.length > 200) {
    content = content.substring(0, 200) + '...'
  }

  taskForm.set('title', taskTitle)
  taskForm.set('status', 'todo')
  taskForm.set('blocked', false)
  taskForm.set('labels', ['paperless', 'scan'])
  taskForm.set('is_private', false)
  taskForm.set('archived', false)
  taskForm.set('user', config.userId)
  taskForm.submit()

  // Update integration last_sync timestamp
  configRec.set('last_sync', $now)
  $app.dao().saveRecord(configRec)

  // Track as synced
  recordProcessed(docId, docTitle, taskRecord.id, 'synced', null)

  return {
    created: true,
    task_id: taskRecord.id,
    task_title: taskRecord.get('title'),
    document_id: docId,
    paperless_title: docTitle,
  }
}
