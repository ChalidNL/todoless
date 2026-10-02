// ICS import and export. The app parses .ics files with ical.js and posts the
// VEVENTs as JSON; export and the subscription feed are built by
// lib/ics-feed.js.

// ─── POST /api/ics-import — Import parsed VEVENTs as tasks ──────────
routerAdd('POST','/api/ics-import',function(c){
  function gv(o,k,f){if(f===undefined)f='';if(!o)return f;if(Object.prototype.hasOwnProperty.call(o,k)){var v=o[k];return(v===undefined||v===null)?f:v;}return f;}
  var canAccessTaskForUser = require(__hooks + '/lib/auth.js').canAccessTaskForUser;
  try{
    // Auth
    var info=c.requestInfo();
    var body=gv(info,'data')||gv(info,'body')||{};
    var auth=(info&&info.auth)||c.get('authRecord')||null;
    if(!auth)return c.json(401,{error:'Unauthorized'});

    var familyId=String(auth.get('family_id')||'');
    if(!familyId)return c.json(400,{error:'User has no family — cannot import'});

    var events=gv(body,'events');
    if(!events||typeof events.length==='undefined'||events.length===0){
      return c.json(400,{error:'No events to import'});
    }

    var options=gv(body,'options')||{};
    var bulkAssignee=gv(options,'assignee');
    var bulkLabels=gv(options,'labels')||[];
    // #230: the bulk options apply to every event, so an invalid value is a
    // request error; per-event values are checked in the loop below.
    var authLib=require(__hooks + '/lib/auth.js');
    if(!authLib.isValidAssigneeForUser(bulkAssignee,auth))return c.json(400,{error:'Invalid assignee'});
    var bulkLabelCheck=authLib.validateLabelIdsForUser(bulkLabels,auth);
    if(!bulkLabelCheck.ok)return c.json(bulkLabelCheck.status,{error:bulkLabelCheck.error});

    var results={created:0,updated:0,skipped:0,errors:[],items:[]};
    var tasksColl=$app.findCollectionByNameOrId('tasks');
    var batchSize=50;
    var totalProcessed=0;

    for(var i=0;i<events.length;i++){
      var ev=events[i];
      if(!ev||!ev.title){results.skipped++;continue;}

      var uid=String(gv(ev,'uid','')).trim();
      var title=String(gv(ev,'title','')).trim();
      if(!title){results.skipped++;continue;}

      // Check for an existing task with the same UID that this user may access.
      var existing=null;
      if(uid){
        var existingList=$app.findRecordsByFilter(
          'tasks',
          'uid = {:uid} && user.family_id = {:familyId}',
          '',
          100,
          0,
          {uid:uid,familyId:familyId}
        );
        existingList=existingList.filter(function(task){return canAccessTaskForUser(task,auth);});
        if(existingList.length>0)existing=existingList[0];
      }

      // Parse dates
      var startTime=ev.start_time||null;
      var endTime=ev.end_time||null;
      var allDay=!!ev.all_day;
      var description=gv(ev,'description');
      var location=gv(ev,'location');
      var timezone=gv(ev,'timezone');
      var rrule=gv(ev,'rrule');
      var exdates=ev.exdates||null;
      // #257: a series the app's recurrence model can express becomes a
      // normal recurring task (repeat_interval + due_date anchor); only an
      // RRULE it can't express is stored raw (shown once, exported as is).
      var repeatInterval=null;
      var dueAnchor=null;
      if(rrule&&startTime){
        var startMs=new Date(String(startTime)).getTime();
        if(!isNaN(startMs)){
          var recurrenceLib=require(__hooks+'/lib/recurrence.js');
          if(allDay){
            // Date-only anchor: UTC midnight of the Amsterdam calendar date
            // (older clients sent local midnight converted to UTC).
            var wall=new Date(startMs+(startMs%86400000===0?0:recurrenceLib.amsterdamOffsetMinutes(startMs)*60000));
            dueAnchor=new Date(Date.UTC(wall.getUTCFullYear(),wall.getUTCMonth(),wall.getUTCDate()));
          }else{
            dueAnchor=new Date(startMs);
          }
          repeatInterval=require(__hooks+'/lib/ics-recurrence.js').rruleToRepeatInterval(rrule,recurrenceLib.getAnchorParts(dueAnchor));
          if(repeatInterval){rrule='';}else{dueAnchor=null;}
        }
      }
      var recurrenceId=gv(ev,'recurrence_id');

      // Labels: merge bulk + event-specific
      var labels=[];
      if(bulkLabels&&typeof bulkLabels.length==='number'){
        for(var li=0;li<bulkLabels.length;li++){labels.push(bulkLabels[li]);}
      }
      var evLabels=ev.labels;
      if(evLabels&&typeof evLabels.length==='number'){
        for(var eli=0;eli<evLabels.length;eli++){labels.push(evLabels[eli]);}
      }
      // Deduplicate labels
      var seen={};
      var uniqueLabels=[];
      for(var uli=0;uli<labels.length;uli++){
        var lbl=String(labels[uli]||'');
        if(lbl&&!seen[lbl]){seen[lbl]=true;uniqueLabels.push(lbl);}
      }

      var assignee=bulkAssignee||gv(ev,'assigned_to')||ev.assignedTo||auth.id;
      // #230: per-event assignee and labels get the same checks as /api/tasks
      if(!authLib.isValidAssigneeForUser(assignee,auth)){
        results.errors.push({uid:uid,title:title,error:'Invalid assignee'});
        continue;
      }
      var labelCheck=authLib.validateLabelIdsForUser(uniqueLabels,auth);
      if(!labelCheck.ok){
        results.errors.push({uid:uid,title:title,error:labelCheck.error});
        continue;
      }
      uniqueLabels=labelCheck.ids;
      var labelsGiven=labels.length>0;

      try{
        if(existing){
          // Update existing
          existing.set('title',title);
          if(startTime)existing.set('start_time',startTime);
          if(endTime)existing.set('end_time',endTime);
          existing.set('all_day',allDay);
          if(description)existing.set('description',description);
          if(location)existing.set('location',location);
          if(timezone)existing.set('timezone',timezone);
          if(repeatInterval){
            existing.set('repeat_interval',repeatInterval);
            existing.set('due_date',dueAnchor.toISOString());
            existing.set('rrule','');
          }else if(rrule)existing.set('rrule',rrule);
          if(exdates)existing.set('exdates',exdates);
          if(recurrenceId)existing.set('recurrence_id',recurrenceId);
          existing.set('source','ics_import');
          existing.set('external_id',uid);
          if(assignee&&assignee!==existing.get('assigned_to')){
            existing.set('assigned_to',assignee);
          }
          // #230: a re-import without labels keeps the labels the user put on
          // the task in the app; it used to wipe them.
          if(labelsGiven){
            existing.set('labels',uniqueLabels);
            existing.set('label',uniqueLabels);
          }
          $app.save(existing);
          results.updated++;
          results.items.push({uid:uid,title:title,action:'updated',id:existing.id});
        }else{
          // Create new task
          var rec=new Record(tasksColl);
          rec.set('title',title);
          rec.set('status','todo');
          rec.set('user',auth.id);
          rec.set('assigned_to',assignee);
          if(startTime)rec.set('start_time',startTime);
          if(endTime)rec.set('end_time',endTime);
          rec.set('all_day',allDay);
          rec.set('show_in_calendar',true);
          if(description)rec.set('description',description);
          if(location)rec.set('location',location);
          if(uid)rec.set('uid',uid);
          if(timezone)rec.set('timezone',timezone);
          if(repeatInterval){
            rec.set('repeat_interval',repeatInterval);
            rec.set('due_date',dueAnchor.toISOString());
          }else if(rrule)rec.set('rrule',rrule);
          if(exdates)rec.set('exdates',exdates);
          if(recurrenceId)rec.set('recurrence_id',recurrenceId);
          rec.set('source','ics_import');
          if(uid)rec.set('external_id',uid);
          rec.set('labels',uniqueLabels);
          rec.set('label',uniqueLabels);
          rec.set('is_private',false);
          $app.save(rec);
          results.created++;
          results.items.push({uid:uid,title:title,action:'created',id:rec.id});
        }
      }catch(e2){
        try { console.error('[ics-import] per-item error uid=' + uid + ': ' + String(e2)); } catch(_c) {}
        results.errors.push({uid:uid,title:title,error:'Import failed for this event'});
      }

      totalProcessed++;
    }

    return c.json(200,{
      success:true,
      created:results.created,
      updated:results.updated,
      skipped:results.skipped,
      errors:results.errors,
      total:totalProcessed,
    });
  }catch(e){
    return require(__hooks + '/lib/errors.js').respondError(c, e, 500);
  }
});

// ─── GET /api/ics-export — Export tasks as .ics ─────────────────────
routerAdd('GET','/api/ics-export',function(c){
  try{
    var info=c.requestInfo();
    var auth=(info&&info.auth)||c.get('authRecord')||null;
    if(!auth)return c.json(401,{error:'Unauthorized'});

    var familyId=String(auth.get('family_id')||'');
    if(!familyId)return c.json(400,{error:'User has no family'});

    // Optional date range filter
    var query=info.query||{};
    var feed=require(__hooks+'/lib/ics-feed.js').buildFamilyCalendar(auth,{start:query.start,end:query.end});

    return c.json(200,{
      ics:feed.ics,
      count:feed.count,
    });
  }catch(e){
    return require(__hooks + '/lib/errors.js').respondError(c, e, 500);
  }
});

// ─── GET /api/calendar.ics — subscribable calendar feed (#100) ──────────
// For calendar apps (Apple/Google Calendar, Thunderbird, Home Assistant):
// served as text/calendar, with ETag/Last-Modified for cheap polling.
// Auth: ?token=<api token> (calendar apps cannot send headers) — such a token
// travels in URLs and logs, so it must be limited to calendar:read; or the
// usual session / Authorization: Bearer token with calendar:read.
routerAdd('GET','/api/calendar.ics',function(c){
  var authLib=require(__hooks+'/lib/auth.js');
  var errorsLib=require(__hooks+'/lib/errors.js');
  function memberStatusError(user){
    var status=String(user.get('member_status')||'');
    if(status==='blocked')return 'Account is blocked';
    if(status==='pending_approval')return 'Account is pending approval';
    return '';
  }
  try{
    var info=c.requestInfo();
    var query=info.query||{};
    var auth=null;
    var queryToken=String(query.token||'').trim();
    if(queryToken){
      var tok=authLib.findApiTokenByRaw(queryToken);
      if(!tok||!authLib.isEnabled(tok))return c.json(401,{error:'Invalid calendar token'});
      var exp=authLib.expiryMs(tok);
      if(exp>0&&exp<Date.now())return c.json(401,{error:'Calendar token has expired'});
      var perms=authLib.parseScopes(tok)||[];
      var calendarOnly=perms.length>0;
      for(var pi=0;pi<perms.length;pi++){if(String(perms[pi])!=='calendar:read'){calendarOnly=false;break;}}
      if(!calendarOnly)return c.json(403,{error:'Feed URLs need a token limited to calendar:read'});
      try{auth=$app.findRecordById('users',String(tok.get('user')||''));}catch(e){auth=null;}
      if(!auth)return c.json(401,{error:'Invalid calendar token'});
    }else{
      var ba=authLib.bearerAuthMiddleware(c);
      if(ba)return c.json(ba.status,{error:ba.error});
      auth=(info&&info.auth)||c.get('authRecord')||null;
      if(!auth)return c.json(401,{error:'Unauthorized'});
      if(!authLib.checkTokenPermission(c,'calendar:read'))return c.json(403,{error:'Missing permission: calendar:read'});
    }
    var statusError=memberStatusError(auth);
    if(statusError)return c.json(403,{error:statusError});
    if(!String(auth.get('family_id')||''))return c.json(400,{error:'User has no family'});

    var calendarName='todoless';
    try{calendarName='todoless · '+String($app.findRecordById('families',String(auth.get('family_id'))).get('name')||'').trim();}catch(e){}
    var feed=require(__hooks+'/lib/ics-feed.js').buildFamilyCalendar(auth,{stableStamp:true,calendarName:calendarName});
    var etag='"'+$security.sha256(feed.ics)+'"';
    var headers=info.headers||{};
    c.response.header().set('ETag',etag);
    c.response.header().set('Cache-Control','private, no-cache');
    if(feed.lastModifiedMs>0)c.response.header().set('Last-Modified',new Date(feed.lastModifiedMs).toUTCString());
    if(String(headers.if_none_match||'')===etag)return c.noContent(304);
    return c.blob(200,'text/calendar; charset=utf-8',feed.ics);
  }catch(e){
    return errorsLib.respondError(c,e,500);
  }
});
