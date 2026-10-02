/// <reference path="../pb_data/types.d.ts" />

// Password-reset links carry the token in the URL fragment instead of the
// query string: {APP_URL}/reset-password#token={TOKEN}. Browsers never send
// the fragment to the server, so the token no longer reaches access logs or
// Referer headers. The app still accepts ?token= from mails sent before this
// release (src/lib/url-secrets.ts).
//
// Rewrites the link z071 installed (and the stock PocketBase link, should an
// install still have it). A template an admin customised in the dashboard is
// left untouched. Idempotent (GH#34): a second run finds nothing to replace.
const QUERY_LINK = '{APP_URL}/reset-password?token={TOKEN}';
const STOCK_LINK = '{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}';
const FRAGMENT_LINK = '{APP_URL}/reset-password#token={TOKEN}';

function rewrite(app, from, to) {
  let users;
  try {
    users = app.findCollectionByNameOrId('users');
  } catch (_) {
    return;
  }
  const template = users.resetPasswordTemplate;
  if (!template) return;
  let body = String(template.body || '');
  let changed = false;
  for (const old of from) {
    if (body.indexOf(old) === -1) continue;
    body = body.split(old).join(to);
    changed = true;
  }
  if (!changed) return;
  template.body = body;
  users.resetPasswordTemplate = template;
  app.save(users);
}

migrate(
  (app) => rewrite(app, [QUERY_LINK, STOCK_LINK], FRAGMENT_LINK),
  (app) => rewrite(app, [FRAGMENT_LINK], QUERY_LINK)
);
