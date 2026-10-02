# Owner-role rules (review S9/S14) against a fresh PocketBase; driven by
# scripts/test-registration-and-roles.sh.
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
ids = {}
for n in ('a', 'b'):
    _, inv = req('POST', '/api/invites/create', {'type': 'human'}, ot); assert reg(f'{n}@p.test', n, invite_code=inv['code'])[0] == 201
    ids[n] = login(f'{n}@p.test')[1]['id']
ok = True
def check(name, cond, detail=''):
    global ok; ok &= bool(cond); print(('PASS ' if cond else 'FAIL ') + name + (f' [{detail}]' if detail else ''))
st, _ = req('POST', '/api/v1', {'action': 'set_role', 'user_id': o['id'], 'role': 'owner'}, ot)
check('admin of a family without owner may claim owner (GH#23)', st == 200 and role(o['id'], ot) == 'owner', st)
st, _ = req('POST', '/api/v1', {'action': 'set_role', 'user_id': ids['a'], 'role': 'admin'}, ot)
check('S9: owner promotes a member to admin and stays owner', st == 200 and role(o['id'], ot) == 'owner' and role(ids['a'], ot) == 'admin', (st, role(o['id'], ot)))
at, _ = login('a@p.test')
st, d = req('POST', '/api/v1', {'action': 'set_role', 'user_id': ids['a'], 'role': 'owner'}, at)
check('S14: an admin cannot make themselves owner', st == 403 and role(o['id'], ot) == 'owner', (st, d))
st, d = req('POST', '/api/v1', {'action': 'set_role', 'user_id': ids['b'], 'role': 'owner'}, at)
check('S14: an admin cannot hand out owner either', st == 403, (st, d))
st, d = req('POST', '/api/v1', {'action': 'set_role', 'user_id': o['id'], 'role': 'member'}, at)
check('the owner cannot be demoted by an admin', st == 403 and role(o['id'], ot) == 'owner', (st, d))
st, _ = req('POST', '/api/v1', {'action': 'set_role', 'user_id': ids['b'], 'role': 'owner'}, ot)
check('the owner transfers ownership; previous owner becomes admin, other admin member', st == 200 and role(ids['b'], ot) == 'owner' and role(o['id'], ot) == 'admin' and role(ids['a'], ot) == 'member', (st, role(ids['b'], ot), role(o['id'], ot), role(ids['a'], ot)))
sys.exit(0 if ok else 1)
