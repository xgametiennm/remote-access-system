const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Minimal 1x1 transparent PNG buffer
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSA//iVBORw0KGgoAAAANSAhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Minimal 1x1 ICO buffer
const icoBuffer = Buffer.from(
  'AAABAAEAICAAAAEAIACoEAAAFgAAACAgAAABACAAqBAAAM4QAAAAAAAAQAAAAEAAAABAAAAAQAAAA',
  'base64'
);

fs.writeFileSync(path.join(iconsDir, '32x32.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer);

console.log('Dummy icons generated successfully in src-tauri/icons!');
