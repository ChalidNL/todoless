// pb_hooks/07_mail.pb.js
// MVP-MAIL: Email Import Webhook — PB 0.35 compatible
// Creates tasks from incoming email.
//
// Expected: from (email), subject (title), body (desc, optional)
// Auth: Bearer MAIL_WEBHOOK_SECRET env var (optional if unset)
// PB 0.35: $app.methods() replaces $app.dao().method()

routerAdd('POST', '/api/integrations/mail/webhook', function(c) {
  function checkAuth() {
    var info = c.requestInfo();
    if (!info || !info.headers) return 'no-header';
    var h = info.headers.Authorization || '';
    if (!h) return 'no-header';
    var p = String(h).split(' ');
    if (p.length !== 2 || p[0].toLowerCase() !== 'bearer') return 'bad-format';
    var t = p[1].trim();
    if (!t) return 'empty-token';
    var secret = $os.getenv('MAIL_WEBHOOK_SECRET');
    if (secret && t !== String(secret).trim()) return 'wrong-secret';
    return null;
  }
  try {
    var authErr = checkAuth();
    if ($os.getenv('MAIL_WEBHOOK_SECRET') && authErr) return c.json(401, {error: 'Unauthorized'});
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
    var task = $app.findRecordById('tasks', $security.randomString(15).toLowerCase());
    task.set('title', subject);
    if (bodyText) task.set('description', bodyText);
    task.set('status', 'open');
    task.set('user', user.id);
    task.set('family_id', familyId);
    $app.save(task);
    return c.json(201, {id: task.id, title: subject, status: 'open', family_id: familyId, source: 'email'});
  } catch(e) { return c.json(500, {error: String(e)}); }
});
