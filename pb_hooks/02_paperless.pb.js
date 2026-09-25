// PocketBase 0.35 Paperless-ngx integration.
// One self-contained named handler is used because Goja route callbacks cannot
// reliably access helpers declared outside their callback/module scope.

function paperlessHandler(c) {
  function getConfig(userId) {
    var rows = $app.findRecordsByFilter(
      'integrations',
      'type = "paperless" && user = {:userId}',
      '',
      1,
      0,
      { userId: userId }
    );
    if (!rows.length) return null;
    var rec = rows[0];
    var data = rec.get('config_data') || {};
    return {
      record: rec,
      api_url: String(rec.get('api_url') || ''),
      api_key: String(rec.get('api_key') || ''),
      todoTag: String(data.todo_tag || 'todoless'),
      enabled: rec.get('enabled') === true,
      userId: String(rec.get('user') || '')
    };
  }

  function safeConfig(rec) {
    var data = rec.get('config_data') || {};
    return {
      api_url: String(rec.get('api_url') || ''),
      todo_tag: String(data.todo_tag || 'todoless'),
      enabled: rec.get('enabled') === true,
      last_sync: rec.get('last_sync') || ''
    };
  }

  function send(config, path) {
    return $http.send({
      url: config.api_url.replace(/\/+$/, '') + path,
      method: 'GET',
      headers: {
        'Authorization': 'Token ' + config.api_key,
        'Content-Type': 'application/json'
      },
      timeout: 30
    });
  }

  function docsWithTag(config) {
    var tagResp = send(config, '/tags/?name=' + encodeURIComponent(config.todoTag));
    if (tagResp.statusCode !== 200) return [];
    var tagData = tagResp.json || {};
    var tags = tagData.results || [];
    var tag = null;
    for (var i = 0; i < tags.length; i++) {
      if (String(tags[i].name || '').toLowerCase() === config.todoTag.toLowerCase()) { tag = tags[i]; break; }
    }
    if (!tag) return [];
    var docResp = send(config, '/documents/?tags__id=' + tag.id + '&ordering=-created&page_size=50');
    if (docResp.statusCode !== 200) return [];
    var docData = docResp.json || {};
    return docData.results || [];
  }

  function alreadyProcessed(docId) {
    var id = String(parseInt(docId, 10));
    try {
      var refs = $app.findRecordsByFilter(
        'external_references',
        'source = "paperless" && external_id = {:documentId} && sync_status = "synced"',
        '', 1, 0, { documentId: id }
      );
      if (refs.length) return true;
    } catch (e) {}
    try {
      return $app.findRecordsByFilter('paperless_sync', 'document_id = {:documentId}', '', 1, 0, { documentId: parseInt(docId, 10) }).length > 0;
    } catch (e) { return false; }
  }

  function recordProcessed(docId, title, taskId, status, error, userId) {
    try {
      var rec = new Record($app.findCollectionByNameOrId('paperless_sync'));
      rec.set('document_id', parseInt(docId, 10));
      rec.set('document_title', title || '');
      rec.set('status', status);
      if (taskId) rec.set('task_id', taskId);
      if (error) rec.set('error_message', error);
      $app.save(rec);
    } catch (e) {}
    if (status === 'synced' && taskId && userId) {
      try {
        var ref = new Record($app.findCollectionByNameOrId('external_references'));
        ref.set('source', 'paperless');
        ref.set('external_id', String(parseInt(docId, 10)));
        ref.set('sync_status', 'synced');
        ref.set('entity_type', 'task');
        ref.set('entity_id', taskId);
        ref.set('user', userId);
        $app.save(ref);
      } catch (e) {}
    }
  }

  function createTask(config, title, parentId) {
    var rec = new Record($app.findCollectionByNameOrId('tasks'));
    rec.set('title', title);
    rec.set('status', 'todo');
    rec.set('blocked', false);
    rec.set('labels', ['paperless', 'scan']);
    rec.set('label', []);
    rec.set('is_private', false);
    rec.set('archived', false);
    rec.set('user', config.userId);
    if (parentId) { rec.set('linked_to', parentId); rec.set('linked_type', 'task'); }
    $app.save(rec);
    return rec;
  }

  function processDocument(docId) {
    if (alreadyProcessed(docId)) return { skipped: true, document_id: docId, reason: 'Already processed' };
    var configs = $app.findRecordsByFilter('integrations', 'type = "paperless" && enabled = true', '', 1, 0);
    if (!configs.length) return { error: 'Paperless not configured' };
    var config = getConfig(String(configs[0].get('user') || ''));
    if (!config) return { error: 'Paperless not configured' };

    var response;
    try { response = send(config, '/documents/' + parseInt(docId, 10) + '/'); }
    catch (e) { recordProcessed(docId, '', '', 'error', String(e), config.userId); return { error: 'Failed to fetch document' }; }
    if (response.statusCode !== 200) return { error: 'Document not found in Paperless (HTTP ' + response.statusCode + ')' };
    var doc = response.json || {};
    var title = String(doc.title || 'Untitled');
    var tags = doc.tags || [];
    var names = [];
    if (tags.length && typeof tags[0] === 'object') {
      for (var i = 0; i < tags.length; i++) if (tags[i].name) names.push(String(tags[i].name).toLowerCase());
    } else if (tags.length) {
      var tagResp = send(config, '/tags/?id__in=' + tags.join(','));
      if (tagResp.statusCode === 200) {
        var tagData = tagResp.json || {};
        var tagRows = tagData.results || [];
        for (var j = 0; j < tagRows.length; j++) if (tagRows[j].name) names.push(String(tagRows[j].name).toLowerCase());
      }
    }
    if (names.indexOf(config.todoTag.toLowerCase()) === -1) {
      recordProcessed(docId, title, '', 'skipped', 'Trigger tag missing', config.userId);
      return { skipped: true, document_id: docId, title: title, reason: 'Trigger tag missing' };
    }
    if (config.todoTag.toLowerCase() === 'todoless' && names.indexOf('inbox') !== -1) {
      recordProcessed(docId, title, '', 'skipped', 'Has inbox tag', config.userId);
      return { skipped: true, document_id: docId, title: title, reason: 'Has inbox tag' };
    }

    var parent = createTask(config, config.todoTag.toLowerCase() === 'todoless' ? 'Document: ' + title : title, '');
    var subtaskIds = [];
    if (config.todoTag.toLowerCase() === 'todoless') {
      var titles = ['Controleren', 'Verwerken / actie ondernemen', 'Archiveren'];
      for (var si = 0; si < titles.length; si++) subtaskIds.push(createTask(config, titles[si], parent.id).id);
      parent.set('subtask_ids', subtaskIds);
      $app.save(parent);
    }
    configs[0].set('last_sync', new Date().toISOString());
    $app.save(configs[0]);
    recordProcessed(docId, title, parent.id, 'synced', '', config.userId);
    return { created: true, task_id: parent.id, task_title: String(parent.get('title') || ''), document_id: docId, paperless_title: title, subtasks: subtaskIds };
  }

  var info = c.requestInfo();
  var action = String(c.request.pathValue('action') || '');
  var auth = (info && info.auth) || null;

  if (action === 'webhook') {
    var body = info.body || {};
    var docId = body.document_id || body.id;
    if (!docId) return c.json(400, { error: 'Missing document_id' });
    var secret = $os.getenv('PAPERLESS_WEBHOOK_SECRET');
    if (!secret) return c.json(503, { error: 'Webhook secret not configured' });
    var headers = info.headers || {};
    var provided = String(headers['x_paperless_webhook_secret'] || headers['x_webhook_secret'] || headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
    if (!$security.equal(provided, String(secret).trim())) return c.json(401, { error: 'Invalid webhook secret' });
    var result = processDocument(parseInt(docId, 10));
    return c.json(result.error ? 500 : (result.created ? 201 : 200), result);
  }

  if (!auth) return c.json(401, { error: 'Unauthorized' });
  var config = getConfig(auth.id);

  if (action === 'config') {
    var data = info.body || {};
    var apiUrl = String(data.api_url || '').trim();
    var apiKey = String(data.api_key || '').trim();
    var todoTag = String(data.todo_tag || 'todoless').trim();
    var enabled = data.enabled !== false && data.enabled !== 'false';
    if (!apiUrl || !apiKey) return c.json(400, { error: 'api_url and api_key are required' });
    var rec = config ? config.record : new Record($app.findCollectionByNameOrId('integrations'));
    rec.set('type', 'paperless'); rec.set('api_url', apiUrl); rec.set('api_key', apiKey);
    rec.set('config_data', { todo_tag: todoTag }); rec.set('enabled', enabled); rec.set('user', auth.id);
    $app.save(rec);
    return c.json(config ? 200 : 201, { message: config ? 'Updated' : 'Created', config: safeConfig(rec) });
  }

  if (!config || !config.enabled) return c.json(503, { error: 'Paperless not configured or disabled' });
  if (action === 'poll') return c.json(200, { documents: docsWithTag(config) });
  if (action === 'test') {
    try {
      var test = send(config, '/tags/');
      return c.json(test.statusCode === 200 ? 200 : 502, { connected: test.statusCode === 200, configured: true, status: test.statusCode });
    } catch (e) { return c.json(502, { error: 'Connection failed: ' + String(e), configured: true }); }
  }
  if (action === 'sync') {
    var docs = docsWithTag(config); var results = [];
    for (var di = 0; di < docs.length; di++) results.push(processDocument(docs[di].id));
    return c.json(200, { synced: results.length, results: results });
  }
  return c.json(404, { error: 'Unknown Paperless action' });
}

routerAdd('POST', '/api/integrations/paperless/{action}', paperlessHandler);
routerAdd('GET', '/api/integrations/paperless/{action}', paperlessHandler);
