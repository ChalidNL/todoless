#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, chmodSync } = require('node:fs');
const { resolve } = require('node:path');
const sharp = require('sharp');

const root = resolve(__dirname, '..');
const publicDir = resolve(root, 'public');
const iconDir = resolve(publicDir, 'icons');
const iconBetaDir = resolve(publicDir, 'icons-beta');
const svgSource = resolve(iconDir, 'icon-source.svg');
const svgSourceBeta = resolve(iconDir, 'icon-source-beta.svg');

const logoSrc = resolve(publicDir, 'logo-rainbow.png');
const logoBetaSrc = resolve(publicDir, 'logo-rainbow-beta.png');

async function generatePng(svgBuf, dir, size, filename, opts = {}) {
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

  const filepath = resolve(dir, filename);
  writeFileSync(filepath, pngBuf);
  console.log(`  ✓ ${filepath} (${size}x${size})`);
}

async function generateSet(svgBuf, dir, suffix, label) {
  mkdirSync(dir, { recursive: true });

  // Base PNG from SVG
  const basePng = await sharp(svgBuf).resize(512, 512).png().toBuffer();
  const pngSource = resolve(dir, `icon-source${suffix}.png`);
  writeFileSync(pngSource, basePng);

  const logoSrcFile = resolve(publicDir, `logo-rainbow${suffix}.png`);
  writeFileSync(logoSrcFile, basePng);

  const logoIconFile = resolve(dir, `logo-rainbow${suffix}.png`);
  writeFileSync(logoIconFile, basePng);
  chmodSync(logoIconFile, 0o644);
  chmodSync(logoSrcFile, 0o644);
  console.log(`[${label}] Generated base PNG from SVG source`);

  // PWA icon set
  await generatePng(svgBuf, dir, 192, `icon-192${suffix}.png`);
  await generatePng(svgBuf, dir, 512, `icon-512${suffix}.png`);
  await generatePng(svgBuf, dir, 512, `icon-512-maskable${suffix}.png`, { contentSize: 340 });

  // SVG wrappers
  for (const size of [192, 512]) {
    writeFileSync(
      resolve(dir, `icon-${size}${suffix}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n  <image href="/icons${suffix ? '-beta' : ''}/icon-${size}${suffix}.png" width="${size}" height="${size}"/>\n</svg>\n`,
    );
  }

  // Favicon SVG
  const faviconPng = readFileSync(resolve(dir, `icon-512${suffix}.png`)).toString('base64');
  writeFileSync(
    resolve(dir, `favicon${suffix}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n  <image href="data:image/png;base64,${faviconPng}" width="512" height="512"/>\n</svg>\n`,
  );
  console.log(`  ✓ favicon${suffix}.svg`);
}

async function main() {
  const svgBuf = readFileSync(svgSource);
  const svgBetaBuf = readFileSync(svgSourceBeta);

  // Generate regular set
  await generateSet(svgBuf, iconDir, '', 'REGULAR');

  // Generate beta set
  await generateSet(svgBetaBuf, iconBetaDir, '', 'BETA');

  // Manifest — regular
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
  console.log('  ✓ manifest.json / manifest.webmanifest (regular)');

  // Manifest — beta
  const manifestBeta = {
    name: 'todoless β',
    short_name: 'todoless β',
    description: 'Self-hosted productivity app (beta)',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#f8f7ff',
    theme_color: '#f8f7ff',
    categories: ['productivity', 'utilities'],
    icons: [
      { src: '/icons-beta/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons-beta/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons-beta/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [],
    launch_handler: { client_mode: 'navigate-existing' },
  };
  writeFileSync(resolve(publicDir, 'manifest-beta.json'), `${JSON.stringify(manifestBeta, null, 2)}\n`);
  writeFileSync(resolve(publicDir, 'manifest-beta.webmanifest'), `${JSON.stringify(manifestBeta, null, 2)}\n`);
  console.log('  ✓ manifest-beta.json / manifest-beta.webmanifest (beta)');

  // Copy appropriate favicon for default (regular)
  copyFileSync(resolve(iconDir, 'favicon.svg'), resolve(publicDir, 'favicon.svg'));
  console.log('  ✓ favicon.svg → public/ (regular default)');

  // Copy regular logo-rainbow to public/
  copyFileSync(resolve(iconDir, 'logo-rainbow.png'), logoSrc);
  console.log('  ✓ logo-rainbow.png → public/');

  console.log('\nDone! PWA icon sets generated — regular + beta.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
