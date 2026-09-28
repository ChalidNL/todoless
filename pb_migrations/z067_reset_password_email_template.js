/// <reference path="../pb_data/types.d.ts" />

// Migration z067: Point the users password-reset email template at the SPA
// reset page.
//
// PocketBase's default template emails `{APPURL}/_/#/confirm-password-reset/{TOKEN}`,
// but the public nginx deliberately blocks `/_/` (returns 404) so the default
// link can never reach the app. This migration rewrites the template so reset
// links land on the frontend route `/reset-password?token={TOKEN}`.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.resetPasswordTemplate.subject = 'Reset your todoless password';
    users.resetPasswordTemplate.body =
      '<p>Hello,</p>\n' +
      '<p>Click the button below to set a new password for your todoless account:</p>\n' +
      '<p><a href="{APPURL}/reset-password?token={TOKEN}">Set a new password</a></p>\n' +
      '<p><em>If you didn\'t ask to reset your password, you can ignore this email.</em></p>';
    app.save(users);
  },
  (app) => {
    // Restore the PocketBase default template on rollback.
    const users = app.findCollectionByNameOrId('users');
    users.resetPasswordTemplate.subject = 'Reset your password';
    users.resetPasswordTemplate.body =
      '<p>Hello,</p>\n' +
      '<p>Click the button below to set a new password:</p>\n' +
      '<p><a href="{APPURL}/_/#/confirm-password-reset/{TOKEN}">Set a new password</a></p>\n' +
      '<p><em>If you didn\'t ask to reset your password, you can ignore this email.</em></p>';
    app.save(users);
  }
);