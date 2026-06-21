#!/usr/bin/env python3
"""
Anonymize a PocketBase production database for safe use in dev.

Usage:
  python3 scripts/anonymize-prod-to-dev.py <prod_data.db> <output_anon.db>

What it does:
  - Replaces real names/emails with test equivalents
  - Resets password hashes to a known test password
  - Replaces sensitive task/item titles with neutral placeholders
  - Clears invite codes, API tokens, and agent keys
  - Preserves: IDs, relations, dates, statuses, repeat intervals, structure

IMPORTANT: The raw prod dump must NEVER be committed to git or left on dev.
"""

import sqlite3
import hashlib
import shutil
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


def scramble_title(original: str, placeholders: list[str], counter: int) -> str:
    """Replace a sensitive title with a neutral placeholder."""
    idx = (hash(original) + counter) % len(placeholders)
    return placeholders[idx]


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
    shutil.copy2(src, dst)

    print(f"Opening {dst} for anonymization ...")
    db = sqlite3.connect(dst)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=OFF")

    # ── Users ──
    print("\n── Users ──")
    users = db.execute("SELECT id, email FROM users ORDER BY rowid").fetchall()
    for i, (uid, _email) in enumerate(users):
        fake = FAKE_USERS[i % len(FAKE_USERS)]
        db.execute(
            "UPDATE users SET email=?, name=?, first_name=?, last_name=?, password=?, tokenKey=?, emailVisibility=0, verified=1 WHERE id=?",
            (fake["email"], fake["name"], fake["first_name"], fake["last_name"], TEST_PASSWORD_HASH, f"tk_test_{uid[:8]}", uid),
        )
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
    for i, (tid, title) in enumerate(tasks):
        new_title = scramble_title(title or "Taak", TASK_PLACEHOLDERS, i)
        db.execute("UPDATE tasks SET title=?, blocked_comment='' WHERE id=?", (new_title, tid))
    print(f"  {len(tasks)} tasks anonymized")

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
    for i, (eid, title) in enumerate(events):
        db.execute("UPDATE calendar_events SET title=?, description='' WHERE id=?", (scramble_title(title or "Afspraak", TASK_PLACEHOLDERS, i), eid))
    print(f"  {len(events)} calendar events anonymized")

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
    print("\n── Clearing auth/token data ──")
    for table in ["invite_codes", "api_tokens", "agent_keys", "_otps", "_externalAuths", "_mfas",
                   "agent_audit_log", "app_settings", "briefings", "paperless_sync", "rewards",
                   "sprints", "goals", "external_references", "reminders"]:
        try:
            cnt = db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            db.execute(f"DELETE FROM {table}")
            print(f"  {table}: {cnt} rows deleted")
        except sqlite3.OperationalError:
            pass  # Table may not exist

    db.commit()
    db.close()

    print(f"\n✅ Anonymization complete: {dst}")
    print(f"   Login: admin@example.test / {TEST_PASSWORD}")
    print(f"   ⚠️  Do NOT commit this file to git!")


if __name__ == "__main__":
    main()
