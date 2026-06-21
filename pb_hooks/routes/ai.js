// pb_hooks/routes/ai.js
// AI Assistant integration: task suggestions, auto-categorization, chat

// ─── AI Config Endpoints ───────────────────────────────────────────────────

// Get AI config: GET /api/v1/ai/config
routerAdd(
  'GET',
  '/api/v1/ai/config',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const settings = getAiSettings(authRecord.id)
    if (!settings) {
      return c.json(200, { 'configured': false })
    }

    return c.json(200, {
      'configured': true,
      'provider': settings.get('provider'),
      'api_url': settings.get('api_url'),
      'model': settings.get('model'),
      'max_tokens': settings.get('max_tokens'),
      'temperature': settings.get('temperature'),
      'enabled': settings.get('enabled'),
    })
  },
  $apis.requireRecordAuth()
)

// Configure AI: POST /api/v1/ai/config
routerAdd(
  'POST',
  '/api/v1/ai/config',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const body = $request.body()
    const existing = getAiSettings(authRecord.id)

    if (existing) {
      // Update existing
      existing.set('provider', body.get('provider') || 'openai')
      existing.set('api_url', body.get('api_url') || '')
      existing.set('api_key', body.get('api_key') || existing.get('api_key'))
      existing.set('model', body.get('model') || 'gpt-4o-mini')
      existing.set('max_tokens', body.get('max_tokens') || 1024)
      existing.set('temperature', body.get('temperature') || 0.7)
      existing.set('enabled', body.get('enabled') !== undefined ? body.get('enabled') : true)
      $app.dao().saveRecord(existing)
      return c.json(200, serializeAiSettings(existing))
    }

    // Create new
    const collection = $app.dao().findCollectionByNameOrId('ai_settings')
    const record = new Record(collection)
    const data = new RecordUpsertAction($app, record)
    data.set('provider', body.get('provider') || 'openai')
    data.set('api_url', body.get('api_url') || '')
    data.set('api_key', body.get('api_key') || '')
    data.set('model', body.get('model') || 'gpt-4o-mini')
    data.set('max_tokens', body.get('max_tokens') || 1024)
    data.set('temperature', body.get('temperature') || 0.7)
    data.set('enabled', body.get('enabled') !== undefined ? body.get('enabled') : true)
    data.set('user', authRecord.id)
    data.submit()

    return c.json(201, serializeAiSettings(record))
  },
  $apis.requireRecordAuth()
)

// ─── AI Task Endpoints ─────────────────────────────────────────────────────

// Auto-categorize a task: POST /api/v1/ai/categorize
// Body: { "title": "Buy groceries", "description": "Milk, eggs, bread" }
// Returns: { "labels": ["shopping", "household"], "priority": "normal", "horizon": "week" }
routerAdd(
  'POST',
  '/api/v1/ai/categorize',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const settings = getAiSettings(authRecord.id)
    if (!settings || !settings.get('enabled')) {
      return c.json(503, { 'error': 'AI assistant not configured or disabled' })
    }

    const body = $request.body()
    const title = body.get('title') || ''
    const description = body.get('description') || ''

    if (!title) {
      return c.json(400, { 'error': 'Missing title' })
    }

    // Get user's existing labels for context
    const labels = getUserLabels(authRecord.id)

    const prompt = buildCategorizePrompt(title, description, labels)
    const response = callAiApi(settings, prompt, {
      'response_format': { 'type': 'json_object' }
    })

    if (!response) {
      return c.json(502, { 'error': 'AI API call failed' })
    }

    try {
      const parsed = JSON.parse(response)
      return c.json(200, {
        'labels': parsed.labels || [],
        'priority': parsed.priority || 'normal',
        'horizon': parsed.horizon || '',
        'confidence': parsed.confidence || 0.8,
      })
    } catch (e) {
      return c.json(502, { 'error': 'Invalid AI response', 'raw': response })
    }
  },
  $apis.requireRecordAuth()
)

// Task suggestions: POST /api/v1/ai/suggest
// Body: { "context": "planning week", "count": 5 }
// Returns: { "suggestions": [{ "title": "...", "labels": [...], "priority": "..." }] }
routerAdd(
  'POST',
  '/api/v1/ai/suggest',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const settings = getAiSettings(authRecord.id)
    if (!settings || !settings.get('enabled')) {
      return c.json(503, { 'error': 'AI assistant not configured or disabled' })
    }

    const body = $request.body()
    const context = body.get('context') || ''
    const count = parseInt(body.get('count') || '5', 10)

    // Get recent tasks for context
    const recentTasks = getRecentTasks(authRecord.id, 20)
    const labels = getUserLabels(authRecord.id)

    const prompt = buildSuggestPrompt(context, count, recentTasks, labels)
    const response = callAiApi(settings, prompt, {
      'response_format': { 'type': 'json_object' }
    })

    if (!response) {
      return c.json(502, { 'error': 'AI API call failed' })
    }

    try {
      const parsed = JSON.parse(response)
      return c.json(200, {
        'suggestions': parsed.suggestions || [],
      })
    } catch (e) {
      return c.json(502, { 'error': 'Invalid AI response', 'raw': response })
    }
  },
  $apis.requireRecordAuth()
)

// AI chat about tasks: POST /api/v1/ai/chat
// Body: { "message": "What should I focus on this week?" }
// Returns: { "response": "..." }
routerAdd(
  'POST',
  '/api/v1/ai/chat',
  (c) => {
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { 'error': 'Unauthorized' })
    }

    const settings = getAiSettings(authRecord.id)
    if (!settings || !settings.get('enabled')) {
      return c.json(503, { 'error': 'AI assistant not configured or disabled' })
    }

    const body = $request.body()
    const message = body.get('message') || ''

    if (!message) {
      return c.json(400, { 'error': 'Missing message' })
    }

    // Get task context for the AI
    const recentTasks = getRecentTasks(authRecord.id, 15)
    const overdueTasks = getOverdueTasks(authRecord.id)

    const prompt = buildChatPrompt(message, recentTasks, overdueTasks)
    const response = callAiApi(settings, prompt)

    if (!response) {
      return c.json(502, { 'error': 'AI API call failed' })
    }

    return c.json(200, { 'response': response })
  },
  $apis.requireRecordAuth()
)

// ─── Helper Functions ──────────────────────────────────────────────────────

function getAiSettings(userId) {
  const rows = $app.dao().findRecordsByFilter(
    'ai_settings',
    'user.id = "' + userId + '"',
    '-created',
    1,
    0
  )
  return rows.length > 0 ? rows[0] : null
}

function serializeAiSettings(record) {
  return {
    'provider': record.get('provider'),
    'api_url': record.get('api_url'),
    'model': record.get('model'),
    'max_tokens': record.get('max_tokens'),
    'temperature': record.get('temperature'),
    'enabled': record.get('enabled'),
  }
}

function getUserLabels(userId) {
  const rows = $app.dao().findRecordsByFilter(
    'labels',
    'user.id = "' + userId + '"',
    '-created',
    100,
    0
  )
  return rows.map(function (r) { return r.get('name') })
}

function getRecentTasks(userId, limit) {
  const rows = $app.dao().findRecordsByFilter(
    'tasks',
    'user.id = "' + userId + '" && archived = false',
    '-created',
    limit,
    0
  )
  return rows.map(function (r) {
    return {
      'title': r.get('title'),
      'status': r.get('status'),
      'priority': r.get('priority'),
      'horizon': r.get('horizon'),
      'labels': r.get('labels') || [],
      'due_date': r.get('due_date'),
    }
  })
}

function getOverdueTasks(userId) {
  const now = new Date().toISOString().split('T')[0]
  const rows = $app.dao().findRecordsByFilter(
    'tasks',
    'user.id = "' + userId + '" && status != "done" && due_date != "" && due_date < "' + now + '"',
    'due_date',
    20,
    0
  )
  return rows.map(function (r) {
    return {
      'title': r.get('title'),
      'due_date': r.get('due_date'),
    }
  })
}

function callAiApi(settings, userContent, extraBody) {
  var apiUrl = settings.get('api_url')
  var apiKey = settings.get('api_key')
  var model = settings.get('model')
  var maxTokens = settings.get('max_tokens') || 1024
  var temperature = settings.get('temperature') || 0.7

  // Normalize URL: ensure it ends with /v1/chat/completions
  if (apiUrl.indexOf('/chat/completions') === -1) {
    apiUrl = apiUrl.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1/chat/completions'
  }

  var messages = [
    { 'role': 'system', 'content': 'You are a helpful task management assistant for todoless. You help users organize, categorize, and plan their tasks. Always respond with valid JSON when requested.' },
    { 'role': 'user', 'content': userContent }
  ]

  var bodyObj = {
    'model': model,
    'messages': messages,
    'max_tokens': maxTokens,
    'temperature': temperature,
  }

  if (extraBody) {
    for (var key in extraBody) {
      bodyObj[key] = extraBody[key]
    }
  }

  var bodyStr = JSON.stringify(bodyObj)

  var resp = new Fetch(apiUrl)
    .header('Content-Type', 'application/json')
    .header('Authorization', 'Bearer ' + apiKey)
    .body(bodyStr)
    .post()

  if (resp.statusCode !== 200) {
    return null
  }

  var data = resp.json()
  return data.choices[0].message.content
}

// ─── Prompt Builders ───────────────────────────────────────────────────────

function buildCategorizePrompt(title, description, existingLabels) {
  var prompt = 'Categorize this task. Return ONLY valid JSON with this exact schema:\n'
  prompt += '{ "labels": ["label1", "label2"], "priority": "urgent|normal|low", "horizon": "week|month|3months|6months|year", "confidence": 0.0-1.0 }\n\n'
  prompt += 'Task title: ' + title + '\n'
  if (description) {
    prompt += 'Description: ' + description + '\n'
  }
  prompt += '\nExisting labels you can reuse: ' + JSON.stringify(existingLabels) + '\n'
  prompt += 'If a good existing label fits, use it. Otherwise suggest new ones.\n'
  prompt += 'Base horizon on urgency: week = do soon, month = this month, 3months+ = longer term.\n'
  return prompt
}

function buildSuggestPrompt(context, count, recentTasks, labels) {
  var prompt = 'Suggest ' + count + ' tasks the user might want to add. Return ONLY valid JSON:\n'
  prompt += '{ "suggestions": [{ "title": "...", "labels": [...], "priority": "urgent|normal|low", "horizon": "week|month|3months|6months|year", "reason": "why this task" }] }\n\n'
  if (context) {
    prompt += 'Context: ' + context + '\n'
  }
  prompt += '\nRecent tasks (avoid duplicates):\n'
  for (var i = 0; i < recentTasks.length; i++) {
    prompt += '- ' + recentTasks[i].title + ' [' + recentTasks[i].status + ']\n'
  }
  prompt += '\nAvailable labels: ' + JSON.stringify(labels) + '\n'
  prompt += 'Suggest practical, actionable tasks relevant to the user\'s context and existing task patterns.\n'
  return prompt
}

function buildChatPrompt(message, recentTasks, overdueTasks) {
  var prompt = 'Answer this question about the user\'s tasks. Be concise and practical.\n\n'
  prompt += 'User question: ' + message + '\n\n'

  if (overdueTasks.length > 0) {
    prompt += 'OVERDUE tasks (these need attention):\n'
    for (var i = 0; i < overdueTasks.length; i++) {
      prompt += '- ' + overdueTasks[i].title + ' (due: ' + overdueTasks[i].due_date + ')\n'
    }
    prompt += '\n'
  }

  prompt += 'Recent tasks:\n'
  for (var j = 0; j < recentTasks.length; j++) {
    var t = recentTasks[j]
    prompt += '- ' + t.title + ' [' + t.status + '] priority=' + t.priority + ' horizon=' + t.horizon
    if (t.labels && t.labels.length > 0) prompt += ' labels=' + JSON.stringify(t.labels)
    prompt += '\n'
  }

  return prompt
}
