/**
 * Central Version Configuration
 *
 * This is the single source of truth for version information.
 * Update this file to change the version across the entire app.
 */

export const VERSION = '0.0.54';

/**
 * Detect if running in test/development environment based on runtime URL
 * Production: deployed via git (non-local domains)
 * Test/Dev: localhost, 192.168.x.x, 127.0.0.1, or other local IPs
 */
export function isTestOrDevEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname;

  // Check for localhost variations
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return true;
  }

  // Check for local IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  if (
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
  ) {
    return true;
  }
  // All other domains are considered production
  return false;
}

export const ENV = import.meta.env.VITE_ENV || 'prod';

/**
 * Get the full version string including environment suffix
 * In test/dev (runtime detection): shows "TEST v0.0.4"
 * In prod: shows "v0.0.4"
 */
export function getVersionString(): string {
  return isTestOrDevEnvironment() ? `TEST v${VERSION}` : `v${VERSION}`;
}

/**
 * Get just the version number (no prefix, no suffix)
 */
export function getVersion(): string {
  return VERSION;
}
