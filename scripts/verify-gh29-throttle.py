#!/usr/bin/env python3
"""GH#29 verification: boot PB with modified hooks, prove last_used_at
throttle works (1 write / 60s) end-to-end.

Flow: register admin -> create agent key -> rapid auth-test calls must NOT
advance last_used_at -> backdate last_used_at >60s -> auth-test MUST advance.

Usage:
  bash scripts/verify-gh29-throttle.py              # needs ./pocketbase or PB_BIN
  PB_BIN=/path/to/pocketbase bash scripts/verify-gh29-throttle.py
"""
import json, os, shutil, sqlite3, subprocess, sys, tempfile, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PB_BIN = os.environ.get("PB_BIN") or shutil.which("pocketbase") or os.path.join(ROOT, "pocketbase")
PORT = int(os.environ.get("PB_PORT", "8099"))
BASE = f"http://127.0.0.1:{PORT}"

def req(method, path, token=None, body=None, raw=False):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            text = resp.read().decode()
            return resp.status, (text if raw else (json.loads(text) if text else None))
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        return e.code, (text if raw else (json.loads(text) if text else None))

def boot():
    data_dir = tempfile.mkdtemp(prefix="pb-gh29-")
    logf = open(os.path.join(data_dir, "serve.log"), "w")
    p = subprocess.Popen(
        [PB_BIN, "serve", f"--http=127.0.0.1:{PORT}", f"--dir={data_dir}/pb_data",
         f"--migrationsDir={ROOT}/pb_migrations", f"--hooksDir={ROOT}/pb_hooks", "--automigrate"],
        stdout=logf, stderr=subprocess.STDOUT, cwd=ROOT)
    return p, logf, data_dir

def wait_ready(p, logf, data_dir):
    for _ in range(60):
        if p.poll() is not None:
            print("PB EXITED EARLY"); logf.flush(); print(open(os.path.join(data_dir, "serve.log")).read()); sys.exit(1)
        try:
            st, _ = req("GET", "/api/hook-health")
            if st == 200:
                return
        except Exception:
            pass
        time.sleep(1)
    print("PB NOT HEALTHY"); sys.exit(1)

def main():
    p, logf, data_dir = boot()
    try:
        wait_ready(p, logf, data_dir)
        print("[1] PB healthy on", BASE)

        st, d = req("POST", "/api/register", body={
            "email": "gh29@verify.test", "password": "password123", "passwordConfirm": "password123",
            "name": "GH29 Verify", "family_name": "Verify Family", "user_type": "family_member", "language": "en",
        })
        assert st == 201, f"register failed {st}: {d}"
        uid = d["user"]["id"]
        print("[2] admin registered", uid)

        st, d = req("POST", "/api/collections/users/auth-with-password", body={"identity": "gh29@verify.test", "password": "password123"})
        assert st == 200, f"auth failed {st}: {d}"
        token = d["token"]
        print("[3] admin token obtained")

        st, d = req("POST", "/api/agent/keys", token=token, body={"name": "throttle-test", "scopes": ["entries:read"]})
        assert st == 201, f"key create failed {st}: {d}"
        raw_key = d["key"]
        key_id = d["id"]
        print("[4] agent key created", key_id)

        def last_used():
            st, d = req("GET", "/api/agent/keys", token=token)
            assert st == 200, f"key list failed {st}: {d}"
            for k in d:
                if k["id"] == key_id:
                    return k.get("last_used_at")
            raise AssertionError("key not in list")

        # --- Throttle: rapid requests must not advance last_used_at ----
        st, d = req("GET", "/api/agent/auth-test", token=raw_key)
        assert st == 200 and d.get("authenticated"), f"auth-test failed {st}: {d}"
        t1 = last_used()
        assert t1, "expected last_used_at after first call"
        print("[5] first auth-test set last_used_at =", t1)

        time.sleep(1.2)
        st, d = req("GET", "/api/agent/auth-test", token=raw_key)
        assert st == 200, f"auth-test #2 failed {st}: {d}"
        t2 = last_used()
        assert t2 == t1, f"THROTTLE FAILED: last_used_at advanced {t1} -> {t2}"
        print("[6] second auth-test (1.2s later) did NOT advance last_used_at:", t2)

        time.sleep(1.2)
        st, d = req("GET", "/api/agent/auth-test", token=raw_key)
        t3 = last_used()
        assert t3 == t1, f"THROTTLE FAILED: third call advanced {t1} -> {t3}"
        print("[7] third auth-test did NOT advance last_used_at:", t3)

        # --- Window elapse: backdate >60s, next call MUST advance ----
        db = os.path.join(data_dir, "pb_data", "data.db")
        con = sqlite3.connect(db)
        con.execute("UPDATE agent_keys SET last_used_at = datetime('now','-120 seconds') WHERE id = ?", (key_id,))
        con.commit()
        con.close()
        old = last_used()
        st, d = req("GET", "/api/agent/auth-test", token=raw_key)
        assert st == 200, f"auth-test after backdate failed {st}: {d}"
        new = last_used()
        assert new != old and (new or ""), f"FALIED: backdated {old} still not advanced -> {new}"
        print("[8] after backdating >60s, auth-test advanced last_used_at:", old, "->", new)

        print("\nALL GH#29 THROTTLE CHECKS PASSED")
        return 0
    finally:
        p.terminate()
        try: p.wait(timeout=10)
        except Exception: p.kill()
        logf.close()
        shutil.rmtree(data_dir, ignore_errors=True)

if __name__ == "__main__":
    sys.exit(main())