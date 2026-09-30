/**
 * Classifies a failed data load so the UI can tell the user what actually
 * happened instead of showing an empty (or raw backend) state:
 *   offline   — no network / server unreachable (PocketBase reports status 0)
 *   auth      — the session is no longer valid (401): sign in again
 *   forbidden — signed in but not allowed (403, e.g. blocked/pending member)
 *   server    — backend failure (5xx)
 *   unknown   — anything else
 */
export type LoadErrorKind = 'offline' | 'auth' | 'forbidden' | 'server' | 'unknown';

export function classifyLoadError(error: unknown, online: boolean = typeof navigator === 'undefined' ? true : navigator.onLine): LoadErrorKind {
  if (!online) return 'offline';
  const status = typeof error === 'object' && error !== null ? (error as { status?: unknown }).status : undefined;
  if (status === 0 || error instanceof TypeError) return 'offline';
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (typeof status === 'number' && status >= 500) return 'server';
  return 'unknown';
}
