// pb_hooks/14_ics.pb.js
// ICS import/export endpoints for todoless tasks.
// Import: client parses .ics with ical.js, sends VEVENTs as JSON.
// Export: generates .ics from tasks with due dates/times.

// ─── Inline helpers (PB 0.35 Goja: each callback needs its own copies) ──

// Safe value getter with fallback
var _gv = function(o,k,f) {
  if(f===undefined)f='';
  if(!o)return f;
  if(Object.prototype.hasOwnProperty.call(o,k)){
    var v=o[k]; return(v===undefined||v===null)?f:v;
  }
  return f;
};

// Format date to ICS UTC format: 20260621T090000Z
var _icsDt = function(ts) {
  if(!ts)return'';
  try{
    var d=new Date(ts);
    if(isNaN(d.getTime()))return'';
    var y=d.getUTCFullYear();
    var M=String(d.getUTCMonth()+1).padStart(2,'0');
    var day=String(d.getUTCDate()).padStart(2,'0');
    var h=String(d.getUTCHours()).padStart(2,'0');
    var m=String(d.getUTCMinutes()).padStart(2,'0');
    var s=String(d.getUTCSeconds()).padStart(2,'0');
    return y+M+day+'T'+h+m+s+'Z';
  }catch(e){return'';}
};

// UTF-8 octet length of a string (RFC 5545 s3.1 folds by octets, not chars).
var _octets = function(s) {
  var n=0;
  for(var i=0;i<s.length;i++){
    var c=s.charCodeAt(i);
    if(c<=0x7F){n+=1;}
    else if(c<=0x7FF){n+=2;}
    else if(c>=0xD800&&c<=0xDBFF&&i+1<s.length){
      var lo=s.charCodeAt(i+1);
      if(lo>=0xDC00&&lo<=0xDFFF){n+=4;i++;}
      else{n+=3;}
    }
    else{n+=3;}
  }
  return n;
};

// Length of one code point at text[i]: returns [utf8 octets, js chars].
var _cpLen = function(text,i) {
  var c=text.charCodeAt(i);
  if(c<=0x7F)return[1,1];
  if(c<=0x7FF)return[2,1];
  if(c>=0xD800&&c<=0xDBFF&&i+1<text.length){
    var lo=text.charCodeAt(i+1);
    if(lo>=0xDC00&&lo<=0xDFFF)return[4,2];
  }
  return[3,1];
};

// Escape ICS TEXT, then fold the full "NAME:value" line at 75 octets per
// RFC 5545 s3.1. Folding counts the property name (so long SUMMARY/DESCRIPTION
// lines stay within the limit) and the UTF-8 octets of the value (multibyte
// chars cannot smuggle a physical line over 75 octets). Continuation lines
// start with a space and carry up to 74 more octets (75 total incl. the fold
// space); folding never splits a multi-byte UTF-8 sequence. Literal CR is
// escaped like LF, so Windows newlines in values cannot emit control chars.
var _icsLine = function(name,value) {
  if(value===undefined||value===null)value='';
  var text=String(value).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'\\r').replace(/\n/g,'\\n');
  return _icsFold(name+':',text);
};

// Fold a NON-TEXT content line (e.g. RRULE, whose RECUR grammar is not a TEXT
// value) at 75-octet boundaries per RFC 5545 s3.1, reusing the same octet-aware
// fold machinery as _icsLine. NO TEXT escaping is applied — RRULE separators
// (';' between rule parts, ',' in lists, '=' in name=value pairs) must stay
// literal. Control characters are scrubbed first (the RRULE grammar has no
// newlines; a stored value with raw \n or \r must not leak control chars into
// the content line). Returns '' when nothing remains after scrubbing, so the
// caller can skip an empty RRULE line.
var _icsLineRaw = function(name,value) {
  if(value===undefined||value===null)value='';
  var text=String(value).replace(/[\x00-\x1F\x7F]/g,'');
  if(!text)return'';
  return _icsFold(name+':',text);
};

// Shared fold loop: pack the prefix then the value into physical lines of at
// most 75 UTF-8 octets (RFC 5545 s3.1). Continuation lines start with a space
// and carry up to 74 octets (75 total incl. the fold space); folding never
// splits a multi-byte UTF-8 sequence.
var _icsFold = function(prefix,text) {
  var out=prefix;
  var cur=_octets(prefix);
  var p=0;
  while(p<text.length){
    var cp=_cpLen(text,p);
    if(cur+cp[0]<=75){
      out+=text.substring(p,p+cp[1]);
      cur+=cp[0];
    }else{
      out+='\r\n '+text.substring(p,p+cp[1]);
      cur=1+cp[0];
    }
    p+=cp[1];
  }
  return out;
};

// Normalize a PB date value (string like "2026-09-28 00:00:00.000Z" or Date)
// to a UTC ms instant. Values without an explicit timezone suffix are treated
// as UTC so parsing never depends on the server's local TZ.
var _toUtcMs = function(v) {
  if(!v)return NaN;
  try{
    if(typeof v.getTime==='function'){var gt=v.getTime();return isNaN(gt)?NaN:gt;}
  }catch(e){}
  var s=String(v).replace(' ','T').trim();
  if(!/Z$/i.test(s)&&!/[+-]\d{2}:?\d{2}$/.test(s))s+='Z';
  var d=new Date(s);
  return isNaN(d.getTime())?NaN:d.getTime();
};

// Milliseconds of the last Sunday at <hour>:00 UTC in <month> (0-based).
var _lastSundayUtc = function(year,month,hour) {
  var last=new Date(Date.UTC(year,month+1,0)); // day 0 of next month = last day
  var back=last.getUTCDay();                   // walk back to Sunday
  return Date.UTC(year,month,last.getUTCDate()-back,hour,0,0,0);
};

// Calendar date (y/M/d) of a UTC instant in Europe/Amsterdam — the app default
// timezone and the zone UI-created all-day dates are entered in. Amsterdam is
// UTC+1 (CET) with UTC+2 (CEST) from the last Sunday of March 01:00 UTC to the
// last Sunday of October 01:00 UTC. Hardcoding these rules keeps /api/ics-export
// deterministic on every server regardless of its local TZ; UI all-day tasks are
// stored as local-midnight→UTC and ICS imports as midnight UTC, both of which
// resolve to the intended calendar date in Amsterdam.
var _amsterdamYmd = function(ms) {
  var d=new Date(ms);
  var y=d.getUTCFullYear();
  var dstStart=_lastSundayUtc(y,2,1);
  var dstEnd=_lastSundayUtc(y,9,1);
  var off=(ms>=dstStart&&ms<dstEnd)?2:1;
  var local=new Date(ms+off*3600000);
  var yy=local.getUTCFullYear();
  var MM=String(local.getUTCMonth()+1).padStart(2,'0');
  var dd=String(local.getUTCDate()).padStart(2,'0');
  return {y:yy,M:MM,d:dd,key:yy+'-'+MM+'-'+dd};
};

// Generate a stable UID for tasks without one
var _genUid = function(taskId,familyId) {
  return 'todoless-'+String(taskId)+'@family-'+String(familyId);
};

// ─── POST /api/ics-import — Import parsed VEVENTs as tasks ──────────
routerAdd('POST','/api/ics-import',function(c){
  function gv(o,k,f){if(f===undefined)f='';if(!o)return f;if(Object.prototype.hasOwnProperty.call(o,k)){var v=o[k];return(v===undefined||v===null)?f:v;}return f;}
  function canAccessTaskForUser(record,user){if(!record||!user)return false;var userId=user.id;var ownerId=String(record.get('user')||'');if(ownerId===userId)return true;if(record.get('is_private')===true||record.get('is_private')===1||record.get('is_private')==='true')return false;var familyId=String(user.get('family_id')||'');if(!familyId||!ownerId)return false;try{if(String($app.findRecordById('users',ownerId).get('family_id')||'')!==familyId)return false;}catch(e){return false;}var labelIds=record.get('label')||record.get('labels')||[];if(!Array.isArray(labelIds))labelIds=labelIds?[String(labelIds)]:[];var labels=[];for(var i=0;i<labelIds.length;i++){try{labels.push($app.findRecordById('labels',String(labelIds[i]||'')));}catch(e){return false;}}if(labelIds.length>1){for(var mi=0;mi<labels.length;mi++){var mv=String(labels[mi].get('visibility')||(labels[mi].get('is_private')?'private':'family'));if(mv!=='family')return false;}}for(var li=0;li<labels.length;li++){var label=labels[li];var visibility=String(label.get('visibility')||(label.get('is_private')?'private':'family'));var labelOwner=String(label.get('owner')||label.get('user')||'');var labelFamily=String(label.get('family')||'');if(!labelFamily&&labelOwner){try{labelFamily=String($app.findRecordById('users',labelOwner).get('family_id')||'');}catch(e){return false;}}if(visibility==='private'&&labelOwner!==userId)return false;if(visibility==='shared'){var shared=label.get('shared_with')||[];if(!Array.isArray(shared))shared=shared?[String(shared)]:[];if(labelOwner!==userId&&shared.indexOf(userId)===-1)return false;}if(visibility==='family'&&labelFamily!==familyId)return false;}return true;}
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
          if(rrule)existing.set('rrule',rrule);
          if(exdates)existing.set('exdates',exdates);
          if(recurrenceId)existing.set('recurrence_id',recurrenceId);
          existing.set('source','ics_import');
          existing.set('external_id',uid);
          if(assignee&&assignee!==existing.get('assigned_to')){
            existing.set('assigned_to',assignee);
          }
          existing.set('labels',uniqueLabels);
          existing.set('label',uniqueLabels);
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
          if(rrule)rec.set('rrule',rrule);
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
  function icsDt(ts){if(!ts)return'';try{var d=new Date(ts);if(isNaN(d.getTime()))return'';return d.getUTCFullYear()+String(d.getUTCMonth()+1).padStart(2,'0')+String(d.getUTCDate()).padStart(2,'0')+'T'+String(d.getUTCHours()).padStart(2,'0')+String(d.getUTCMinutes()).padStart(2,'0')+String(d.getUTCSeconds()).padStart(2,'0')+'Z';}catch(e){return'';}}
  function octets(s){var n=0;for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c<=0x7F){n+=1;}else if(c<=0x7FF){n+=2;}else if(c>=0xD800&&c<=0xDBFF&&i+1<s.length){var lo=s.charCodeAt(i+1);if(lo>=0xDC00&&lo<=0xDFFF){n+=4;i++;}else{n+=3;}}else{n+=3;}}return n;}
  function cpLen(text,i){var c=text.charCodeAt(i);if(c<=0x7F)return[1,1];if(c<=0x7FF)return[2,1];if(c>=0xD800&&c<=0xDBFF&&i+1<text.length){var lo=text.charCodeAt(i+1);if(lo>=0xDC00&&lo<=0xDFFF)return[4,2];}return[3,1];}
  function icsFold(prefix,text){var out=prefix;var cur=octets(prefix);var p=0;while(p<text.length){var cp=cpLen(text,p);if(cur+cp[0]<=75){out+=text.substring(p,p+cp[1]);cur+=cp[0];}else{out+='\r\n '+text.substring(p,p+cp[1]);cur=1+cp[0];}p+=cp[1];}return out;}
  function icsLine(name,value){if(value===undefined||value===null)value='';var text=String(value).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'\\r').replace(/\n/g,'\\n');return icsFold(name+':',text);}
  function icsLineRaw(name,value){if(value===undefined||value===null)value='';var text=String(value).replace(/[\x00-\x1F\x7F]/g,'');if(!text)return'';return icsFold(name+':',text);}
  function lastSundayUtc(year,month,hour){var last=new Date(Date.UTC(year,month+1,0));var back=last.getUTCDay();return Date.UTC(year,month,last.getUTCDate()-back,hour,0,0,0);}
  function amsterdamYmd(ms){var d=new Date(ms);var y=d.getUTCFullYear();var dstStart=lastSundayUtc(y,2,1);var dstEnd=lastSundayUtc(y,9,1);var off=(ms>=dstStart&&ms<dstEnd)?2:1;var local=new Date(ms+off*3600000);var yy=local.getUTCFullYear();var MM=String(local.getUTCMonth()+1).padStart(2,'0');var dd=String(local.getUTCDate()).padStart(2,'0');return{y:yy,M:MM,d:dd,key:yy+'-'+MM+'-'+dd};}
  function toUtcMs(v){if(!v)return NaN;try{if(typeof v.getTime==='function'){var gt=v.getTime();return isNaN(gt)?NaN:gt;}}catch(e){}var s=String(v).replace(' ','T').trim();if(!/Z$/i.test(s)&&!/[+-]\d{2}:?\d{2}$/.test(s))s+='Z';var d=new Date(s);return isNaN(d.getTime())?NaN:d.getTime();}
  function genUid(taskId,familyId){return'todoless-'+String(taskId)+'@family-'+String(familyId);}
  function canAccessTaskForUser(record,user){if(!record||!user)return false;var userId=user.id;var ownerId=String(record.get('user')||'');if(ownerId===userId)return true;if(record.get('is_private')===true||record.get('is_private')===1||record.get('is_private')==='true')return false;var familyId=String(user.get('family_id')||'');if(!familyId||!ownerId)return false;try{if(String($app.findRecordById('users',ownerId).get('family_id')||'')!==familyId)return false;}catch(e){return false;}var labelIds=record.get('label')||record.get('labels')||[];if(!Array.isArray(labelIds))labelIds=labelIds?[String(labelIds)]:[];var labels=[];for(var i=0;i<labelIds.length;i++){try{labels.push($app.findRecordById('labels',String(labelIds[i]||'')));}catch(e){return false;}}if(labelIds.length>1){for(var mi=0;mi<labels.length;mi++){var mv=String(labels[mi].get('visibility')||(labels[mi].get('is_private')?'private':'family'));if(mv!=='family')return false;}}for(var li=0;li<labels.length;li++){var label=labels[li];var visibility=String(label.get('visibility')||(label.get('is_private')?'private':'family'));var labelOwner=String(label.get('owner')||label.get('user')||'');var labelFamily=String(label.get('family')||'');if(!labelFamily&&labelOwner){try{labelFamily=String($app.findRecordById('users',labelOwner).get('family_id')||'');}catch(e){return false;}}if(visibility==='private'&&labelOwner!==userId)return false;if(visibility==='shared'){var shared=label.get('shared_with')||[];if(!Array.isArray(shared))shared=shared?[String(shared)]:[];if(labelOwner!==userId&&shared.indexOf(userId)===-1)return false;}if(visibility==='family'&&labelFamily!==familyId)return false;}return true;}
  // Empty PocketBase date fields are truthy DateTime objects in the JSVM
  // (isZero() === true, String() === ''), so truthiness can never be used to
  // detect a real date (GH#11). Returns true only when the field holds one.
  function hasDate(record,field){
    try{
      var v=record.get(field);
      if(!v)return false;
      if(typeof v==='object'&&typeof v.isZero==='function')return !v.isZero();
      return String(v).trim()!=='';
    }catch(e){return false;}
  }
  try{
    var info=c.requestInfo();
    var auth=(info&&info.auth)||c.get('authRecord')||null;
    if(!auth)return c.json(401,{error:'Unauthorized'});

    var familyId=String(auth.get('family_id')||'');
    if(!familyId)return c.json(400,{error:'User has no family'});

    // Optional date range filter
    var query=info.query||{};
    var startParam=String(query.start||'').trim();
    var endParam=String(query.end||'').trim();

    // Fetch dated tasks from the family, then enforce the same privacy contract
    // as direct collection and custom task APIs.
    var queryParams={familyId:familyId};
    var filter='user.family_id = {:familyId} && due_date != ""';
    var filter2='user.family_id = {:familyId} && start_time != ""';
    if(startParam&&endParam){
      queryParams.start=startParam;
      queryParams.end=endParam;
      filter+=' && due_date >= {:start} && due_date <= {:end}';
      filter2+=' && start_time >= {:start} && start_time <= {:end}';
    }

    var tasks=[];
    try{var t1=$app.findRecordsByFilter('tasks',filter,'',10000,0,queryParams);if(t1&&t1.length)for(var i=0;i<t1.length;i++)tasks.push(t1[i]);}catch(e){}
    try{var t2=$app.findRecordsByFilter('tasks',filter2,'',10000,0,queryParams);if(t2&&t2.length)for(var j=0;j<t2.length;j++){var already=false;for(var k=0;k<tasks.length;k++){if(tasks[k].id===t2[j].id){already=true;break;}}if(!already)tasks.push(t2[j]);}}catch(e){}
    tasks=tasks.filter(function(task){return canAccessTaskForUser(task,auth);});

    // Generate ICS
    var ics='BEGIN:VCALENDAR\r\n';
    ics+='VERSION:2.0\r\n';
    ics+='PRODID:-//todoless//EN\r\n';
    ics+='CALSCALE:GREGORIAN\r\n';
    ics+='METHOD:PUBLISH\r\n';

    for(var ti=0;ti<tasks.length;ti++){
      var t=tasks[ti];
      var uid=t.get('uid')||genUid(t.id,familyId);
      var title=String(t.get('title')||'Untitled');
      var desc=t.get('description')||'';
      var loc=t.get('location')||'';
      var tz=t.get('timezone')||'Europe/Amsterdam';
      var rrule=t.get('rrule')||'';
      var allDay=t.get('all_day');

      var dtStart='';
      var dtEnd='';

      // Empty PB date fields are truthy DateTime objects in the JSVM, so the
      // old `t.get('start_time') || t.get('due_date')` fallback never fired
      // and due-date-only tasks were dropped (GH#12). Detect real dates with
      // hasDate() and prefer start_time, falling back to due_date.
      var hasStart=hasDate(t,'start_time');
      var hasDue=hasDate(t,'due_date');
      var hasEnd=hasDate(t,'end_time');

      if(allDay){
        // All-day: DATE format (no time). RFC 5545: DTEND;VALUE=DATE is EXCLUSIVE,
        // so a single-day event must end on the NEXT day. Dates are derived in
        // Europe/Amsterdam (deterministic, not the server's local TZ).
        var sd=hasStart?t.get('start_time'):(hasDue?t.get('due_date'):'');
        var ed=hasEnd?t.get('end_time'):'';
        var sdMs=toUtcMs(sd);
        if(!isNaN(sdMs)){
          var sdY=amsterdamYmd(sdMs);
          dtStart=sdY.y+sdY.M+sdY.d;
          // Use the stored end date only when it is a real LATER day (imports store
          // the exclusive DTEND, so it is already the day after the last event day).
          var edMs=toUtcMs(ed);
          if(!isNaN(edMs)){
            var edY=amsterdamYmd(edMs);
            if(edY.key>sdY.key)dtEnd=edY.y+edY.M+edY.d;
          }
          if(!dtEnd){
            // No explicit end (or end == start day): exclusive DTEND = start + 1 day
            var next=new Date(Date.UTC(sdY.y,sdY.M-1,Number(sdY.d)+1));
            dtEnd=next.getUTCFullYear()+String(next.getUTCMonth()+1).padStart(2,'0')+String(next.getUTCDate()).padStart(2,'0');
          }
        }
      }else{
        // Timed event: DATE-TIME in UTC. Fall back to due_date when the task
        // has no start_time so due-date-only tasks are exported too (GH#12).
        var st=hasStart?t.get('start_time'):(hasDue?t.get('due_date'):'');
        var et=hasEnd?t.get('end_time'):'';
        var stMs=toUtcMs(st);
        if(!isNaN(stMs)){
          dtStart=icsDt(stMs);
        }
        var etMs=toUtcMs(et);
        if(!isNaN(etMs)){
          dtEnd=icsDt(etMs);
        }
      }

      if(!dtStart)continue; // Skip tasks without valid dates

      ics+='BEGIN:VEVENT\r\n';
      ics+=icsLine('UID',uid)+'\r\n';
      ics+='DTSTAMP:'+icsDt(Date.now())+'\r\n';
      if(allDay){
        ics+='DTSTART;VALUE=DATE:'+dtStart+'\r\n';
        if(dtEnd)ics+='DTEND;VALUE=DATE:'+dtEnd+'\r\n';
      }else{
        ics+='DTSTART:'+dtStart+'\r\n';
        // DTEND is optional for timed events; emit it only when a real end
        // exists so the feed never carries an empty DTEND: line.
        if(dtEnd)ics+='DTEND:'+dtEnd+'\r\n';
      }
      ics+=icsLine('SUMMARY',title)+'\r\n';
      if(desc)ics+=icsLine('DESCRIPTION',desc)+'\r\n';
      if(loc)ics+=icsLine('LOCATION',loc)+'\r\n';
      var rrLine=rrule?icsLineRaw('RRULE',rrule):'';
      if(rrLine)ics+=rrLine+'\r\n';
      ics+='END:VEVENT\r\n';
    }

    ics+='END:VCALENDAR\r\n';

    return c.json(200,{
      ics:ics,
      count:tasks.length,
    });
  }catch(e){
    return require(__hooks + '/lib/errors.js').respondError(c, e, 500);
  }
});
