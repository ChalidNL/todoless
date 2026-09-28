/// <reference path="../../pb_data/types.d.ts" />

// ── Daily Briefing ──
// POST /api/v1/briefing/generate — generate a new briefing for the authenticated user
routerAdd('POST', '/api/v1/briefing/generate', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    var userId = auth.id;
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    var weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    var todayIso = todayStart.toISOString();
    var todayEndIso = todayEnd.toISOString();
    var weekEndIso = weekEnd.toISOString();
    var yesterdayIso = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000).toISOString();

    var fid = String(auth.get('family_id') || '').trim();
    var f = fid ? 'user.family_id = "' + fid + '"' : 'user = "' + userId + '"';

    // Tasks due today
    var tasksDueToday = $app.findRecordsByFilter(
      'tasks',
      f + '&&due_date >= "' + todayIso + '"&&due_date < "' + todayEndIso + '"&&status != "done"',
      'priority,-due_date', 0, 0
    ).map(function(r) {
      return {
        id: r.id,
        title: r.get('title') || '',
        status: r.get('status') || 'todo',
        priority: r.get('priority') || 'normal',
        due_date: r.get('due_date'),
        labels: r.get('labels') || [],
        assigned_to: r.get('assigned_to') || '',
      };
    });

    // Overdue tasks (past due date, not done)
    var overdueTasks = $app.findRecordsByFilter(
      'tasks',
      f + '&&due_date < "' + todayIso + '"&&status != "done"',
      'priority,-due_date', 0, 0
    ).map(function(r) {
      return {
        id: r.id,
        title: r.get('title') || '',
        status: r.get('status') || 'todo',
        priority: r.get('priority') || 'normal',
        due_date: r.get('due_date'),
        labels: r.get('labels') || [],
        assigned_to: r.get('assigned_to') || '',
      };
    });

    // Tasks due this week (today to +7 days, not done, not already due today)
    var tasksDueThisWeek = $app.findRecordsByFilter(
      'tasks',
      f + '&&due_date >= "' + todayEndIso + '"&&due_date < "' + weekEndIso + '"&&status != "done"',
      'priority,-due_date', 0, 0
    ).map(function(r) {
      return {
        id: r.id,
        title: r.get('title') || '',
        status: r.get('status') || 'todo',
        priority: r.get('priority') || 'normal',
        due_date: r.get('due_date'),
        labels: r.get('labels') || [],
        assigned_to: r.get('assigned_to') || '',
      };
    });

    // Recently completed tasks (last 24 hours)
    var recentCompleted = $app.findRecordsByFilter(
      'tasks',
      f + '&&status = "done"&&completed_at >= "' + yesterdayIso + '"',
      '-completed_at', 0, 0
    ).map(function(r) {
      return {
        id: r.id,
        title: r.get('title') || '',
        completed_at: r.get('completed_at'),
        labels: r.get('labels') || [],
      };
    });

    // Upcoming reminders (next 7 days, not dismissed)
    var upcomingReminders = $app.findRecordsByFilter(
      'reminders',
      f + '&&reminder_time >= "' + todayIso + '"&&reminder_time < "' + weekEndIso + '"&&dismissed = false',
      'reminder_time', 0, 0
    ).map(function(r) {
      return {
        id: r.id,
        title: r.get('title') || '',
        message: r.get('message') || '',
        reminder_time: r.get('reminder_time'),
        repeat_interval: r.get('repeat_interval') || null,
        linked_type: r.get('linked_type') || null,
        linked_to: r.get('linked_to') || null,
      };
    });

    var briefing = {
      generated_at: now.toISOString(),
      user_id: userId,
      tasks_due_today: tasksDueToday,
      overdue_tasks: overdueTasks,
      tasks_due_this_week: tasksDueThisWeek,
      recently_completed: recentCompleted,
      upcoming_reminders: upcomingReminders,
      summary: {
        total_due_today: tasksDueToday.length,
        total_overdue: overdueTasks.length,
        total_due_this_week: tasksDueThisWeek.length,
        total_completed_today: recentCompleted.length,
        total_reminders: upcomingReminders.length,
      }
    };

    // Store/update cached briefing
    var existingBriefings = $app.findRecordsByFilter(
      'briefings',
      'user = "' + userId + '"',
      '-generated_at', 1, 0
    );

    var coll = $app.findCollectionByNameOrId('briefings');
    var rec = existingBriefings.length > 0 ? existingBriefings[0] : new Record(coll);
    rec.set('user', userId);
    rec.set('data', JSON.stringify(briefing));
    rec.set('generated_at', now.toISOString());
    rec.set('date', todayStart.toISOString().split('T')[0]); // YYYY-MM-DD for daily dedup
    $app.save(rec);

    return c.json(200, briefing);
  } catch(e) { return respondError(c, e, 500); }
});

// ── GET /api/v1/briefing — get today's cached briefing ──
routerAdd('GET', '/api/v1/briefing', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    var userId = auth.id;
    var today = new Date();
    var todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // Find today's briefing
    var todays = $app.findRecordsByFilter(
      'briefings',
      'user = "' + userId + '"&&date = "' + todayStr + '"',
      '-generated_at', 1, 0
    );

    if (todays.length === 0) {
      return c.json(404, { error: 'No briefing found for today. Use POST /briefing/generate first.' });
    }

    var cached = todays[0];
    var data = cached.get('data');
    var briefing = null;
    try { briefing = JSON.parse(data); } catch(e) { briefing = null; }

    return c.json(200, {
      id: cached.id,
      generated_at: cached.get('generated_at'),
      date: cached.get('date'),
      briefing: briefing,
    });
  } catch(e) { return respondError(c, e, 500); }
});

// ── DELETE /api/v1/briefing — clear today's cached briefing ──
routerAdd('DELETE', '/api/v1/briefing', (c) => {
  try {
    var info = c.requestInfo();
    var auth = info && info.auth ? info.auth : null;
    if (!auth) return c.json(401, { error: 'Unauthorized' });

    var userId = auth.id;
    var todayStr = new Date().toISOString().split('T')[0];

    var todays = $app.findRecordsByFilter(
      'briefings',
      'user = "' + userId + '"&&date = "' + todayStr + '"',
      '-generated_at', 1, 0
    );

    if (todays.length > 0) {
      $app.delete(todays[0]);
    }

    return c.json(200, { deleted: true });
  } catch(e) { return respondError(c, e, 500); }
});