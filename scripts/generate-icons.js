#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const publicDir = resolve(root, 'public');
const iconDir = resolve(publicDir, 'icons');
const logo = resolve(publicDir, 'logo-rainbow.png');
const fallbackSource = resolve(iconDir, 'icon-source.png');
const sizes = [192, 512];

if (!existsSync(logo) && existsSync(fallbackSource)) {
  copyFileSync(fallbackSource, logo);
}
if (!existsSync(logo)) {
  throw new Error(`Missing source icon: ${logo}`);
}

mkdirSync(iconDir, { recursive: true });
copyFileSync(logo, fallbackSource);

for (const size of sizes) {
  const png = resolve(iconDir, `icon-${size}.png`);
  execFileSync('ffmpeg', [
    '-y',
    '-i', logo,
    '-vf', `scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`,
    '-frames:v', '1',
    png,
  ], { stdio: 'ignore' });

  writeFileSync(
    resolve(iconDir, `icon-${size}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n  <image href="/icons/icon-${size}.png" width="${size}" height="${size}"/>\n</svg>\n`,
  );
}

execFileSync('ffmpeg', [
  '-y',
  '-i', logo,
  '-vf', 'scale=410:410:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0xffffffff',
  '-frames:v', '1',
  resolve(iconDir, 'icon-512-maskable.png'),
], { stdio: 'ignore' });

const faviconPng = readFileSync(resolve(iconDir, 'icon-512.png')).toString('base64');
writeFileSync(
  resolve(publicDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n  <image href="data:image/png;base64,${faviconPng}" width="512" height="512"/>\n</svg>\n`,
);

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

console.log('Generated PWA icons, maskable icon, favicon and manifests from public/logo-rainbow.png');
