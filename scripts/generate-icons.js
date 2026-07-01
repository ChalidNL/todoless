#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, chmodSync } = require('node:fs');
const { resolve } = require('node:path');
const sharp = require('sharp');

const root = resolve(__dirname, '..');
const publicDir = resolve(root, 'public');
const iconDir = resolve(publicDir, 'icons');
const svgSource = resolve(iconDir, 'icon-source.svg');
const pngSource = resolve(iconDir, 'icon-source.png');
const logoSrc = resolve(publicDir, 'logo-rainbow.png');

const svgBuf = readFileSync(svgSource);

async function generatePng(size, filename, opts = {}) {
  const contentSize = opts.contentSize ?? Math.round(size * 0.72);
  const left = Math.round((size - contentSize) / 2);
  const top = Math.round((size - contentSize) / 2);

  const pngBuf = await sharp(svgBuf)
    .resize(contentSize, contentSize)
    .extend({
      top, bottom: size - contentSize - top,
      left, right: size - contentSize - left,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  writeFileSync(filename, pngBuf);
  console.log(`  ✓ ${filename} (${size}x${size})`);
}

async function main() {
  mkdirSync(iconDir, { recursive: true });

  // Generate base PNG from SVG (512x512 full-bleed for favicon)
  const basePng = await sharp(svgBuf).resize(512, 512).png().toBuffer();
  writeFileSync(pngSource, basePng);
  writeFileSync(logoSrc, basePng);
  copyFileSync(logoSrc, resolve(iconDir, 'logo-rainbow.png'));
  chmodSync(pngSource, 0o644);
  chmodSync(logoSrc, 0o644);
  chmodSync(resolve(iconDir, 'logo-rainbow.png'), 0o644);
  console.log('Generated base PNG from SVG source');

  // Generate PWA icon set
  await generatePng(192, resolve(iconDir, 'icon-192.png'));
  await generatePng(512, resolve(iconDir, 'icon-512.png'));
  await generatePng(512, resolve(iconDir, 'icon-512-maskable.png'), { contentSize: 340 });

  // SVG wrappers for icons
  for (const size of [192, 512]) {
    writeFileSync(
      resolve(iconDir, `icon-${size}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n  <image href="/icons/icon-${size}.png" width="${size}" height="${size}"/>\n</svg>\n`,
    );
  }

  // Favicon SVG with embedded base64
  const faviconPng = readFileSync(resolve(iconDir, 'icon-512.png')).toString('base64');
  writeFileSync(
    resolve(publicDir, 'favicon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n  <image href="data:image/png;base64,${faviconPng}" width="512" height="512"/>\n</svg>\n`,
  );
  console.log('  ✓ favicon.svg');

  // Manifest
  const manifest = {
    name: 'todoless',
    short_name: 'todoless',
    description: 'Self-hosted productivity app',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#f8f7ff',
    theme_color: '#f8f7ff',
    categories: ['productivity', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [],
    launch_handler: { client_mode: 'navigate-existing' },
  };
  writeFileSync(resolve(publicDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(resolve(publicDir, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('  ✓ manifest.json / manifest.webmanifest');

  console.log('\nDone! PWA icon set generated from SVG source.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
