// Agent task and reminder endpoints. Callbacks cannot see top-level code, so
// each route requires its helpers itself.

// GET /api/agent/tasks
routerAdd('GET', '/api/agent/tasks', function(c) {
  var authLib = require(__hooks + '/lib/auth.js');
  function auth() { return authLib.requireApiToken(c); }
  function hasScope(key, scope) { return authLib.hasScope(key, scope); }
  var canAccessTaskForUser = require(__hooks + '/lib/auth.js').canAccessTaskForUser;
  try { var a=auth(); if(a.error)return c.json(a.status||401,{error:a.error}); if(!hasScope(a.key,'entries:read')&&!hasScope(a.key,'tasks:read'))return c.json(403,{error:'Missing scope'}); var q=c.requestInfo().query||{}; var taskStatus=require(__hooks + '/lib/task-status.js'); var st=taskStatus.normalizeTaskStatus(q.status); if(st&&!taskStatus.isTaskStatus(st))return c.json(400,{error:'Invalid status'}); var params={familyId:a.fid,userId:a.uid}; var filter='user.family_id = {:familyId} && assigned_to = {:userId}'; if(st){filter+=' && status = {:status}';params.status=st;} var requestedSort=String(q.sort||'-created'); var allowedSorts=['created','-created','updated','-updated','due_date','-due_date','priority','-priority']; var sort=allowedSorts.indexOf(requestedSort)!==-1?requestedSort:'-created'; var tasks=$app.findRecordsByFilter('tasks',filter,sort,100,0,params); var r=[]; for(var i=0;i<tasks.length;i++){var t=tasks[i];if(!canAccessTaskForUser(t,a.user))continue;r.push({id:t.id,title:t.get('title'),status:t.get('status'),created:String(t.get('created'))});} return c.json(200,{tasks:r}); } catch(e){return require(__hooks + '/lib/errors.js').respondError(c, e, 500);}
});

// PATCH /api/agent/tasks/{id}
routerAdd('PATCH', '/api/agent/tasks/{id}', function(c) {
  var authLib = require(__hooks + '/lib/auth.js');
  function auth() { return authLib.requireApiToken(c); }
  function hasScope(key, scope) { return authLib.hasScope(key, scope); }
  var canAccessTaskForUser = require(__hooks + '/lib/auth.js').canAccessTaskForUser;
  try { var a=auth(); if(a.error)return c.json(a.status||401,{error:a.error}); if(!hasScope(a.key,'entries:write')&&!hasScope(a.key,'tasks:write'))return c.json(403,{error:'Missing scope'}); var id=c.request.pathValue('id'); var t=$app.findRecordById('tasks',id); if(!t)return c.json(404,{error:'Not found'}); if(String(t.get('assigned_to')||'')!==a.uid)return c.json(403,{error:'Not assigned'}); var owner=null; try{owner=$app.findRecordById('users',String(t.get('user')||''));}catch(e){} if(!owner||String(owner.get('family_id')||'')!==a.fid)return c.json(403,{error:'Outside family'}); if(!canAccessTaskForUser(t,a.user))return c.json(403,{error:'Task is private'}); var info=c.requestInfo(); var body=info.body||info.data||{}; var ns=String(body.status||'').trim(); if(ns){t.set('status',ns); if(ns==='done')t.set('completed_at',new Date().toISOString());} $app.save(t); return c.json(200,{id:t.id,status:t.get('status')}); } catch(e){return require(__hooks + '/lib/errors.js').respondError(c, e, 500);}
});

// POST /api/agent/reminders
routerAdd('POST', '/api/agent/reminders', function(c) {
  var authLib = require(__hooks + '/lib/auth.js');
  function auth() { return authLib.requireApiToken(c); }
  function hasScope(key, scope) { return authLib.hasScope(key, scope); }
  var canAccessTaskForUser = require(__hooks + '/lib/auth.js').canAccessTaskForUser;
  try { var a=auth(); if(a.error)return c.json(a.status||401,{error:a.error}); if(!hasScope(a.key,'entries:write')&&!hasScope(a.key,'calendar:write'))return c.json(403,{error:'Missing scope'}); var info=c.requestInfo(); var body=info.body||info.data||{}; var title=String(body.title||'').trim(); if(!title)return c.json(400,{error:'Title required'}); var rt=String(body.reminder_time||'').trim(); if(!rt)return c.json(400,{error:'reminder_time required'}); var coll=$app.findCollectionByNameOrId('reminders'); var rec=new Record(coll); rec.set('title',title); rec.set('reminder_time',rt); rec.set('user',a.uid); $app.save(rec); return c.json(201,{id:rec.id,title:title,reminder_time:rt}); } catch(e){return require(__hooks + '/lib/errors.js').respondError(c, e, 500);}
});

// GET /api/agent/reminders
routerAdd('GET', '/api/agent/reminders', function(c) {
  var authLib = require(__hooks + '/lib/auth.js');
  function auth() { return authLib.requireApiToken(c); }
  function hasScope(key, scope) { return authLib.hasScope(key, scope); }
  var canAccessTaskForUser = require(__hooks + '/lib/auth.js').canAccessTaskForUser;
  try { var a=auth(); if(a.error)return c.json(a.status||401,{error:a.error}); if(!hasScope(a.key,'entries:read')&&!hasScope(a.key,'calendar:read'))return c.json(403,{error:'Missing scope'}); var q=c.requestInfo().query||{}; var inc=String(q.include_fired||'false').trim()==='true'; var params={userId:a.uid}; var filter='user = {:userId}'; if(!inc){filter+=' && reminder_time >= {:now}';params.now=new Date().toISOString();} var rems=$app.findRecordsByFilter('reminders',filter,'reminder_time',100,0,params); var r=[]; for(var i=0;i<rems.length;i++){var rm=rems[i];r.push({id:rm.id,title:rm.get('title'),reminder_time:String(rm.get('reminder_time'))});} return c.json(200,{reminders:r}); } catch(e){return require(__hooks + '/lib/errors.js').respondError(c, e, 500);}
});
