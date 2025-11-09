// Generate PWA icons using Canvas API in Node
// Run with: node generate-pwa-icons.mjs

import { createCanvas } from 'canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function drawIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  
  // Background - sky blue gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size)
  gradient.addColorStop(0, '#0ea5e9')
  gradient.addColorStop(1, '#0284c7')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  
  // Draw checkmark icon in white
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = size * 0.08
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  const centerX = size / 2
  const centerY = size / 2
  const checkSize = size * 0.35
  
  ctx.beginPath()
  ctx.moveTo(centerX - checkSize, centerY)
  ctx.lineTo(centerX - checkSize * 0.2, centerY + checkSize * 0.6)
  ctx.lineTo(centerX + checkSize * 0.8, centerY - checkSize * 0.6)
  ctx.stroke()
  
  // Add subtle circle border around checkmark
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.lineWidth = size * 0.04
  ctx.beginPath()
  ctx.arc(centerX, centerY, size * 0.4, 0, Math.PI * 2)
  ctx.stroke()
  
  return canvas
}

// Generate icons
const publicDir = path.join(__dirname, 'public')

try {
  console.log('Generating PWA icons...')
  
  const icon192 = drawIcon(192)
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192.toBuffer('image/png'))
  console.log('✓ Generated icon-192.png')
  
  const icon512 = drawIcon(512)
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512.toBuffer('image/png'))
  console.log('✓ Generated icon-512.png')
  
  console.log('Done! Icons saved to public/')
} catch (err) {
  console.error('Error generating icons:', err.message)
  console.log('\nNote: Install canvas package if missing:')
  console.log('  npm install canvas')
}
