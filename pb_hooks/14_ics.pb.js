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

// Escape ICS text (fold long lines at 75 chars per RFC 5545)
var _icsEscape = function(t) {
  if(!t)return'';
  t=String(t).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
  // Fold lines longer than 75 chars
  if(t.length<=75)return t;
  var out='';
  while(t.length>75){
    out+=t.substring(0,75)+'\r\n ';
    t=t.substring(75);
  }
  out+=t;
  return out;
};

// Generate a stable UID for tasks without one
var _genUid = function(taskId,familyId) {
  return 'todoless-'+String(taskId)+'@family-'+String(familyId);
};

// ─── POST /api/ics-import — Import parsed VEVENTs as tasks ──────────
routerAdd('POST','/api/ics-import',function(c){
  try{
    // Auth
    var info=c.requestInfo();
    var body=_gv(info,'data')||_gv(info,'body')||{};
    var auth=info.auth||c.auth;
    if(!auth)return c.json(401,{error:'Unauthorized'});

    var familyId=String(auth.get('family_id')||'');
    if(!familyId)return c.json(400,{error:'User has no family — cannot import'});

    var events=_gv(body,'events');
    if(!events||typeof events.length==='undefined'||events.length===0){
      return c.json(400,{error:'No events to import'});
    }

    var options=_gv(body,'options')||{};
    var bulkAssignee=_gv(options,'assignee');
    var bulkLabels=_gv(options,'labels')||[];

    var results={created:0,updated:0,skipped:0,errors:[],items:[]};
    var tasksColl=$app.findCollectionByNameOrId('tasks');
    var batchSize=50;
    var totalProcessed=0;

    for(var i=0;i<events.length;i++){
      var ev=events[i];
      if(!ev||!ev.title){results.skipped++;continue;}

      var uid=String(_gv(ev,'uid','')).trim();
      var title=String(_gv(ev,'title','')).trim();
      if(!title){results.skipped++;continue;}

      // Check for existing task with same uid in this family
      var existing=null;
      if(uid){
        // Search for tasks with same uid AND whose owner is in the same family
        var flt='uid=\\\"'+uid.replace(/\\/g,'\\\\').replace(/\\"/g,'\\\\"')+'\\\" && user.family_id=\\\"'+familyId+'\\\"';
        var existingList=$app.findRecordsByFilter('tasks',flt,'',1,0);
        // Goja findRecordsByFilter might return empty when limit=0; try with explicit limit
        if(existingList.length===0){
          var existingList2=$app.findRecordsByFilter('tasks',flt,'',100,0);
          if(existingList2.length>0)existing=existingList2[0];
        }else{
          existing=existingList[0];
        }
      }

      // Parse dates
      var startTime=ev.start_time||null;
      var endTime=ev.end_time||null;
      var allDay=!!ev.all_day;
      var description=_gv(ev,'description');
      var location=_gv(ev,'location');
      var timezone=_gv(ev,'timezone');
      var rrule=_gv(ev,'rrule');
      var exdates=ev.exdates||null;
      var recurrenceId=_gv(ev,'recurrence_id');

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

      var assignee=bulkAssignee||_gv(ev,'assigned_to')||ev.assignedTo||auth.id;

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
          rec.set('is_private',false);
          $app.save(rec);
          results.created++;
          results.items.push({uid:uid,title:title,action:'created',id:rec.id});
        }
      }catch(e2){
        results.errors.push({uid:uid,title:title,error:String(e2)});
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
    return c.json(500,{error:String(e)});
  }
});

// ─── GET /api/ics-export — Export tasks as .ics ─────────────────────
routerAdd('GET','/api/ics-export',function(c){
  try{
    var info=c.requestInfo();
    var auth=info.auth||c.auth;
    if(!auth)return c.json(401,{error:'Unauthorized'});

    var familyId=String(auth.get('family_id')||'');
    if(!familyId)return c.json(400,{error:'User has no family'});

    // Optional date range filter
    var startParam=c.queryParam('start');
    var endParam=c.queryParam('end');

    // Fetch tasks with dates from this user's family
    var filter='user.family_id=\\\"'+familyId+'\\\" && due_date!=\\\"\\\"';
    if(startParam&&endParam){
      filter+=' && due_date>=\\\"'+startParam+'\\\" && due_date<=\\\"'+endParam+'\\\"';
    }
    // Also get tasks with start_time
    var filter2='user.family_id=\\\"'+familyId+'\\\" && start_time!=\\\"\\\"';
    if(startParam&&endParam){
      filter2+=' && start_time>=\\\"'+startParam+'\\\" && start_time<=\\\"'+endParam+'\\\"';
    }

    var tasks=[];
    try{var t1=$app.findRecordsByFilter('tasks',filter,'',10000,0);if(t1&&t1.length)for(var i=0;i<t1.length;i++)tasks.push(t1[i]);}catch(e){}
    try{var t2=$app.findRecordsByFilter('tasks',filter2,'',10000,0);if(t2&&t2.length)for(var j=0;j<t2.length;j++){var already=false;for(var k=0;k<tasks.length;k++){if(tasks[k].id===t2[j].id){already=true;break;}}if(!already)tasks.push(t2[j]);}}catch(e){}

    // Generate ICS
    var ics='BEGIN:VCALENDAR\r\n';
    ics+='VERSION:2.0\r\n';
    ics+='PRODID:-//todoless//EN\r\n';
    ics+='CALSCALE:GREGORIAN\r\n';
    ics+='METHOD:PUBLISH\r\n';

    for(var ti=0;ti<tasks.length;ti++){
      var t=tasks[ti];
      var uid=t.get('uid')||_genUid(t.id,familyId);
      var title=String(t.get('title')||'Untitled');
      var desc=t.get('description')||'';
      var loc=t.get('location')||'';
      var tz=t.get('timezone')||'Europe/Amsterdam';
      var rrule=t.get('rrule')||'';
      var allDay=t.get('all_day');

      var dtStart='';
      var dtEnd='';

      if(allDay){
        // All-day: DATE format (no time)
        var sd=t.get('start_time')||t.get('due_date');
        var ed=t.get('end_time')||sd;
        if(sd){
          try{
            var d=new Date(String(sd).replace(' ','T'));
            if(!isNaN(d.getTime())){
              var y=d.getFullYear();
              var M=String(d.getMonth()+1).padStart(2,'0');
              var day=String(d.getDate()).padStart(2,'0');
              dtStart=y+M+day;
              // For end date: all-day in iCal ends on the NEXT day
              if(ed&&ed!==sd){
                try{
                  var d2=new Date(String(ed).replace(' ','T'));
                  if(!isNaN(d2.getTime())){
                    var y2=d2.getFullYear();
                    var M2=String(d2.getMonth()+1).padStart(2,'0');
                    var day2=String(d2.getDate()).padStart(2,'0');
                    dtEnd=y2+M2+day2;
                  }
                }catch(ex){}
              }
              if(!dtEnd){
                // Default: same day
                dtEnd=y+M+day;
              }
            }
          }catch(ex2){}
        }
      }else{
        // Timed event: DATE-TIME in UTC
        var st=t.get('start_time');
        var et=t.get('end_time');
        if(st){
          try{
            var stDate=new Date(String(st).replace(' ','T'));
            if(!isNaN(stDate.getTime())){
              dtStart=_icsDt(stDate.getTime());
            }
          }catch(ex3){}
        }
        if(et){
          try{
            var etDate=new Date(String(et).replace(' ','T'));
            if(!isNaN(etDate.getTime())){
              dtEnd=_icsDt(etDate.getTime());
            }
          }catch(ex4){}
        }
      }

      if(!dtStart)continue; // Skip tasks without valid dates

      ics+='BEGIN:VEVENT\r\n';
      ics+='UID:'+_icsEscape(uid)+'\r\n';
      ics+='DTSTAMP:'+_icsDt(Date.now())+'\r\n';
      if(allDay){
        ics+='DTSTART;VALUE=DATE:'+dtStart+'\r\n';
        ics+='DTEND;VALUE=DATE:'+dtEnd+'\r\n';
      }else{
        ics+='DTSTART:'+dtStart+'\r\n';
        ics+='DTEND:'+dtEnd+'\r\n';
      }
      ics+='SUMMARY:'+_icsEscape(title)+'\r\n';
      if(desc)ics+='DESCRIPTION:'+_icsEscape(desc)+'\r\n';
      if(loc)ics+='LOCATION:'+_icsEscape(loc)+'\r\n';
      if(rrule)ics+='RRULE:'+rrule+'\r\n';
      ics+='END:VEVENT\r\n';
    }

    ics+='END:VCALENDAR\r\n';

    return c.json(200,{
      ics:ics,
      count:tasks.length,
    });
  }catch(e){
    return c.json(500,{error:String(e)});
  }
});
