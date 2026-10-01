/// <reference path="../pb_data/types.d.ts" />

// #68: the password-reset email linked to PocketBase's admin UI
// ({APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}). nginx only exposes /_/
// to private networks, so for most installs the flow ended at the email. The
// app now has its own page at /reset-password (src/components/ResetPassword).
//
// Only the stock link is rewritten — a template an admin customised in the
// dashboard is left untouched. Idempotent (GH#34): re-running finds nothing
// to replace.
const STOCK_LINK = '{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}';
const APP_LINK = '{APP_URL}/reset-password?token={TOKEN}';

function rewrite(app, from, to) {
  let users;
  try {
    users = app.findCollectionByNameOrId('users');
  } catch (_) {
    return;
  }
  const template = users.resetPasswordTemplate;
  if (!template) return;
  const body = String(template.body || '');
  if (body.indexOf(from) === -1) return;
  template.body = body.split(from).join(to);
  users.resetPasswordTemplate = template;
  app.save(users);
}

migrate(
  (app) => rewrite(app, STOCK_LINK, APP_LINK),
  (app) => rewrite(app, APP_LINK, STOCK_LINK)
);
