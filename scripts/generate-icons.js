#!/usr/bin/env node
/**
 * Brand icon generator.
 *
 * The ONLY source of truth for the todoless mark is the official logo
 * `docs/assets/logo.png` (1024x1024, transparent; the rainbow box with the
 * checkmark breaking out of its top-right corner). Every in-app, favicon and
 * PWA icon is derived from it here — never redrawn — so the geometry is
 * identical everywhere.
 *
 * Outputs (regular set in public/icons, beta set with a "BETA" pill in
 * public/icons-beta):
 *   logo-mark.png          trimmed mark, transparent (in-app <AppMark>)
 *   icon-192.png/512.png   purpose "any": transparent, mark fills ~84%
 *   icon-*-maskable.png    purpose "maskable": opaque background, the mark is
 *                          scaled so every opaque pixel lies inside the 40%
 *                          radius safe zone (no clipping under circle masks)
 *                          while staying as large as that allows
 *   apple-touch-icon.png   180x180 opaque (iOS fills transparency with black)
 *   favicon.ico            16/32/48 PNG-in-ICO (public/ root for regular)
 *
 * Usage: npm run icons:generate
 */
const { copyFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const sharp = require('sharp');

const root = resolve(__dirname, '..');
const LOGO_SOURCE = resolve(root, 'docs/assets/logo.png');
const publicDir = resolve(root, 'public');
const BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const MASKABLE_SAFE_RADIUS = 0.4;

/** Trimmed RGBA pixels of the mark plus the max distance of an opaque pixel from the bbox centre. */
async function loadMark() {
  const { data, info } = await sharp(LOGO_SOURCE).ensureAlpha().trim({ threshold: 1 }).raw().toBuffer({ resolveWithObject: true });
  const cx = info.width / 2;
  const cy = info.height / 2;
  let maxDistance = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 24) {
        maxDistance = Math.max(maxDistance, Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
      }
    }
  }
  const png = await sharp(data, { raw: info }).png().toBuffer();
  return { png, width: info.width, height: info.height, maxDistance };
}

function betaBadge(size) {
  const width = Math.round(size * 0.34);
  const height = Math.round(size * 0.13);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    + `<rect width="${width}" height="${height}" rx="${Math.round(height / 2)}" fill="#7C3AED"/>`
    + `<text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${Math.round(height * 0.58)}" letter-spacing="1" fill="#fff">BETA</text>`
    + '</svg>';
  return { input: Buffer.from(svg), width, height };
}

/** Render the mark centred on a square canvas, its bbox scaled by `scale` of the canvas. */
async function renderIcon(mark, size, { scale, background, beta, safeRadius }) {
  let factor = (size * scale) / Math.max(mark.width, mark.height);
  if (safeRadius) factor = Math.min(factor, (size * safeRadius) / mark.maxDistance);
  const w = Math.round(mark.width * factor);
  const h = Math.round(mark.height * factor);
  const layers = [{ input: await sharp(mark.png).resize(w, h).png().toBuffer(), left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }];
  if (beta) {
    const badge = betaBadge(size);
    // Bottom-centre keeps the pill inside the maskable safe zone.
    layers.push({ input: badge.input, left: Math.round((size - badge.width) / 2), top: Math.round(size * 0.86 - badge.height) });
  }
  return sharp({ create: { width: size, height: size, channels: 4, background } }).composite(layers).png({ compressionLevel: 9 }).toBuffer();
}

/** Minimal PNG-in-ICO container (supported by every current browser). */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, png } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.png)]);
}

async function generateSet(mark, dir, beta) {
  mkdirSync(dir, { recursive: true });
  const write = (name, buf) => {
    writeFileSync(resolve(dir, name), buf);
    console.log(`  ✓ ${resolve(dir, name).replace(`${root}/`, '')}`);
  };
  write('logo-mark.png', await sharp(mark.png).resize(256, 256, { fit: 'contain', background: TRANSPARENT }).png({ compressionLevel: 9 }).toBuffer());
  for (const size of [192, 512]) {
    write(`icon-${size}.png`, await renderIcon(mark, size, { scale: 0.84, background: TRANSPARENT, beta }));
    write(`icon-${size}-maskable.png`, await renderIcon(mark, size, { scale: 0.8, background: BACKGROUND, beta, safeRadius: MASKABLE_SAFE_RADIUS }));
  }
  write('apple-touch-icon.png', await renderIcon(mark, 180, { scale: 0.7, background: BACKGROUND, beta }));
  const favicons = [];
  for (const size of [16, 32, 48]) {
    favicons.push({ size, png: await renderIcon(mark, size, { scale: 0.96, background: TRANSPARENT, beta: false }) });
  }
  write('favicon.ico', buildIco(favicons));
}

async function main() {
  const mark = await loadMark();
  console.log(`[source] ${LOGO_SOURCE.replace(`${root}/`, '')}: mark ${mark.width}x${mark.height}`);
  await generateSet(mark, resolve(publicDir, 'icons'), false);
  await generateSet(mark, resolve(publicDir, 'icons-beta'), true);
  // Browsers request /favicon.ico by default; the regular set is served there.
  copyFileSync(resolve(publicDir, 'icons/favicon.ico'), resolve(publicDir, 'favicon.ico'));
  console.log('  ✓ public/favicon.ico');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
