/**
 * One-time secrets that arrive in a link: the password-reset token (#68) and
 * the family invite code (#258).
 *
 * New links carry them in the URL fragment (`/reset-password#token=…`,
 * `/register#invite=…`): browsers never send the fragment to the server, so
 * it cannot end up in access logs or in a Referer header. Links sent before
 * v1.0.0 used the query string (`?token=…`, `?invite=…` / `?code=…`) and keep
 * working.
 *
 * `captureUrlSecrets()` runs first thing in main.tsx, before the app makes
 * any request: it moves the secret into memory and rewrites the address bar
 * (and the current history entry) without it, so later requests don't carry
 * it as Referer and the browser history doesn't keep it.
 */
let resetToken = '';
let inviteCode = '';

function paramFrom(source: string, names: string[]): string {
  const params = new URLSearchParams(source.replace(/^[#?]/, ''));
  for (const name of names) {
    const value = params.get(name);
    if (value && value.trim()) return value.trim();
  }
  return '';
}

export function captureUrlSecrets(location: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location): void {
  const path = location.pathname.toLowerCase();
  let found = false;
  if (path === '/reset-password') {
    resetToken = paramFrom(location.hash, ['token']) || paramFrom(location.search, ['token']);
    found = true;
  } else {
    const code = paramFrom(location.hash, ['invite', 'code']) || paramFrom(location.search, ['invite', 'code']);
    if (code) {
      inviteCode = code;
      found = true;
    }
  }
  if (found && (location.search || location.hash)) {
    window.history.replaceState(window.history.state, '', location.pathname);
  }
}

/** The reset token from the link, if this page load came from one. */
export function getResetToken(): string {
  return resetToken;
}

/** The invite code from the link, if this page load came from one. */
export function getLinkInviteCode(): string {
  return inviteCode;
}
