/**
 * Seed a disposable QA dataset on a PocketBase instance (superuser creds required).
 * Usage:
 *   PB_URL=http://127.0.0.1:18090 PB_SUPERUSER=... PB_SUPERUSER_PASS=... node seed.mjs
 * Prints JSON: { family, user, tasks: [...] }
 */
const PB_URL = process.env.PB_URL || 'http://127.0.0.1:18090';
const ADMIN = process.env.PB_SUPERUSER || 'qa-admin@todoless.local';
const ADMIN_PASS = process.env.PB_SUPERUSER_PASS || '';
import { QA_USER } from './config.mjs';

async function api(method, path, body, token) {
  const res = await fetch(PB_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return json;
}

export async function seed() {
  const auth = await api('POST', '/api/collections/_superusers/auth-with-password', {
    identity: ADMIN,
    password: ADMIN_PASS,
  });
  const token = auth.token;

  // family + user (create user first so the family can reference it as created_by)
  const existing = await api(
    'GET',
    `/api/collections/users/records?filter=${encodeURIComponent(`email="${QA_USER.email}"`)}`,
    undefined,
    token,
  );
  let user = existing.items?.[0];
  if (!user) {
    user = await api(
      'POST',
      '/api/collections/users/records',
      {
        email: QA_USER.email,
        password: QA_USER.password,
        passwordConfirm: QA_USER.password,
        name: QA_USER.name,
        verified: true,
        role: 'owner',
        member_type: 'human',
        member_status: 'active',
        language: 'en',
      },
      token,
    );
  }

  let family;
  const famList = await api('GET', '/api/collections/families/records?perPage=1', undefined, token);
  family = famList.items?.[0];
  if (!family) {
    family = await api('POST', '/api/collections/families/records', { name: 'QA Suite Family', created_by: user.id }, token);
  }
  if (!user.family_id) {
    user = await api('PATCH', `/api/collections/users/records/${user.id}`, { family_id: family.id }, token);
  }

  // tasks
  const titles = ['QA regression task alpha', 'QA regression task beta'];
  const tasks = [];
  for (const title of titles) {
    const found = await api(
      'GET',
      `/api/collections/tasks/records?filter=${encodeURIComponent(`title="${title}"`)}`,
      undefined,
      token,
    );
    tasks.push(
      found.items?.[0] ||
        (await api(
          'POST',
          '/api/collections/tasks/records',
          { title, status: 'todo', priority: 'medium', user: user.id, family_id: family.id },
          token,
        )),
    );
  }

  return { family, user, tasks };
}

const out = await seed();
console.log(JSON.stringify({ family: out.family.id, user: out.user.id, email: QA_USER.email, tasks: out.tasks.map((t) => t.id) }));
