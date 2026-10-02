// Shared ICS generation for GET /api/ics-export (JSON-wrapped download for the
// app) and GET /api/calendar.ics (subscribable feed, #100). Moved verbatim
// from 14_ics.pb.js so both produce the same, privacy-checked VEVENTs.
//
// buildFamilyCalendar(auth, { start, end, stableStamp }) returns
// { ics, count, lastModifiedMs }. With stableStamp, DTSTAMP is each task's
// last update instead of "now", so an unchanged calendar produces an
// identical body (stable ETag for cheap polling).

function buildFamilyCalendar(auth, opts) {
  opts = opts || {};
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

  var familyId = String(auth.get('family_id') || '');
  var startParam = String(opts.start || '').trim();
  var endParam = String(opts.end || '').trim();
  var lastModifiedMs = 0;
  function stampFor(task) {
    if (!opts.stableStamp) return Date.now();
    var ms = toUtcMs(task.get('updated'));
    return isNaN(ms) ? 0 : ms;
  }

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
    if(opts.calendarName)ics+=icsLine('X-WR-CALNAME',opts.calendarName)+'\r\n';

    var emitted=0; // VEVENTs actually written (tasks without a usable date are skipped below)
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

      emitted++;
      ics+='BEGIN:VEVENT\r\n';
      ics+=icsLine('UID',uid)+'\r\n';
      ics+='DTSTAMP:'+icsDt(stampFor(t))+'\r\n';
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

  for (var mi = 0; mi < tasks.length; mi++) {
    var updatedMs = toUtcMs(tasks[mi].get('updated'));
    if (!isNaN(updatedMs) && updatedMs > lastModifiedMs) lastModifiedMs = updatedMs;
  }
  return { ics: ics, count: emitted, lastModifiedMs: lastModifiedMs };
}

module.exports = { buildFamilyCalendar: buildFamilyCalendar };
