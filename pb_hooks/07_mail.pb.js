// pb_hooks/07_mail.pb.js
// MVP-MAIL: Email Import Webhook — PB 0.35 compatible
// Creates tasks from incoming email.
//
// Expected: from (email), subject (title), body (desc, optional)
// Auth: Bearer MAIL_WEBHOOK_SECRET env var (required; fail closed if unset)
//
// PB 0.35 patterns:
// - new Record(collection) instead of $app.findRecordById(randomId)
// - c.requestInfo() called ONCE per handler (PB 0.34 compat)

routerAdd('POST', '/api/integrations/mail/webhook', function(c) {
  function checkAuth() {
    var secret = String($os.getenv('MAIL_WEBHOOK_SECRET') || '').trim();
    if (!secret) return 'secret-not-configured';
    var info = c.requestInfo();
    if (!info || !info.headers) return 'no-header';
    var h = info.headers.authorization || info.headers.Authorization || '';
    if (!h) return 'no-header';
    var p = String(h).split(' ');
    if (p.length !== 2 || p[0].toLowerCase() !== 'bearer') return 'bad-format';
    var t = p[1].trim();
    if (!t) return 'empty-token';
    if (t.length !== secret.length) return 'wrong-secret';
    var diff = 0;
    for (var i = 0; i < t.length; i++) diff |= t.charCodeAt(i) ^ secret.charCodeAt(i);
    if (diff !== 0) return 'wrong-secret';
    return null;
  }
  try {
    var authErr = checkAuth();
    if (authErr === 'secret-not-configured') return c.json(503, {error: 'MAIL_WEBHOOK_SECRET not configured'});
    if (authErr) return c.json(401, {error: 'Unauthorized'});
    var info = c.requestInfo();
    var b = info && info.body ? info.body : {};
    var from = '', subject = '', bodyText = '', familyId = '';
    if (typeof b.get === 'function') {
      from = String(b.get('from') || '').trim();
      subject = String(b.get('subject') || '').trim();
      bodyText = String(b.get('body') || '').trim();
      familyId = String(b.get('family_id') || '').trim();
    } else {
      from = String(b.from || '').trim();
      subject = String(b.subject || '').trim();
      bodyText = String(b.body || b.text || '').trim();
      familyId = String(b.family_id || '').trim();
    }
    if (!from) return c.json(400, {error: 'Missing from (sender email)'});
    if (!subject) return c.json(400, {error: 'Missing subject'});
    var users = $app.findRecordsByFilter('users', 'email = {:email}', '', 1, 0, {email: from});
    if (users.length === 0) return c.json(404, {error: 'No user found: ' + from});
    var user = users[0];
    if (!familyId) familyId = String(user.get('family_id') || '').trim();
    if (!familyId) return c.json(400, {error: 'User has no family'});
    // Create task record (PB 0.35: use new Record, not findRecordById)
    var coll = $app.findCollectionByNameOrId('tasks');
    var task = new Record(coll);
    task.set('title', subject);
    if (bodyText) task.set('blocked_comment', bodyText);
    task.set('status', 'todo');
    task.set('user', user.id);
    $app.save(task);
    return c.json(201, {id: task.id, title: subject, status: 'todo', family_id: familyId, source: 'email'});
  } catch(e) { try { $app.logger().error('mail webhook error: ' + String(e)); } catch(_e) {} return c.json(500, {error: 'Internal server error'}); }
});
