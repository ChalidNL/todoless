/// <reference path="../pb_data/types.d.ts" />

const TOKEN_KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomTokenKey() {
  let value = '';
  for (let i = 0; i < 50; i += 1) {
    value += TOKEN_KEY_ALPHABET.charAt(Math.floor(Math.random() * TOKEN_KEY_ALPHABET.length));
  }
  return value;
}

migrate(
  (app) => {
    const users = app.findRecordsByFilter('users', '', '', 10000, 0);
    for (const user of users) {
      const current = String(user.get('tokenKey') || '');
      if (current.length < 30 || current.length > 60) {
        user.set('tokenKey', randomTokenKey());
        app.save(user);
      }
    }
  },
  () => {
    // No rollback: tokenKey is a required PocketBase auth system field.
  },
);
