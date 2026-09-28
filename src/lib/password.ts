/**
 * Minimum password length, in characters.
 *
 * Must match the server-side `users` collection schema (password field `min: 8`)
 * and the explicit check in the `/api/register` bootstrap flow (pb_hooks/main.pb.js).
 *
 * All registration / password-change forms validate against this single constant,
 * so the client can never accept a password the server would reject (GH#67).
 */
export const PASSWORD_MIN_LENGTH = 8;