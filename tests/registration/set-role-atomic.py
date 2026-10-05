# set_role writes one transaction (#269): when the target's save fails (tests/fixtures/hooks/zz_failpoint.pb.js
# refuses to save a user named FAILPOINT), the previous owner and the other admin keep their roles instead of being
# left demoted with no new owner. Against a fresh PocketBase; driven by scripts/test-registration-and-roles.sh.
import json, sys, urllib.request, urllib.error
B = sys.argv[1]; PW = 'Probe-Passw0rd-1'
def req(m, p, d=None, t=None):
    r = urllib.request.Request(B + p, method=m, data=json.dumps(d).encode() if d is not None else None,
                               headers={'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + t} if t else {})})
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def login(e):
    st, d = req('POST', '/api/collections/users/auth-with-password', {'identity': e, 'password': PW}); assert st == 200, (e, st, d); return d['token'], d['record']
def reg(e, n, **kw): return req('POST', '/api/register', {'email': e, 'password': PW, 'passwordConfirm': PW, 'name': n, 'user_type': 'family_member', 'language': 'en', **kw})
def role(uid, t): return req('GET', f'/api/collections/users/records/{uid}', None, t)[1].get('role')
assert reg('o@p.test', 'O', family_name='F')[0] == 201
ot, o = login('o@p.test')
assert req('POST', '/api/v1', {'action': 'set_role', 'user_id': o['id'], 'role': 'owner'}, ot)[0] == 200
ids = {}
for n, name in (('a', 'A'), ('t', 'FAILPOINT')):
    _, inv = req('POST', '/api/invites/create', {'type': 'human'}, ot); assert reg(f'{n}@p.test', name, invite_code=inv['code'])[0] == 201
    ids[n] = login(f'{n}@p.test')[1]['id']
assert req('POST', '/api/v1', {'action': 'set_role', 'user_id': ids['a'], 'role': 'admin'}, ot)[0] == 200
def roles(): return (role(o['id'], ot), role(ids['a'], ot), role(ids['t'], ot))
assert roles() == ('owner', 'admin', 'member'), roles()
st, d = req('POST', '/api/v1', {'action': 'set_role', 'user_id': ids['t'], 'role': 'owner'}, ot)
ok = st == 400 and 'ailpoint' in str(d.get('error', '')) and roles() == ('owner', 'admin', 'member')
print(('PASS ' if ok else 'FAIL ') + f'a failed transfer leaves every role as it was [status {st}, roles (owner, admin, target) {roles()}]')
sys.exit(0 if ok else 1)
