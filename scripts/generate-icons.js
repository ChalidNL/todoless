#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const iconDir = resolve(root, 'public/icons');
const source = resolve(iconDir, 'icon-source.png');
const sizes = [192, 512];

if (!existsSync(source)) {
  throw new Error(`Missing source icon: ${source}`);
}

mkdirSync(iconDir, { recursive: true });

for (const size of sizes) {
  const png = resolve(iconDir, `icon-${size}.png`);
  execFileSync('ffmpeg', [
    '-y',
    '-i', source,
    '-vf', `scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`,
    '-frames:v', '1',
    png,
  ], { stdio: 'ignore' });

  writeFileSync(
    resolve(iconDir, `icon-${size}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n  <image href="/icons/icon-${size}.png" width="${size}" height="${size}"/>\n</svg>\n`,
  );
}

const faviconPng = readFileSync(resolve(iconDir, 'icon-512.png')).toString('base64');
writeFileSync(
  resolve(root, 'public/favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n  <image href="data:image/png;base64,${faviconPng}" width="512" height="512"/>\n</svg>\n`,
);

console.log('Generated PWA icons and favicon from public/icons/icon-source.png');
