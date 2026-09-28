/// <reference path="../pb_data/types.d.ts" />

// GH#37: migration 060_backfill_user_token_keys.js generated `tokenKey`
// values with Math.random() (not cryptographically secure). `tokenKey` is
// part of the per-user JWT signing input, so any weak key must be replaced
// with a CSPRNG-derived value.
//
// A Math.random()-generated key is indistinguishable from a
// $security.randomString() key by inspection (both are 50-char alphanumeric),
// so the only safe sweep is to rotate EVERY user's tokenKey once. PocketBase
// invalidates existing sessions when the key changes — acceptable once, per
// the issue. New sessions are issued on the next login.
//
// This is a NEW migration on purpose: editing 060 in place would trip
// PocketBase's applied-migration checksum tracking on upgraded instances.
migrate(
  (app) => {
    const users = app.findRecordsByFilter('users', '', '', 10000, 0);
    for (const user of users) {
      user.set('tokenKey', $security.randomString(50));
      app.save(user);
    }
  },
  () => {
    // No rollback: tokenKey is a required PocketBase auth system field.
  },
);