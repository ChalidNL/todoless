const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG_DIR = '/opt/data/projects/todoless-ngx/public/icons';
const ICON_SIZES = [192, 512];

async function generatePngIcons() {
  for (const size of ICON_SIZES) {
    const svgFile = path.join(SVG_DIR, `icon-${size}.svg`);
    const pngFile = path.join(SVG_DIR, `icon-${size}.png`);
    
    if (!fs.existsSync(svgFile)) {
      console.error(`SVG not found: ${svgFile}`);
      process.exit(1);
    }
    
    const svg = fs.readFileSync(svgFile);
    
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(pngFile);
    
    console.log(`Generated: ${pngFile}`);
  }
}

generatePngIcons().catch(err => {
  console.error(err);
  process.exit(1);
});
