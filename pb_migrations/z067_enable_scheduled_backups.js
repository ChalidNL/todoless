/// <reference path="../pb_data/types.d.ts" />

// Migration z067: Enable PocketBase's built-in scheduled backups (GH#52)
//
// PocketBase ships a transaction-safe backup feature (zip snapshot of pb_data,
// including uploaded files) that runs while the app is up. We enable it by
// default so self-hosters get consistent backups without stopping the container:
//   - backups.cron        -> daily at 02:00 server time (Europe/Amsterdam in compose)
//   - backups.cronMaxKeep -> keep the newest 7 cron backups, delete older zips
//
// Resulting zips live in <pb_data>/backups (host default:
// /DATA/AppData/todoless/pb_data/backups) and can be downloaded/restored from
// the admin dashboard (Settings -> Backups), where the schedule/retention can
// also be changed or mirrored to S3-compatible storage - see README -> Backups.

migrate(
  (app) => {
    const settings = app.settings();

    // Only fill in the defaults when backups are not already configured -
    // never override a schedule/retention a user set via Settings -> Backups,
    // and never clobber an S3 config.
    if (!settings.backups.cron) {
      settings.backups.cron = '0 2 * * *';
      settings.backups.cronMaxKeep = 7;

      app.save(settings);
    }
  },
  (app) => {
    // Rollback: disable automatic backups again, but only if the cron still
    // matches this migration's default (keep any manual/S3 setup).
    const settings = app.settings();
    if (settings.backups.cron === '0 2 * * *' && settings.backups.cronMaxKeep === 7) {
      settings.backups.cron = '';
      settings.backups.cronMaxKeep = 0;

      app.save(settings);
    }
  },
);