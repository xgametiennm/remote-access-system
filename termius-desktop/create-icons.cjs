const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate 32x32 32-bit RGBA BMP inside ICO with letter 'T' on Orange background
function createLetterTIco() {
  const width = 32;
  const height = 32;
  const headerSize = 40;
  const pixelBytes = width * height * 4;
  const maskBytes = (width * height) / 8;
  const imageSize = headerSize + pixelBytes + maskBytes;

  const buf = Buffer.alloc(6 + 16 + imageSize);

  // ICONDIR
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(1, 4);

  // ICONDIRENTRY
  buf.writeUInt8(width, 6);
  buf.writeUInt8(height, 7);
  buf.writeUInt8(0, 8);
  buf.writeUInt8(0, 9);
  buf.writeUInt16LE(1, 10);
  buf.writeUInt16LE(32, 12);
  buf.writeUInt32LE(imageSize, 14);
  buf.writeUInt32LE(22, 18);

  // BITMAPINFOHEADER
  let offset = 22;
  buf.writeUInt32LE(40, offset);
  buf.writeInt32LE(width, offset + 4);
  buf.writeInt32LE(height * 2, offset + 8); // Height * 2 (XOR + AND mask)
  buf.writeUInt16LE(1, offset + 12);
  buf.writeUInt16LE(32, offset + 14);
  buf.writeUInt32LE(0, offset + 16);
  buf.writeUInt32LE(pixelBytes + maskBytes, offset + 20);

  offset += 40;

  // Render letter 'T' on Orange background (#E95420)
  // Note: BMP stores rows bottom-to-top!
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      // Check if pixel is part of letter 'T'
      const isTopBar = y >= 5 && y <= 9 && x >= 5 && x <= 26;
      const isStem = y >= 10 && y <= 26 && x >= 13 && x <= 18;
      const isLetterT = isTopBar || isStem;

      if (isLetterT) {
        // White letter 'T'
        buf.writeUInt8(255, offset);     // B
        buf.writeUInt8(255, offset + 1); // G
        buf.writeUInt8(255, offset + 2); // R
        buf.writeUInt8(255, offset + 3); // A
      } else {
        // Orange Termius background (#E95420)
        buf.writeUInt8(32, offset);      // B
        buf.writeUInt8(84, offset + 1);  // G
        buf.writeUInt8(233, offset + 2); // R
        buf.writeUInt8(255, offset + 3); // A
      }
      offset += 4;
    }
  }

  // Mask (all 0)
  buf.fill(0, offset, offset + maskBytes);

  return buf;
}

// 1x1 fallback PNG
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSAhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const icoBuf = createLetterTIco();

fs.writeFileSync(path.join(iconsDir, '32x32.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuf);

console.log('Official Letter "T" Icon generated for Windows App & Taskbar!');
