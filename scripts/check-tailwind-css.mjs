#!/usr/bin/env node
/**
 * Tailwind build drift guard.
 * Runs after `vite build` and asserts that the classes the redesign depends on
 * are actually present in the CSS emitted by the build (not just in source).
 * Fails the build (exit 1) when any curated class/token is missing.
 *
 * Why: src/index.css is now a real Tailwind v4 source (`@import "tailwindcss"`).
 * A future regression could silently drop utilities again; this guard turns that
 * into a build failure.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ASSET_DIR = 'build/assets';

/** CSS-escape decode: `\2c ` / `\(` / `\.` → literal characters. */
function decodeCssEscapes(css) {
  return css
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\(.)/g, '$1');
}

// Curated list of classes/tokens the design relies on:
//  - login gradient + its shadow (the P1 regression that made the button invisible)
//  - touch targets (44px) and sizing utilities used by chips/toggles
//  - guaranteed component CSS sections (onboarding/auth/app surfaces)
//  - design tokens defined in src/styles/tokens.css
const REQUIRED = [
  '.bg-[linear-gradient(135deg,#6366f1,#8b5cf6)]',
  '.shadow-[0_6px_20px_rgba(99,102,241,0.32)]',
  '.h-11',
  '.w-11',
  '.min-h-11',
  '.min-h-[var(--app-touch-target)]',
  '.h-7',
  '.animate-spin',
  '.onboarding-shell',
  '.app-shell-bg',
  '.app-surface',
  '.auth-card',
  '.auth-input',
  '--app-touch-target',
  '--app-primary',
  '--app-surface',
  '--app-radius-card',
  '--app-border-subtle',
  '--app-bottom-nav-height',
];

let cssFiles;
try {
  cssFiles = readdirSync(ASSET_DIR).filter((f) => f.endsWith('.css'));
} catch {
  console.error(`[check-tailwind-css] FAIL: ${ASSET_DIR} not found — did vite build run?`);
  process.exit(1);
}

if (cssFiles.length === 0) {
  console.error('[check-tailwind-css] FAIL: no CSS assets in build/assets');
  process.exit(1);
}

const combined = cssFiles.map((f) => readFileSync(join(ASSET_DIR, f), 'utf8')).join('\n');
const decoded = decodeCssEscapes(combined);

const missing = REQUIRED.filter((cls) => !decoded.includes(cls));

if (missing.length > 0) {
  console.error('[check-tailwind-css] FAIL — missing from built CSS:');
  for (const cls of missing) console.error(`  ✗ ${cls}`);
  console.error(`  assets: ${cssFiles.join(', ')}`);
  process.exit(1);
}

console.log(`[check-tailwind-css] OK — ${REQUIRED.length}/${REQUIRED.length} critical classes/tokens found in ${cssFiles.join(', ')}`);
process.exit(0);