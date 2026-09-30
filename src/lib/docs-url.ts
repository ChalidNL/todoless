/**
 * Where Settings -> "API documentation" points.
 *
 * Default: the Swagger UI every todoless install serves itself at /api/docs
 * (pb_hooks/11_docs.pb.js, proxied by nginx). It only documents the API — it
 * cannot mint tokens; API tokens are created per member inside the app.
 *
 * VITE_DOCS_URL may point at public documentation (e.g. the todoless website).
 * Only same-origin absolute paths and http(s) URLs are accepted; anything else
 * (javascript:, data:, protocol-relative //host, typos) falls back to the
 * built-in docs so a bad build variable can never produce a broken or unsafe link.
 */
export const DEFAULT_DOCS_URL = '/api/docs';

export function resolveDocsUrl(configured: string | undefined | null): string {
  const value = configured?.trim();
  if (!value) return DEFAULT_DOCS_URL;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
  } catch {
    // fall through to the built-in docs
  }
  return DEFAULT_DOCS_URL;
}
