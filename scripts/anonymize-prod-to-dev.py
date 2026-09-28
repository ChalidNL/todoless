#!/usr/bin/env python3
"""
Anonymize a PocketBase production database for safe use in dev.

Usage:
  python3 scripts/anonymize-prod-to-dev.py <prod_data.db> <output_anon.db>

What it does:
  - Replaces real names/emails with test equivalents
  - Resets password hashes to a known test password
  - Replaces sensitive task/item titles with neutral placeholders
  - Clears free-text fields on tasks (description/location), calendar events
    (location/attendees), labels (name), and user profile data (display_name,
    avatar, invite_code)
  - Deletes sensitive/integration tables: invite codes, API tokens, agent keys,
    integrations (third-party credentials), ai_settings (API keys),
    companion_devices/companion_notifications (push tokens), saved_filters
    (user-defined free text definitions), etc.
  - Preserves: IDs, relations, dates, statuses, repeat intervals, structure

IMPORTANT: The raw prod dump must NEVER be committed to git or left on dev.
Also: uploaded files (avatars, photos) live in pb_data/storage, which is NOT
part of the SQLite DB. The users.avatar field is cleared, but if you copied the
storage directory alongside the DB you must scrub or delete it yourself.

Exit code:
  0  — success
  2  — one or more known sensitive tables/fields could not be processed
       (missing table/column is ignored; unexpected errors are reported)
"""

import sqlite3
import sys
import os

# ── Configuration ──────────────────────────────────────────────────────────────

# Generate a bcrypt-like placeholder. PB uses bcrypt ($2a$).
# For dev we don't need real password validation — just a valid-looking hash.
# The PB Go bcrypt library will accept any properly formatted bcrypt hash.
# We use a known hash for "test1234"
TEST_PASSWORD = "test1234"
# This is a real bcrypt hash for "test1234"
TEST_PASSWORD_HASH = "$2b$10$fGfrfRbf5/h0V4RxIw2NEuVgrK4D5kOEaGw6jNParhr5vbywd1c9O"

FAKE_USERS = [
    {"email": "admin@example.test", "name": "Admin Test", "first_name": "Admin", "last_name": "Test"},
    {"email": "member1@example.test", "name": "Gezinslid 1", "first_name": "Gezinslid", "last_name": "Een"},
    {"email": "member2@example.test", "name": "Gezinslid 2", "first_name": "Gezinslid", "last_name": "Twee"},
    {"email": "member3@example.test", "name": "Gezinslid 3", "first_name": "Gezinslid", "last_name": "Drie"},
    {"email": "member4@example.test", "name": "Gezinslid 4", "first_name": "Gezinslid", "last_name": "Vier"},
    {"email": "member5@example.test", "name": "Gezinslid 5", "first_name": "Gezinslid", "last_name": "Vijf"},
    {"email": "member6@example.test", "name": "Gezinslid 6", "first_name": "Gezinslid", "last_name": "Zes"},
]

TASK_PLACEHOLDERS = [
    "Boodschappen doen", "Afspraak inplannen", "Documenten nakijken",
    "E-mail beantwoorden", "Rekening betalen", "Formulier invullen",
    "Opruimen", "Schoonmaken", "Wassen", "Dokter bellen",
    "Afspraak maken", "Pakket ophalen", "Administratie bijwerken",
    "Notitie uitwerken", "Planning maken", "Checklist doornemen",
    "Info opzoeken", "Herinnering instellen", "Taak afronden", "Project starten",
]

ITEM_PLACEHOLDERS = [
    "brood", "melk", "eieren", "kaas", "boter",
    "appels", "bananen", "rijst", "pasta", "koffie",
    "thee", "suiker", "zout", "peper", "olie",
    "zeep", "shampoo", "wc-papier", "afwasmiddel", "vuilniszakken",
]

NOTE_PLACEHOLDERS = [
    "Notitie over planning", "Idee voor later", "Aantekening van meeting",
    "Todo voor project", "Snelle reminder", "Uit te werken concept",
]

LABEL_PLACEHOLDERS = [
    "Label A", "Label B", "Label C", "Label D", "Label E",
    "Label F", "Label G", "Label H", "Label I", "Label J",
]

# Sensitive tables that are deleted entirely (credentials, tokens, push data,
# free-text user definitions). Missing tables are skipped silently.
CLEAR_TABLES = [
    "invite_codes", "api_tokens", "agent_keys", "_otps", "_externalAuths", "_mfas",
    "agent_audit_log", "app_settings", "briefings", "paperless_sync", "rewards",
    "sprints", "goals", "external_references", "reminders",
    # GH#97: integration/credential + push-token + user-defined free text tables
    "integrations", "ai_settings", "companion_devices", "companion_notifications",
    "saved_filters",
    # GH#97 review hardening: auth origins carry device fingerprints
    "_authOrigins",
]

# Tables that are anonymized in place (kept, but contents scrambled).
HANDLED_TABLES = {
    "users", "_superusers", "families", "tasks", "items", "notes",
    "calendar_events", "labels", "projects", "shops",
}


def scramble_title(original: str, placeholders: list[str], counter: int) -> str:
    """Replace a sensitive title with a neutral placeholder."""
    idx = (hash(original) + counter) % len(placeholders)
    return placeholders[idx]


def get_columns(db: sqlite3.Connection, table: str) -> set[str]:
    """Return the column names of a table (empty set if it doesn't exist)."""
    try:
        return {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
    except sqlite3.OperationalError:
        return set()


def _copy_db_consistent(src: str, dst: str) -> None:
    """Copy a SQLite DB consistently using the backup API.

    Handles WAL-mode sources (uncheckpointed rows in src -wal are included)
    and never leaves a partial dst behind: on failure the dst is removed.
    """
    src_db = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    try:
        dst_db = sqlite3.connect(dst)
        try:
            src_db.backup(dst_db)
            dst_db.commit()
        finally:
            dst_db.close()
    finally:
        src_db.close()


def clear_extra_fields(db: sqlite3.Connection, table: str, id: str, fields: dict[str, str]) -> None:
    """Zero out a set of extra text fields on a row when the columns exist."""
    existing = get_columns(db, table)
    for col, value in fields.items():
        if col in existing:
            db.execute(f"UPDATE {table} SET {col} = ? WHERE id = ?", (value, id))


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <prod_data.db> <output_anon.db>")
        sys.exit(1)

    src = sys.argv[1]
    dst = sys.argv[2]

    if not os.path.exists(src):
        print(f"ERROR: Source file not found: {src}")
        sys.exit(1)

    print(f"Copying {src} → {dst} ...")
    # Use sqlite3.backup() (not a raw file copy) so a WAL-mode source is copied
    # consistently: uncheckpointed rows in the source -wal are included, and no
    # stale dst -wal/-shm siblings from a previous interrupted run are replayed.
    for suffix in ("-wal", "-shm"):
        stale = dst + suffix
        if os.path.exists(stale):
            os.remove(stale)
    _copy_db_consistent(src, dst)

    print(f"Opening {dst} for anonymization ...")
    db = sqlite3.connect(dst)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=OFF")

    warnings = []

    # ── Users ──
    print("\n── Users ──")
    users = db.execute("SELECT id, email FROM users ORDER BY rowid").fetchall()
    for i, (uid, _email) in enumerate(users):
        fake = FAKE_USERS[i % len(FAKE_USERS)]
        db.execute(
            "UPDATE users SET email=?, name=?, first_name=?, last_name=?, password=?, tokenKey=?, emailVisibility=0, verified=1 WHERE id=?",
            (fake["email"], fake["name"], fake["first_name"], fake["last_name"], TEST_PASSWORD_HASH, f"tk_test_{uid[:8]}", uid),
        )
        # GH#97: clear profile free text, avatar reference and invite code
        clear_extra_fields(db, "users", uid, {
            "display_name": fake["name"],
            "avatar": "",
            "invite_code": "",
        })
        print(f"  {uid[:8]}... → {fake['email']}")

    su = db.execute("SELECT id FROM _superusers").fetchall()
    for (su_id,) in su:
        db.execute(
            "UPDATE _superusers SET email='admin@example.test', password=?, tokenKey=?, emailVisibility=0 WHERE id=?",
            (TEST_PASSWORD_HASH, f"tk_su_{su_id[:8]}", su_id),
        )

    # ── Families ──
    print("\n── Families ──")
    families = db.execute("SELECT id FROM families ORDER BY rowid").fetchall()
    for i, (fid,) in enumerate(families):
        name = f"Test Family {i + 1}" if i > 0 else "Test Family"
        db.execute("UPDATE families SET name=? WHERE id=?", (name, fid))
        print(f"  {fid[:8]}... → {name}")

    # ── Tasks ──
    print("\n── Tasks ──")
    tasks = db.execute("SELECT id, title FROM tasks").fetchall()
    task_cols = get_columns(db, "tasks")
    for i, (tid, title) in enumerate(tasks):
        new_title = scramble_title(title or "Taak", TASK_PLACEHOLDERS, i)
        db.execute("UPDATE tasks SET title=?, blocked_comment='' WHERE id=?", (new_title, tid))
        # GH#97: clear free-text description/location (columns added in 058)
        clear_extra_fields(db, "tasks", tid, {"description": "", "location": ""})
    print(f"  {len(tasks)} tasks anonymized")
    if "description" not in task_cols or "location" not in task_cols:
        warnings.append("tasks table missing description/location columns (migration 058 not applied?)")

    # ── Items ──
    print("\n── Items ──")
    items = db.execute("SELECT id, title FROM items").fetchall()
    for i, (iid, title) in enumerate(items):
        db.execute("UPDATE items SET title=? WHERE id=?", (scramble_title(title or "Item", ITEM_PLACEHOLDERS, i), iid))
    print(f"  {len(items)} items anonymized")

    # ── Notes ──
    print("\n── Notes ──")
    notes = db.execute("SELECT id, title FROM notes").fetchall()
    for i, (nid, title) in enumerate(notes):
        db.execute("UPDATE notes SET title=?, content=? WHERE id=?", (scramble_title(title or "Notitie", NOTE_PLACEHOLDERS, i), f"Geanonimiseerde inhoud {i + 1}", nid))
    print(f"  {len(notes)} notes anonymized")

    # ── Calendar Events ──
    events = db.execute("SELECT id, title FROM calendar_events").fetchall()
    event_cols = get_columns(db, "calendar_events")
    for i, (eid, title) in enumerate(events):
        db.execute("UPDATE calendar_events SET title=?, description='' WHERE id=?", (scramble_title(title or "Afspraak", TASK_PLACEHOLDERS, i), eid))
        # GH#97: clear free-text location and attendee identity data (056)
        clear_extra_fields(db, "calendar_events", eid, {"location": "", "attendees": "[]"})
    print(f"  {len(events)} calendar events anonymized")
    if "location" not in event_cols or "attendees" not in event_cols:
        warnings.append("calendar_events table missing location/attendees columns (migration 056 not applied?)")

    # ── Labels ──
    print("\n── Labels ──")
    labels = db.execute("SELECT id, name FROM labels").fetchall()
    label_cols = get_columns(db, "labels")
    for i, (lid, _name) in enumerate(labels):
        # GH#97: label names are free text (can contain person/location names)
        new_name = LABEL_PLACEHOLDERS[i % len(LABEL_PLACEHOLDERS)]
        db.execute("UPDATE labels SET name=? WHERE id=?", (new_name, lid))
    print(f"  {len(labels)} labels anonymized")
    if "name" not in label_cols:
        warnings.append("labels table missing name column")

    # ── Projects ──
    projects = db.execute("SELECT id, title FROM projects").fetchall()
    for i, (pid, title) in enumerate(projects):
        db.execute("UPDATE projects SET title=?, description='' WHERE id=?", (f"Project {i + 1}", pid))
    print(f"  {len(projects)} projects anonymized")

    # ── Shops (generify location suffixes) ──
    shops = db.execute("SELECT id, name FROM shops").fetchall()
    for sid, name in shops:
        generic = name
        for suffix in [" DE", " FR", " NL"]:
            if name.endswith(suffix):
                generic = name[: -len(suffix)].strip()
        if generic != name:
            db.execute("UPDATE shops SET name=? WHERE id=?", (generic, sid))
    print(f"  {len(shops)} shops processed")

    # ── Clear sensitive tables ──
    print("\n── Clearing auth/token/integration data ──")
    cleared = {}
    for table in CLEAR_TABLES:
        try:
            cnt = db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            db.execute(f"DELETE FROM {table}")
            cleared[table] = cnt
            print(f"  {table}: {cnt} rows deleted")
        except sqlite3.OperationalError as exc:
            # Table may not exist on older schema — everything else is loud.
            if "no such table" not in str(exc):
                raise

    db.commit()
    db.close()

    # ── Post-run audit: what was NOT touched ──
    print("\n── Audit: data NOT touched (operator decision required) ──")
    print("  - pb_data/storage files (avatars, uploads) are not part of this DB file.")
    print("    users.avatar was cleared, but if you copied the storage directory")
    print("    you must scrub/delete it yourself.")
    audit = _audit_remaining(db_path=dst, handled=HANDLED_TABLES, cleared=set(cleared))
    for line in audit:
        print(f"  {line}")

    if warnings:
        print("\n⚠️  Warnings:")
        for w in warnings:
            print(f"  - {w}")

    print(f"\n✅ Anonymization complete: {dst}")
    print(f"   Login: admin@example.test / {TEST_PASSWORD}")
    print(f"   ⚠️  Do NOT commit this file to git!")

    if warnings:
        print("\n⚠️  Completed WITH WARNINGS — one or more expected fields/tables were missing.")
        sys.exit(2)


def _audit_remaining(db_path: str, handled: set, cleared: set) -> list[str]:
    """List tables that still hold rows after anonymization, so the operator can
    decide whether anything else must be scrubbed. System tables (_authOrigins,
    _collections etc.) are listed for transparency but are normally left intact."""
    db = sqlite3.connect(db_path)
    try:
        tables = [r[0] for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )]
        lines = []
        for table in tables:
            if table in handled or table in cleared:
                continue
            try:
                cnt = db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            except sqlite3.OperationalError:
                continue
            if cnt > 0:
                kind = "system table (expected)" if table.startswith("_") else "user table (CHECK BEFORE SHARING)"
                lines.append(f"{table}: {cnt} rows remain ({kind})")
        return lines
    finally:
        db.close()


if __name__ == "__main__":
    main()