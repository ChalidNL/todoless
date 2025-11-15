/**
 * Central Version Configuration
 *
 * This is the single source of truth for version information.
 * Update this file to change the version across the entire app.
 */

export const VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
export const ENV = import.meta.env.VITE_ENV || 'prod';

/**
 * Get the full version string including environment suffix
 * In non-prod: shows "TEST v0.0.4"
 * In prod: shows "v0.0.4"
 */
export function getVersionString(): string {
  return ENV !== 'prod' ? `TEST v${VERSION}` : `v${VERSION}`;
}

/**
 * Get just the version number (no prefix, no suffix)
 */
export function getVersion(): string {
  return VERSION;
}
