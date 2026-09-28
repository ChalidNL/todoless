#!/usr/bin/env node
// ICS logic harness for pb_hooks/14_ics.pb.js (GET /api/ics-export).
//
// Verifies the RFC 5545 robustness guarantees:
//   1. Octet-accurate folding  — no physical line exceeds 75 UTF-8 octets,
//      even for multibyte values (é, emoji), and no multi-byte sequence is split.
//   2. CR escaping             — literal \r in text values is escaped (\\r),
//      so Windows newlines never emit raw control characters.
//   3. TZ-safe all-day dates   — DTSTART/DTEND;VALUE=DATE are derived in a
//      well-defined timezone (Europe/Amsterdam rules, the app default), NOT the
//      PB server's local TZ. The whole suite runs with TZ=America/Los_Angeles
//      (west of UTC) to prove server-TZ independence.
//
// Run:  node tests/ics-logic-test.js   (no dependencies)

'use strict';

// Deliberately west of UTC: the old getFullYear()/getDate() code produced
// shifted dates here, the new code must not.
process.env.TZ = 'America/Los_Angeles';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HOOK = path.join(__dirname, '..', 'pb_hooks', '14_ics.pb.js');

let passed = 0;
let failed = 0;
const failures = [];

function eq(actual, expected, label) {
  const a = String(actual);
  const e = String(expected);
  if (a === e) { passed++; }
  else { failed++; failures.push(`${label}\n    expected: ${e}\n    actual:   ${a}`); }
}
function ok(cond, label) { eq(cond ? true : false, true, label); }

// ---------------------------------------------------------------------------
// Load the REAL hook file so tests exercise the shipped code, not a copy.
// ---------------------------------------------------------------------------
const handlers = [];
const sandbox = {
  routerAdd: function (method, route, fn) { handlers.push({ method, route, fn }); },
  Record: function () {},
  console: { log: () => {}, error: () => {}, warn: () => {} },
  $app: null,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(HOOK, 'utf8'), sandbox, { filename: HOOK });

const exportHandler = handlers.find((h) => h.route === '/api/ics-export');
if (!exportHandler) { console.error('export handler not found'); process.exit(1); }

// Direct access to the top-level helpers (promoted to the vm global).
const { _octets, _icsLine, _icsLineRaw, _toUtcMs, _lastSundayUtc, _amsterdamYmd } = sandbox;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function utf8Len(s) { return Buffer.byteLength(s, 'utf8'); }

function unfoldLines(ics) {
  // RFC 5545 unfolding: remove CRLF + single WSP from folded content lines.
  return ics.replace(/\r\n[ \t]/g, '');
}

function driveExport(tasks, query) {
  const captures = [];
  const auth = { id: 'u1', get: (k) => (k === 'family_id' ? 'f1' : undefined) };
  sandbox.$app = {
    findRecordsByFilter: () => tasks,
    findRecordById: () => null,
  };
  const c = {
    requestInfo: () => ({ auth, query: query || {} }),
    get: () => null,
    json: (code, obj) => { captures.push({ code, obj }); return { code, obj }; },
  };
  exportHandler.fn(c);
  const out = captures[0];
  if (!out) throw new Error('export handler did not respond');
  return out;
}

function task(overrides) {
  const base = {
    id: 'task-' + Math.random().toString(36).slice(2, 10),
    get: function (k) { return this.map[k]; },
    map: { user: 'u1', title: 'T', uid: 'uid-' + Math.random().toString(36).slice(2, 8) },
  };
  Object.assign(base.map, overrides);
  return base;
}

function veventProps(ics) {
  const body = ics.slice(ics.indexOf('BEGIN:VEVENT'), ics.indexOf('END:VEVENT'));
  const lines = unfoldLines(body).split('\r\n').filter(Boolean);
  const props = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    props[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return props;
}

// ---------------------------------------------------------------------------
// 1. Octet-accurate folding
// ---------------------------------------------------------------------------
{
  const desc = 'é'.repeat(40); // 80 octets value + 12 octets "DESCRIPTION:" = 92
  const folded = _icsLine('DESCRIPTION', desc);
  const lines = folded.split('\r\n');
  const octets = lines.map(utf8Len);
  eq(lines.length, 2, '1. 40xé folds into exactly 2 physical lines');
  for (let i = 0; i < lines.length; i++) {
    eq(octets[i] <= 75, true, `1. é line ${i + 1} <= 75 octets (got ${octets[i]})`);
    const roundtrip = Buffer.from(lines[i], 'utf8').toString('utf8');
    eq(roundtrip, lines[i], `1. é line ${i + 1} round-trips without invalid UTF-8`);
  }
  eq(folded.replace(/\r\n /g, ''), 'DESCRIPTION:' + desc, '1. é fold content preserved (unfolded)');

  const emoji = '😀'.repeat(20); // 80 octets, surrogate pairs
  const ef = _icsLine('SUMMARY', emoji);
  const elines = ef.split('\r\n');
  ok(elines.every((l) => utf8Len(l) <= 75), '1. emoji lines all <= 75 octets');
  ok(!/[\uD800-\uDFFF]/.test(elines.join('|').replace(/[\uD800-\uDFFF][\uDC00-\uDFFF]/g, '')), '1. no lone surrogates after folding');
  eq(ef.replace(/\r\n /g, ''), 'SUMMARY:' + emoji, '1. emoji fold content preserved (unfolded)');

  const ascii = 'x'.repeat(100);
  const af = _icsLine('SUMMARY', ascii);
  ok(af.split('\r\n').every((l) => utf8Len(l) <= 75), '1. ascii fold all <= 75 octets');
  eq(af.split('\r\n').length, 2, '1. 100-char ascii folds to 2 lines');

  // Exact boundary: 75 octets total -> single line, no fold.
  const exact = _icsLine('SUMMARY', 'y'.repeat(75 - 8)); // 8-octet prefix
  eq(exact.split('\r\n').length, 1, '1. exactly-75 line does not fold');

  // Empty value.
  eq(_icsLine('SUMMARY', ''), 'SUMMARY:', '1. empty value yields bare property');

  // Continuation content must stay <= 74 octets after the leading fold space.
  const cont = _icsLine('DESCRIPTION', 'z'.repeat(70));
  const cl = cont.split('\r\n');
  eq(cl.length, 2, '1. 70-char desc with 12-octet prefix folds to 2 lines');
  eq(utf8Len(cl[0]) <= 75, true, `1. first desc line <= 75 (${utf8Len(cl[0])})`);
  eq(utf8Len(cl[1]) <= 75, true, `1. continuation line <= 75 incl fold space (${utf8Len(cl[1])})`);
}

// Regression detector: the OLD UTF-16 folding would overrun on multibyte values.
{
  const oldFold = (name, value) => {
    const line = name + ':' + value;
    if (line.length <= 75) return line;
    let out = '', pos = 0, take = 75;
    while (pos < line.length) { out += line.substring(pos, pos + take); pos += take; if (pos < line.length) { out += '\r\n '; take = 74; } }
    return out;
  };
  const old = oldFold('DESCRIPTION', 'é'.repeat(40));
  ok(old.split('\r\n').some((l) => utf8Len(l) > 75), 'detector: old UTF-16 folding exceeds 75 octets (test has teeth)');
}

// ---------------------------------------------------------------------------
// 2. CR escaping
// ---------------------------------------------------------------------------
{
  const s = 'line1\r\nline2\rline3';
  const out = _icsLine('DESCRIPTION', s);
  eq(out, 'DESCRIPTION:line1\\r\\nline2\\rline3', '2. CR and CRLF escaped as literals');
  ok(!out.includes('\r') || out.indexOf('\r') === out.indexOf('\r\n '), '2. no raw CR inside content (only fold CRLF)');
  ok(!out.includes('\n'), '2. no raw LF inside content');

  const lone = _icsLine('DESCRIPTION', 'a\rb\nc');
  eq(lone, 'DESCRIPTION:a\\rb\\nc', '2. lone CR and LF escaped');

  const existing = _icsLine('DESCRIPTION', 'back\\slash;semi,comma');
  eq(existing, 'DESCRIPTION:back\\\\slash\\;semi\\,comma', '2. backslash/semicolon/comma escapes preserved');
}

// ---------------------------------------------------------------------------
// 2b. RRULE (non-TEXT) line folding + control-char scrub
// ---------------------------------------------------------------------------
{
  // Long RRULE: value alone exceeds the 75-octet limit once "RRULE:" is added.
  const longRrule = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;UNTIL=20261231T235959Z;INTERVAL=2;WKST=SU;BYHOUR=9;BYMINUTE=30;BYSECOND=0';
  ok(utf8Len('RRULE:' + longRrule) > 75, '2b. long RRULE total line > 75 octets (test has teeth)');
  const folded = _icsLineRaw('RRULE', longRrule);
  const lines = folded.split('\r\n');
  ok(lines.every((l) => utf8Len(l) <= 75), '2b. every RRULE physical line <= 75 octets');
  ok(lines.length >= 2, '2b. long RRULE folds into >= 2 physical lines');
  eq(folded.replace(/\r\n /g, ''), 'RRULE:' + longRrule, '2b. RRULE fold preserves the exact value (unfolded)');

  // RRULE is NOT a TEXT value: separators must remain literal.
  ok(!folded.includes('\\;'), '2b. RRULE semicolons not escaped (non-TEXT)');
  ok(!folded.includes('\\,'), '2b. RRULE commas not escaped (non-TEXT)');
  ok(!folded.includes('\\\\'), '2b. RRULE backslashes not escaped (non-TEXT)');

  // Hostile RRULE: raw control chars scrubbed, no CR/LF leak into the line.
  const hostileOut = _icsLineRaw('RRULE', 'FREQ=DAILY\nCOUNT=5\rINTERVAL=2');
  ok(!hostileOut.includes('\n'), '2b. hostile RRULE has no raw LF');
  ok(!hostileOut.includes('\r'), '2b. hostile RRULE has no raw CR');
  eq(hostileOut, 'RRULE:FREQ=DAILYCOUNT=5INTERVAL=2', '2b. hostile RRULE control chars scrubbed');

  // All-control RRULE collapses to empty -> caller must skip the line.
  eq(_icsLineRaw('RRULE', '\n\r\x00\x1f'), '', '2b. control-only RRULE returns empty line marker');
  eq(_icsLineRaw('RRULE', ''), '', '2b. empty RRULE returns empty line marker');

  // Multibyte safety on the raw fold path: never split a UTF-8 sequence.
  const emojiRrule = 'FREQ=WEEKLY;' + '😀'.repeat(30); // 120 octets of emoji
  const ef = _icsLineRaw('RRULE', emojiRrule);
  ok(ef.split('\r\n').every((l) => utf8Len(l) <= 75), '2b. emoji RRULE lines all <= 75 octets');
  ok(!/[\uD800-\uDFFF]/.test(ef.replace(/[\uD800-\uDFFF][\uDC00-\uDFFF]/g, '')), '2b. no lone surrogates after raw fold');
  eq(ef.replace(/\r\n /g, ''), 'RRULE:' + emojiRrule, '2b. emoji RRULE content preserved (unfolded)');
}

// ---------------------------------------------------------------------------
// 3. TZ-safe all-day dates (server TZ forced to America/Los_Angeles)
// ---------------------------------------------------------------------------
{
  // PB serializes datetime as "yyyy-mm-dd hh:mm:ss.sssZ".
  eq(_amsterdamYmd(_toUtcMs('2026-09-28 00:00:00.000Z')).key, '2026-09-28', '3. midnight-UTC stays same date in Amsterdam');
  // UI-created all-day in NL summer: local midnight -> 22:00Z previous day.
  eq(_amsterdamYmd(_toUtcMs('2026-06-19T22:00:00.000Z')).key, '2026-06-20', '3. NL-summer UI midnight resolves to 2026-06-20');
  eq(_amsterdamYmd(_toUtcMs('2026-01-01T00:00:00.000Z')).key, '2026-01-01', '3. winter CET');
  // Explicit numeric offset: 2026-09-28T00:00+02:00 = 2026-09-27T22:00Z -> still 2026-09-28 in Amsterdam.
  eq(_amsterdamYmd(_toUtcMs('2026-09-28T00:00:00+02:00')).key, '2026-09-28', '3. explicit +02:00 offset resolves to Amsterdam date');

  // Cross-check lastSundayUtc against an independent brute force.
  for (const year of [2024, 2025, 2026, 2027]) {
    for (const month of [2, 9]) { // March, October
      const mine = _lastSundayUtc(year, month, 1);
      let found = null;
      for (let day = 31; day >= 22; day--) {
        const d = new Date(Date.UTC(year, month, day, 1));
        if (d.getUTCDay() === 0) { found = d.getTime(); break; }
      }
      eq(mine, found, `3. lastSunday(${year}-${month + 1}) matches brute force`);
    }
  }
  eq(new Date(_lastSundayUtc(2026, 2, 1)).getUTCDate(), 29, '3. DST start 2026 = Mar 29');
  eq(new Date(_lastSundayUtc(2026, 9, 1)).getUTCDate(), 25, '3. DST end 2026 = Oct 25');

  // Spring-forward eve: 23:00Z Mar 28 = 00:00 CET Mar 29.
  eq(_amsterdamYmd(_toUtcMs('2026-03-28T23:00:00.000Z')).key, '2026-03-29', '3. across spring-forward date kept');
  // Fall-back window: 23:00Z Oct 24 = 01:00 CEST Oct 25.
  eq(_amsterdamYmd(_toUtcMs('2026-10-24T23:00:00.000Z')).key, '2026-10-25', '3. across fall-back date kept');
}

// Integration: drive the real export handler.
{
  const tasks = [
    // all-day, PB-shape Z string (would be 2026-09-27 under Los Angeles local TZ)
    task({ uid: 'pb-shape', all_day: true, start_time: '2026-09-28 00:00:00.000Z' }),
    // all-day, UI-NL-summer shape via due_date (local midnight -> 22:00Z prev day)
    task({ uid: 'ui-summer', all_day: true, due_date: '2026-06-19T22:00:00.000Z' }),
    // all-day import shape, no end -> exclusive DTEND = next day
    task({ uid: 'import-nye', all_day: true, start_time: '2026-12-31T00:00:00.000Z' }),
    // all-day with explicit later end
    task({ uid: 'explicit-end', all_day: true, start_time: '2026-09-28T00:00:00.000Z', end_time: '2026-09-30T00:00:00.000Z' }),
    // all-day with same-day end -> exclusive DTEND = start + 1
    task({ uid: 'same-day-end', all_day: true, start_time: '2026-09-28T00:00:00.000Z', end_time: '2026-09-28T00:00:00.000Z' }),
    // leap-year rollover
    task({ uid: 'leap-2024', all_day: true, start_time: '2024-02-28T00:00:00.000Z' }),
    // Date-object input tolerance
    task({ uid: 'dateobj', all_day: true, start_time: new Date('2026-11-05T00:00:00.000Z') }),
    // suffix-less string -> interpreted as UTC (deterministic)
    task({ uid: 'nosuffix', all_day: true, start_time: '2026-08-15 00:00:00' }),
    // timed event (unchanged semantics)
    task({ uid: 'timed-0900', all_day: false, start_time: '2026-09-28T09:30:00.000Z', end_time: '2026-09-28T10:30:00.000Z' }),
    // long multibyte description + Windows-newline description
    task({ uid: 'multibyte', all_day: true, start_time: '2026-05-01T00:00:00.000Z', description: 'é'.repeat(40) }),
    task({ uid: 'crdesc', all_day: true, start_time: '2026-05-02T00:00:00.000Z', description: 'first line\r\nsecond line' }),
    // long RRULE (>75 octets) + hostile RRULE (raw control chars)
    task({ uid: 'long-rrule', all_day: false, start_time: '2026-09-28T09:30:00.000Z', end_time: '2026-09-28T10:30:00.000Z', rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;UNTIL=20261231T235959Z;INTERVAL=2;WKST=SU;BYHOUR=9;BYMINUTE=30;BYSECOND=0' }),
    task({ uid: 'hostile-rrule', all_day: false, start_time: '2026-09-28T09:30:00.000Z', end_time: '2026-09-28T10:30:00.000Z', rrule: 'FREQ=DAILY\nCOUNT=5\rINTERVAL=2' }),
  ];

  const res = driveExport(tasks);
  eq(res.code, 200, 'I. handler returns 200');
  eq(res.obj.count, tasks.length, 'I. count matches task list');
  const ics = res.obj.ics;

  // Whole-export invariants.
  const lines = ics.split('\r\n').filter((l) => l.length > 0);
  ok(lines.every((l) => utf8Len(l) <= 75), 'I. every physical line <= 75 octets');
  ok(!ics.replace(/\r\n/g, '').includes('\r'), 'I. no raw CR outside line endings');
  ok(!ics.replace(/\r\n/g, '').includes('\n'), 'I. no raw LF outside line endings');

  const props = {};
  {
    // Per-task lookups (order-independent): map uid -> {prop: value} for every VEVENT.
    const events2 = ics.split('BEGIN:VEVENT').slice(1).map((e) => 'BEGIN:VEVENT' + e.split('END:VEVENT')[0]);
    for (const ev of events2) {
      const uid = (ev.match(/^UID:(.+)$/m) || [])[1];
      if (!uid) continue;
      const p2 = {};
      for (const line of unfoldLines(ev).split('\r\n').filter(Boolean)) {
        const idx = line.indexOf(':');
        p2[line.slice(0, idx)] = line.slice(idx + 1);
      }
      props[uid] = p2;
    }
    eq(Object.keys(props).length, tasks.length, 'I. one VEVENT per task');
  }
  eq(props['pb-shape']['DTSTART;VALUE=DATE'], '20260928', 'I. all-day DTSTART from PB-shape Z string (not LA-local)');
  eq(props['pb-shape']['DTEND;VALUE=DATE'], '20260929', 'I. no-end all-day DTEND exclusive +1 day');

  // UI-NL-summer shape
  eq(props['ui-summer']['DTSTART;VALUE=DATE'], '20260620', 'I. UI NL-summer all-day resolves to 2026-06-20');
  // import shape without end
  eq(props['import-nye']['DTSTART;VALUE=DATE'], '20261231', 'I. import NYE all-day date');
  eq(props['import-nye']['DTEND;VALUE=DATE'], '20270101', 'I. import NYE exclusive DTEND rolls year');
  // explicit later end preserved
  eq(props['explicit-end']['DTEND;VALUE=DATE'], '20260930', 'I. explicit later end preserved');
  // same-day end -> exclusive next day
  eq(props['same-day-end']['DTEND;VALUE=DATE'], '20260929', 'I. same-day end -> exclusive +1');
  // leap rollover
  eq(props['leap-2024']['DTSTART;VALUE=DATE'], '20240228', 'I. leap-year start');
  eq(props['leap-2024']['DTEND;VALUE=DATE'], '20240229', 'I. leap-year exclusive DTEND = Feb 29');
  // Date-object input
  eq(props['dateobj']['DTSTART;VALUE=DATE'], '20261105', 'I. Date-object start_time tolerated');
  // suffix-less input
  eq(props['nosuffix']['DTSTART;VALUE=DATE'], '20260815', 'I. suffix-less value treated as UTC');
  // timed event
  eq(props['timed-0900']['DTSTART'], '20260928T093000Z', 'I. timed DTSTART unchanged UTC');
  eq(props['timed-0900']['DTEND'], '20260928T103000Z', 'I. timed DTEND unchanged UTC');
  // multibyte description through the full pipeline
  eq(props['multibyte']['DESCRIPTION'], 'é'.repeat(40), 'I. multibyte description survives fold+unfold');
  // CR description through the full pipeline
  eq(props['crdesc']['DESCRIPTION'], 'first line\\r\\nsecond line', 'I. CRLF description emitted escaped');
  // Long RRULE survives fold+unfold exactly (no TEXT escaping).
  eq(props['long-rrule']['RRULE'], 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;UNTIL=20261231T235959Z;INTERVAL=2;WKST=SU;BYHOUR=9;BYMINUTE=30;BYSECOND=0', 'I. long RRULE preserved verbatim through handler');
  // Hostile RRULE scrubbed of control chars on the wire.
  eq(props['hostile-rrule']['RRULE'], 'FREQ=DAILYCOUNT=5INTERVAL=2', 'I. hostile RRULE control chars scrubbed');

  // TZ-independence proof: the same export under a second server TZ is identical.
  process.env.TZ = 'Europe/Amsterdam';
  {
    const handlers2 = [];
    const sandbox2 = {
      routerAdd: function (m, r, fn) { handlers2.push({ method: m, route: r, fn }); },
      Record: function () {},
      console: { log() {}, error() {} },
      $app: null,
    };
    vm.createContext(sandbox2);
    vm.runInContext(fs.readFileSync(HOOK, 'utf8'), sandbox2);
    const h2 = handlers2.find((x) => x.route === '/api/ics-export');
    const tasks2 = [task({ all_day: true, start_time: '2026-09-28 00:00:00.000Z' })];
    const cap = [];
    sandbox2.$app = { findRecordsByFilter: () => tasks2, findRecordById: () => null };
    h2.fn({ requestInfo: () => ({ auth: { id: 'u1', get: (k) => (k === 'family_id' ? 'f1' : undefined) }, query: {} }), get: () => null, json: (code, obj) => cap.push(obj) });
    const propsEast = veventProps(cap[0].ics);
    eq(propsEast['DTSTART;VALUE=DATE'], '20260928', 'I. same date with server TZ=Europe/Amsterdam');
  }
  process.env.TZ = 'America/Los_Angeles';
}

// ---------------------------------------------------------------------------
// 4. Real-parser check (optional): parse the export with ical.js — the same
// library the frontend imports — which unfolds and unescapes like real clients.
// ---------------------------------------------------------------------------
let ICAL = null;
try { ICAL = require('ical.js'); } catch (e) { /* not installed -> skipped */ }
if (ICAL) {
  const realPar = driveExport([
    task({ uid: 'real-all', all_day: true, start_time: '2026-09-28T00:00:00.000Z', description: 'é'.repeat(40), location: 'Amsterdam' }),
    task({ uid: 'real-cr', all_day: true, start_time: '2026-05-02T00:00:00.000Z', description: 'first line\r\nsecond line\rthird' }),
    task({ uid: 'real-timed', all_day: false, start_time: '2026-09-28T09:30:00.000Z', end_time: '2026-09-28T10:30:00.000Z', rrule: 'FREQ=DAILY;COUNT=5' }),
    task({ uid: 'real-long-rrule', all_day: false, start_time: '2026-09-28T09:30:00.000Z', end_time: '2026-09-28T10:30:00.000Z', rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;UNTIL=20261231T235959Z;INTERVAL=2;WKST=SU;BYHOUR=9;BYMINUTE=30;BYSECOND=0' }),
  ]);
  const jcal = ICAL.parse(realPar.obj.ics);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents('vevent');
  eq(vevents.length, 4, '4. ical.js parses 4 VEVENTs');

  const byU = {};
  for (const v of vevents) {
    const ev = new ICAL.Event(v);
    byU[ev.uid] = ev;
  }

  const all = byU['real-all'];
  eq(all.startDate.isDate, true, '4. all-day startDate is date-only');
  eq(all.startDate.year + '-' + all.startDate.month + '-' + all.startDate.day, '2026-9-28', '4. ical.js sees all-day DTSTART 2026-09-28');
  eq(all.endDate.isDate, true, '4. all-day endDate is date-only');
  eq(all.endDate.year + '-' + all.endDate.month + '-' + all.endDate.day, '2026-9-29', '4. ical.js sees exclusive DTEND 2026-09-29');
  eq(all.duration.toSeconds(), 86400, '4. duration = 1 day');
  eq(all.description, 'é'.repeat(40), '4. ical.js unfolds multibyte DESCRIPTION intact');
  eq(all.location, 'Amsterdam', '4. LOCATION survives');
  eq(all.summary, 'T', '4. SUMMARY survives');

  const cr = byU['real-cr'];
  // RFC 5545 TEXT defines escapes for \\ ; , \n only — ical.js therefore leaves
  // the \r escape literal while turning \n into a newline. The raw CR control
  // char is gone from the wire format; that is the guarantee being tested.
  eq(cr.description, 'first line\\r\nsecond line\\rthird', '4. ical.js sees CR escapes kept literal, LF unescaped (no raw CR)');

  const timed = byU['real-timed'];
  eq(timed.startDate.toJSDate().toISOString(), '2026-09-28T09:30:00.000Z', '4. timed DTSTART UTC instant');
  eq(timed.endDate.toJSDate().toISOString(), '2026-09-28T10:30:00.000Z', '4. timed DTEND UTC instant');
  eq(String(timed.component.getFirstPropertyValue('rrule')), 'FREQ=DAILY;COUNT=5', '4. RRULE passes through');

  // The >75-octet RRULE arrived folded and must unfold + parse like real clients do.
  const longRecur = byU['real-long-rrule'] ? byU['real-long-rrule'].component.getFirstPropertyValue('rrule') : null;
  ok(!!longRecur, '4. long folded RRULE parses with ical.js');
  if (longRecur) {
    eq(longRecur.freq, 'WEEKLY', '4. long RRULE freq=WEEKLY');
    eq(longRecur.interval, 2, '4. long RRULE interval=2');
    eq(String(longRecur).includes('BYDAY=MO,TU,WE,TH,FR,SA,SU'), true, '4. long RRULE BYDAY list preserved (ical.js order may vary)');
    eq(longRecur.until && longRecur.until.year, 2026, '4. long RRULE UNTIL year 2026');
  }
}

// ---------------------------------------------------------------------------
console.log(`\nICS logic harness: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}