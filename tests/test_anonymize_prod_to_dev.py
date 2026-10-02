#!/usr/bin/env python3
"""Regression test for scripts/anonymize-prod-to-dev.py (GH#97).

Builds a synthetic PocketBase-like SQLite DB with data in every table that the
script must handle (including the previously-missed free-text and integration
tables), runs the script, and asserts that:

  - users: email/name/display_name anonymized, avatar + invite_code cleared
  - tasks: title scrambled, description + location cleared
  - calendar_events: title scrambled, description + location cleared, attendees empty array
  - labels: name replaced with neutral placeholder
  - integrations / ai_settings / companion_devices / companion_notifications /
    saved_filters / invite_codes / api_tokens / agent_keys / app_settings /
    reminders / briefings / etc.: fully deleted
  - IDs, relations, dates and structure are preserved
  - the post-run audit reports tables that were NOT touched

Run:  python3 tests/test_anonymize_prod_to_dev.py
"""

import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "scripts", "anonymize-prod-to-dev.py")

# ── minimal PB-like schema covering every table the script touches ────────────

SCHEMA = {
    "users": [
        "id TEXT PRIMARY KEY", "email TEXT UNIQUE", "name TEXT", "first_name TEXT", "last_name TEXT",
        "password TEXT", "tokenKey TEXT", "emailVisibility INTEGER", "verified INTEGER",
        "role TEXT", "family_id TEXT", "invite_code TEXT", "display_name TEXT",
        "avatar TEXT", "language TEXT", "created TEXT", "updated TEXT",
    ],
    "_superusers": ["id TEXT PRIMARY KEY", "email TEXT UNIQUE", "password TEXT", "tokenKey TEXT", "emailVisibility INTEGER"],
    "families": ["id TEXT PRIMARY KEY", "name TEXT", "created TEXT"],
    "tasks": [
        "id TEXT PRIMARY KEY", "title TEXT", "description TEXT", "location TEXT",
        "status TEXT", "blocked INTEGER", "blocked_comment TEXT", "user TEXT",
        "due_date TEXT", "labels TEXT", "uid TEXT", "external_id TEXT", "created TEXT",
    ],
    "items": ["id TEXT PRIMARY KEY", "title TEXT", "completed INTEGER", "user TEXT", "created TEXT"],
    "notes": ["id TEXT PRIMARY KEY", "title TEXT", "content TEXT", "pinned INTEGER", "user TEXT", "created TEXT"],
    "calendar_events": [
        "id TEXT PRIMARY KEY", "title TEXT", "description TEXT", "location TEXT",
        "attendees TEXT", "start_time TEXT", "end_time TEXT", "user TEXT", "uid TEXT", "external_id TEXT", "created TEXT",
    ],
    "labels": ["id TEXT PRIMARY KEY", "name TEXT", "color TEXT", "user TEXT", "created TEXT"],
    "projects": ["id TEXT PRIMARY KEY", "title TEXT", "description TEXT", "user TEXT"],
    "shops": ["id TEXT PRIMARY KEY", "name TEXT", "color TEXT", "user TEXT", "created TEXT"],
    "integrations": ["id TEXT PRIMARY KEY", "type TEXT", "api_url TEXT", "api_key TEXT", "config_data TEXT", "enabled INTEGER", "user TEXT"],
    "ai_settings": ["id TEXT PRIMARY KEY", "provider TEXT", "api_url TEXT", "api_key TEXT", "model TEXT", "max_tokens INTEGER", "temperature REAL", "enabled INTEGER", "user TEXT"],
    "companion_devices": ["id TEXT PRIMARY KEY", "device_id TEXT", "device_name TEXT", "platform TEXT", "os_version TEXT", "app_version TEXT", "push_token TEXT", "registration_date TEXT", "last_seen TEXT", "user TEXT"],
    "companion_notifications": ["id TEXT PRIMARY KEY", "device_id TEXT", "title TEXT", "body TEXT", "type TEXT", "task_id TEXT", "path TEXT", "source TEXT", "user TEXT", "created_at TEXT"],
    "saved_filters": ["id TEXT PRIMARY KEY", "name TEXT", "definition TEXT", "sort TEXT", "owner TEXT", "family TEXT", "shared INTEGER"],
    "invite_codes": ["id TEXT PRIMARY KEY", "code TEXT", "expires_at TEXT", "used INTEGER", "user TEXT"],
    "api_tokens": ["id TEXT PRIMARY KEY", "token_hash TEXT", "scopes TEXT", "user TEXT", "created TEXT"],
    "agent_keys": ["id TEXT PRIMARY KEY", "key_hash TEXT", "agent_name TEXT", "user TEXT", "created TEXT"],
    "agent_audit_log": ["id TEXT PRIMARY KEY", "agent_key_id TEXT", "action TEXT", "details TEXT", "user TEXT", "created TEXT"],
    "app_settings": ["id TEXT PRIMARY KEY", "theme TEXT", "language TEXT", "user TEXT"],
    "briefings": ["id TEXT PRIMARY KEY", "user TEXT", "date TEXT", "data TEXT", "generated_at TEXT"],
    "rewards": ["id TEXT PRIMARY KEY", "user TEXT", "points INTEGER", "reason TEXT", "earned_at TEXT"],
    "sprints": ["id TEXT PRIMARY KEY", "name TEXT", "start_date TEXT", "end_date TEXT", "user TEXT"],
    "goals": ["id TEXT PRIMARY KEY", "goal TEXT", "user TEXT", "status TEXT"],
    "external_references": ["id TEXT PRIMARY KEY", "user TEXT", "entity_id TEXT", "entity_type TEXT", "external_url TEXT"],
    "reminders": ["id TEXT PRIMARY KEY", "user TEXT", "reminder_time TEXT", "message TEXT"],
    # PB internal system tables (the script must not choke on them)
    "_otps": ["id TEXT PRIMARY KEY", "collectionRef TEXT", "recordRef TEXT", "created TEXT", "updated TEXT"],
    "_externalAuths": ["id TEXT PRIMARY KEY", "collectionRef TEXT", "recordRef TEXT", "provider TEXT", "providerId TEXT", "created TEXT", "updated TEXT"],
    "_mfas": ["id TEXT PRIMARY KEY", "collectionRef TEXT", "recordRef TEXT", "created TEXT", "updated TEXT"],
    "_authOrigins": ["id TEXT PRIMARY KEY", "collectionRef TEXT", "recordRef TEXT", "fingerprint TEXT", "created TEXT", "updated TEXT"],
    "_collections": ["id TEXT PRIMARY KEY", "name TEXT", "type TEXT", "schema TEXT"],
    "_migrations": ["id TEXT PRIMARY KEY", "file TEXT", "applied TEXT"],
    "_params": ["id TEXT PRIMARY KEY", "value TEXT", "created TEXT", "updated TEXT"],
    # table intentionally not handled — audit must flag it
    "custom_free_text": ["id TEXT PRIMARY KEY", "content TEXT"],
}


def make_row(table: str, extra: dict) -> dict:
    row = {"id": f"{table[:3]}_{hash(extra.get('id', '')) & 0xffff:04x}"}
    cols = [c.split()[0] for c in SCHEMA[table]]
    text_cols = [c for c in cols if c != "id"]
    for c in text_cols:
        row[c] = extra.get(c, f"sensitive-{c}-{table}")
    return row


def create_synthetic_db(path: str):
    if os.path.exists(path):
        os.remove(path)
    db = sqlite3.connect(path)
    for table, cols in SCHEMA.items():
        db.execute(f"CREATE TABLE {table} ({', '.join(cols)})")

    # users — real-looking identities + avatar/invite_code
    db.executemany(
        "INSERT INTO users (id, email, name, first_name, last_name, password, tokenKey, emailVisibility, verified, role, family_id, invite_code, display_name, avatar, language, created, updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            ("u_0001", "jan@real-domain.nl", "Jan Jansen", "Jan", "Jansen", "$2a$10$abc", "tk_real_1", 0, 1, "admin", "f_0001", "INVITE-REAL-1", "Papa", "file_avatar_jan.png", "nl", "2026-01-01", "2026-01-02"),
            ("u_0002", "marie@example.com", "Marie Vries", "Marie", "Vries", "$2a$10$def", "tk_real_2", 0, 1, "user", "f_0001", "INVITE-REAL-2", "Mama", "file_avatar_marie.png", "nl", "2026-01-03", "2026-01-04"),
        ],
    )
    # 9 users in total: more than the old fixed list of 7 fake identities (UNIQUE email!)
    db.executemany(
        "INSERT INTO users (id, email, name, first_name, last_name, password, tokenKey, emailVisibility, verified, role, family_id, invite_code, display_name, avatar, language, created, updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [(f"u_{i:04d}", f"kind{i}@real-domain.nl", f"Kind {i} Jansen", f"Kind{i}", "Jansen", "$2a$10$kid", f"tk_real_{i}", 0, 1, "member", "f_0001", f"INVITE-REAL-{i}", f"Kind {i}", "", "nl", "2026-01-05", "2026-01-05")
         for i in range(3, 10)],
    )
    db.execute("INSERT INTO _superusers (id, email, password, tokenKey, emailVisibility) VALUES ('su_0001', 'real-admin@real-domain.nl', '$2a$10$xyz', 'tk_su_real', 0)")
    db.execute("INSERT INTO _superusers (id, email, password, tokenKey, emailVisibility) VALUES ('su_0002', 'second-admin@real-domain.nl', '$2a$10$xyz2', 'tk_su_real2', 0)")
    # PocketBase settings row: SMTP/S3 credentials are stored in clear text here
    db.execute("INSERT INTO _params (id, value, created, updated) VALUES ('settings', ?, '2026-01-01', '2026-01-01')", (
        '{"smtp":{"enabled":true,"port":587,"host":"smtp.real-provider.nl","username":"mailer@real-domain.nl","password":"SMTP-REAL-SECRET","authMethod":"","tls":true,"localName":""},'
        '"s3":{"enabled":true,"bucket":"prod-bucket","region":"eu","endpoint":"https://s3.real","accessKey":"AKIAREAL","secret":"S3-REAL-SECRET","forcePathStyle":false},'
        '"backups":{"cron":"0 2 * * *","cronMaxKeep":7,"s3":{"enabled":true,"bucket":"prod-backups","region":"eu","endpoint":"https://s3.real","accessKey":"AKIABACKUP","secret":"BACKUP-REAL-SECRET","forcePathStyle":false}},'
        '"meta":{"appName":"Todoless","appURL":"https://todoless.real-domain.nl","senderName":"Jan Jansen","senderAddress":"jan@real-domain.nl"},'
        '"rateLimits":{"enabled":true,"rules":[]},"trustedProxy":{"headers":["X-Real-IP"],"useLeftmostIP":false}}',
    ))
    for i in range(2):
        db.execute("INSERT INTO families (id, name, created) VALUES (?, ?, ?)", (f"f_000{i+1}", "De Jansen-van Vries", "2026-01-01"))

    # tasks with free-text description/location
    db.execute("INSERT INTO tasks (id, title, description, location, status, blocked, blocked_comment, user, due_date, labels, created) VALUES ('t_0001','Opa naar ziekenhuis','Rolstoel mee; kamer 4C','Amsterdam UMC, Meibergdreef 9','todo',0,'','u_0001','2026-02-01','[]','2026-01-01')")
    db.execute("UPDATE tasks SET uid='abc123@google.com', external_id='jan.jansen@gmail.com/evt/42' WHERE id='t_0001'")
    db.execute("INSERT INTO tasks (id, title, description, location, status, blocked, blocked_comment, user, due_date, labels, created) VALUES ('t_0002','Verjaardag Tim','Cadeau: LEGO; allergie pinda','Huize Jansen, Dorpsstraat 3','backlog',0,'','u_0002','2026-03-01','[]','2026-01-02')")
    for i in range(10):
        db.execute("INSERT INTO items (id, title, completed, user, created) VALUES (?, ?, 0, ?, ?)", (f"i_{i:04d}", f"Echte boodschap {i}", "u_0001", "2026-01-01"))

    # notes, calendar events with location/attendees
    db.execute("INSERT INTO notes (id, title, content, pinned, user, created) VALUES ('n_0001','Echte notitie','Vertrouwelijk gesprek met dokter Pietersen over symptomen','0','u_0001','2026-01-01')")
    db.execute("INSERT INTO calendar_events (id, title, description, location, attendees, start_time, end_time, user, created) VALUES ('e_0001','Schoolafspraak Tim','Oudergesprek met juf Sandra','Basisschool De Zon, Kerkplein 5','[\"tim@real-domain.nl\",\"juf.sandra@school.nl\"]','2026-02-01T09:00:00Z','2026-02-01T10:00:00Z','u_0001','2026-01-01')")
    db.execute("UPDATE calendar_events SET uid='evt-1@calendar.real-domain.nl', external_id='outlook:AAMk-real' WHERE id='e_0001'")
    db.execute("INSERT INTO calendar_events (id, title, description, location, attendees, start_time, end_time, user, created) VALUES ('e_0002','Doktersafspraak','Controle hart','Huisartsenpraktijk De Veste, Singel 1','[]','2026-02-02T14:00:00Z','2026-02-02T14:30:00Z','u_0002','2026-01-02')")

    # labels with real names
    db.execute("INSERT INTO labels (id, name, color, user, created) VALUES ('l_0001','Opa & Oma','#ff0000','u_0001','2026-01-01')")
    db.execute("INSERT INTO labels (id, name, color, user, created) VALUES ('l_0002','School Tim','#00ff00','u_0002','2026-01-02')")
    db.execute("INSERT INTO labels (id, name, color, user, created) VALUES ('l_0003','Ziekenhuis','#0000ff','u_0001','2026-01-03')")

    # projects + shops
    db.execute("INSERT INTO projects (id, title, description, user) VALUES ('p_0001','Verbouwing huis','Badkamer + keuken, offerte Bouwbedrijf Pieters','u_0001')")
    db.execute("INSERT INTO shops (id, name, color, user, created) VALUES ('s_0001','Jumbo Den Haag NL','#123456','u_0001','2026-01-01')")
    db.execute("INSERT INTO shops (id, name, color, user, created) VALUES ('s_0002','Albert Heijn Rotterdam NL','#654321','u_0002','2026-01-02')")

    # integration / credential tables MUST be deleted
    db.execute("INSERT INTO integrations (id, type, api_url, api_key, config_data, enabled, user) VALUES ('int_0001','home_assistant','https://home-assistant.example.com','sk-rea...2345','{\"username\":\"real\"}',1,'u_0001')")
    db.execute("INSERT INTO ai_settings (id, provider, api_url, api_key, model, max_tokens, temperature, enabled, user) VALUES ('ai_0001','openai','https://api.openai.com','sk-real-openai-abcdef','gpt-4o',2048,0.7,1,'u_0001')")
    db.execute("INSERT INTO companion_devices (id, device_id, device_name, platform, os_version, app_version, push_token, registration_date, last_seen, user) VALUES ('cd_0001','dev-iphone-123','Marieke iPhone','ios','18.0','1.2.3','ExponentPushToken[real-token-xyz]','2026-01-01','2026-01-05','u_0002')")
    db.execute("INSERT INTO companion_notifications (id, device_id, title, body, type, task_id, path, source, user, created_at) VALUES ('cn_0001','dev-iphone-123','Taak herinnering','Opa naar ziekenhuis om 14:00','reminder','t_0001','/tasks/t_0001','app','u_0002','2026-01-05')")
    db.execute("INSERT INTO saved_filters (id, name, definition, sort, owner, family, shared) VALUES ('sf_0001','Mijn ziekenhuis-filter','{\"labels\":[\"l_0003\"]}','-created','u_0001','f_0001',1)")

    # other cleared tables
    db.execute("INSERT INTO invite_codes (id, code, expires_at, used, user) VALUES ('ic_0001','REAL-INVITE-CODE','2026-12-31',0,'u_0001')")
    db.execute("INSERT INTO api_tokens (id, token_hash, scopes, user, created) VALUES ('at_0001','sha256:real-token','read write','u_0001','2026-01-01')")
    db.execute("INSERT INTO agent_keys (id, key_hash, agent_name, user, created) VALUES ('ak_0001','sha256:real-agent-key','assistant','u_0001','2026-01-01')")
    db.execute("INSERT INTO agent_audit_log (id, agent_key_id, action, details, user, created) VALUES ('aal_0001','ak_0001','read','heeft bestand X gelezen','u_0001','2026-01-02')")
    # Auth origins carry device fingerprints — must be cleared too
    db.execute("INSERT INTO _authOrigins (id, collectionRef, recordRef, fingerprint, created, updated) VALUES ('ao_0001','_pb_users_auth_','u_0001','sha256:device-fingerprint','2026-01-01','2026-01-02')")
    db.execute("INSERT INTO app_settings (id, theme, language, user) VALUES ('as_0001','dark','nl','u_0001')")
    db.execute("INSERT INTO briefings (id, user, date, data, generated_at) VALUES ('b_0001','u_0001','2026-01-05','{\"summary\":\"gevoelig\"}','2026-01-05')")
    db.execute("INSERT INTO rewards (id, user, points, reason, earned_at) VALUES ('r_0001','u_0001',50,'schoonmaken','2026-01-03')")
    db.execute("INSERT INTO sprints (id, name, start_date, end_date, user) VALUES ('sp_0001','Sprint Q1','2026-01-01','2026-01-14','u_0001')")
    db.execute("INSERT INTO goals (id, goal, user, status) VALUES ('g_0001','Afvallen voor de vakantie','u_0001','active')")
    db.execute("INSERT INTO external_references (id, user, entity_id, entity_type, external_url) VALUES ('er_0001','u_0001','t_0001','task','https://docs.example.com/private/123')")
    db.execute("INSERT INTO reminders (id, user, reminder_time, message) VALUES ('rm_0001','u_0001','2026-02-01T08:00:00Z','Bel dokter Pietersen')")

    # untouched table — the audit must list it
    db.execute("INSERT INTO custom_free_text (id, content) VALUES ('cf_0001','deze vrije tekst wordt niet geanonimiseerd')")

    db.commit()
    db.close()


def run_script(src: str, dst: str) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    env["PYTHONHASHSEED"] = "0"  # deterministic placeholder selection
    return subprocess.run(
        [sys.executable, SCRIPT, src, dst],
        capture_output=True, text=True, timeout=120, env=env,
    )


def main() -> int:
    failures = []
    def check(name: str, cond: bool, detail: str = ""):
        status = "PASS" if cond else "FAIL"
        print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))
        if not cond:
            failures.append(name)

    with tempfile.TemporaryDirectory(prefix="anon-test-") as tmp:
        src = os.path.join(tmp, "synthetic-prod.db")
        dst = os.path.join(tmp, "synthetic-anon.db")
        create_synthetic_db(src)
        res = run_script(src, dst)
        check("script exits 0", res.returncode == 0, f"rc={res.returncode}")
        check("no warnings", "⚠️  Warnings:" not in res.stdout, res.stdout.split("Warnings:")[-1][:200] if "Warnings:" in res.stdout else "")
        if res.returncode != 0:
            print(res.stdout)
            print(res.stderr)

        db = sqlite3.connect(dst)

        # users
        rows = db.execute("SELECT email, name, display_name, avatar, invite_code FROM users ORDER BY rowid").fetchall()
        check("users anonymized + avatar/invite_code cleared", all(
            e.endswith("@example.test") and c == "" and ic == "" for e, _n, _d, c, ic in rows
        ), str(rows))
        check("users display_name set", all(re.fullmatch(r"Admin Test|Gezinslid \d+", d) for _e, _n, d, _c, _i in rows), str(rows))
        check("every user gets a unique fake email (9 users > 7 fixed identities)",
              len(rows) == 9 and len({e for e, *_ in rows}) == 9 and not any("real-domain" in e for e, *_ in rows), str([e for e, *_ in rows]))
        su = db.execute("SELECT email FROM _superusers ORDER BY rowid").fetchall()
        check("superusers anonymized with unique emails", len(su) == 2 and len(set(su)) == 2 and su[0] == ("admin@example.test",) and not any("real-domain" in e for (e,) in su), str(su))

        # PocketBase settings row: no production credentials may survive
        settings_raw = db.execute("SELECT value FROM _params WHERE id='settings'").fetchone()[0]
        for secret in ("SMTP-REAL-SECRET", "S3-REAL-SECRET", "BACKUP-REAL-SECRET", "smtp.real-provider.nl", "mailer@real-domain.nl", "AKIAREAL", "AKIABACKUP", "jan@real-domain.nl", "prod-bucket"):
            check(f"settings: '{secret}' removed", secret not in settings_raw)
        import json as _json
        settings = _json.loads(settings_raw)
        check("settings: smtp/s3/backup-s3 disabled", not settings["smtp"]["enabled"] and not settings["s3"]["enabled"] and not settings["backups"]["s3"]["enabled"])
        check("settings: non-secret config kept", settings["rateLimits"]["enabled"] is True and settings["trustedProxy"]["headers"] == ["X-Real-IP"] and settings["meta"]["appName"] == "Todoless")

        # tasks free text
        desc = db.execute("SELECT COUNT(*) FROM tasks WHERE description IS NOT NULL AND description != ''").fetchone()[0]
        loc = db.execute("SELECT COUNT(*) FROM tasks WHERE location IS NOT NULL AND location != ''").fetchone()[0]
        check("tasks.description cleared", desc == 0, f"{desc} non-empty")
        check("tasks.location cleared", loc == 0, f"{loc} non-empty")
        title = db.execute("SELECT title FROM tasks WHERE id='t_0001'").fetchone()[0]
        check("tasks.title scrambled", title != "Opa naar ziekenhuis", title)
        ics = db.execute("SELECT uid, external_id FROM tasks WHERE id='t_0001'").fetchone()
        check("tasks ICS identifiers cleared", ics == ("", ""), str(ics))
        ics = db.execute("SELECT uid, external_id FROM calendar_events WHERE id='e_0001'").fetchone()
        check("calendar ICS identifiers cleared", ics == ("", ""), str(ics))

        # calendar events
        ev = db.execute("SELECT title, description, location, attendees FROM calendar_events WHERE id='e_0001'").fetchone()
        check("calendar title scrambled", ev[0] != "Schoolafspraak Tim", ev[0])
        check("calendar description cleared", ev[1] == "", ev[1])
        check("calendar location cleared", ev[2] == "", ev[2])
        check("calendar attendees empty array", ev[3] == "[]" or ev[3] == "null", ev[3])

        # labels
        ln = [r[0] for r in db.execute("SELECT name FROM labels ORDER BY rowid")]
        check("labels anonymized", all(re.fullmatch(r"Label [A-J]", n) for n in ln), str(ln))
        check("labels no real names", all("Opa" not in n and "School" not in n and "Ziekenhuis" not in n for n in ln), str(ln))

        # notes content
        nc = db.execute("SELECT content FROM notes WHERE id='n_0001'").fetchone()[0]
        check("notes content anonymized", "dokter" not in nc.lower() and "Pietersen" not in nc, nc)

        # projects/shops
        pc = db.execute("SELECT description FROM projects WHERE id='p_0001'").fetchone()[0]
        check("projects description cleared", pc == "", pc)
        sc = [r[0] for r in db.execute("SELECT name FROM shops ORDER BY rowid")]
        check("shops processed (location suffix stripped)", sc == ["Jumbo Den Haag", "Albert Heijn Rotterdam"], str(sc))

        # cleared tables all empty
        cleared = ["invite_codes", "api_tokens", "agent_keys", "_otps", "_externalAuths", "_mfas",
                   "agent_audit_log", "app_settings", "briefings", "rewards",
                   "sprints", "goals", "external_references", "reminders", "integrations",
                   "ai_settings", "companion_devices", "companion_notifications", "saved_filters",
                   "_authOrigins"]
        for t in cleared:
            n = db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            check(f"{t} cleared", n == 0, f"{n} rows")
        db.close()

        # audit mentions untouchables
        check("audit lists pb_data/storage warning", "pb_data/storage" in res.stdout)
        check("audit lists untouched custom table", "custom_free_text" in res.stdout, "")

        # structure preserved
        db2 = sqlite3.connect(dst)
        counts = {t: db2.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ["users", "families", "tasks", "items", "labels"]}
        db2.close()
        check("structure counts preserved", counts == {"users": 9, "families": 2, "tasks": 2, "items": 10, "labels": 3}, str(counts))

        # a failure half-way must not leave an un-anonymized copy behind
        broken_src = os.path.join(tmp, "broken-prod.db")
        broken_dst = os.path.join(tmp, "broken-anon.db")
        create_synthetic_db(broken_src)
        bdb = sqlite3.connect(broken_src)
        bdb.execute("ALTER TABLE tasks RENAME COLUMN title TO titel")  # script's SELECT id, title fails after the copy
        bdb.commit(); bdb.close()
        res_broken = run_script(broken_src, broken_dst)
        check("failing run exits non-zero", res_broken.returncode == 1, f"rc={res_broken.returncode}")
        check("failing run removes the output file", not os.path.exists(broken_dst) and not os.path.exists(broken_dst + "-wal"), str(os.listdir(tmp)))
        check("failing run explains itself", "No output was written" in res_broken.stderr, res_broken.stderr[-200:])

    # WAL consistency: uncheckpointed source rows must survive the copy
        wal_src = os.path.join(tmp, "wal-src.db")
        wal_dst = os.path.join(tmp, "wal-dst.db")
        if os.path.exists(wal_src):
            os.remove(wal_src)
        wdb = sqlite3.connect(wal_src)
        wdb.execute("CREATE TABLE t (id TEXT PRIMARY KEY, v TEXT)")
        wdb.execute("PRAGMA journal_mode=WAL")
        wdb.execute("INSERT INTO t VALUES ('r1','in-wal-not-checkpointed')")
        wdb.commit()  # commit leaves rows in the WAL until checkpoint — good
        wdb.close()
        src_mod = _load_script_module()
        src_mod._copy_db_consistent(wal_src, wal_dst)
        vdb = sqlite3.connect(wal_dst)
        got = vdb.execute("SELECT v FROM t WHERE id='r1'").fetchone()
        vdb.close()
        check("WAL-mode source copied with uncheckpointed rows", got == ("in-wal-not-checkpointed",), str(got))

    print()
    if failures:
        print(f"FAILED: {len(failures)} check(s): {failures}")
        return 1
    print("ALL CHECKS PASSED ✓")
    return 0


def _load_script_module():
    """Import the anonymize script as a module (it guards __main__)."""
    import importlib.util

    spec = importlib.util.spec_from_file_location("anonymize_prod_to_dev", SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {SCRIPT}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


if __name__ == "__main__":
    sys.exit(main())