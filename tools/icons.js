// Draws the app icon (navy tile, brass ring, anchor) procedurally and writes PNGs with no dependencies.
const fs = require('fs'), path = require('path'), zlib = require('zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Shape test in unit coords (0..1). Returns 'brass' | 'light' | null.
function shape(x, y) {
  const cx = 0.5, dx = x - cx;
  const r = Math.hypot(x - 0.5, y - 0.5);
  if (r > 0.44 && r < 0.47) return 'brass';                        // outer ring
  const ringR = Math.hypot(x - cx, y - 0.25);
  if (ringR > 0.04 && ringR < 0.068) return 'light';               // anchor eye
  if (Math.abs(dx) < 0.03 && y > 0.31 && y < 0.75) return 'light'; // shank
  if (Math.abs(y - 0.37) < 0.025 && Math.abs(dx) < 0.17) return 'light'; // stock
  const ar = Math.hypot(x - cx, y - 0.5);                          // crown arc
  if (y > 0.5 && ar > 0.22 && ar < 0.27 && y < 0.78) return 'light';
  for (const s of [-1, 1]) {                                        // flukes
    const fx = cx + s * 0.245, fy = 0.56;
    if (Math.abs(x - fx) < 0.05 && y > fy - 0.07 && y < fy + 0.01 && Math.abs(x - fx) < (y - (fy - 0.07)) * 0.75) return 'light';
  }
  return null;
}

function render(size, rounded) {
  const px = Buffer.alloc(size * size * 4), SS = 4;
  const colors = { bg: [10, 20, 36], bg2: [26, 46, 79], brass: [228, 184, 76], light: [233, 239, 247] };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = (x + (sx + 0.5) / SS) / size, v = (y + (sy + 0.5) / SS) / size;
      if (rounded) {
        const k = 0.2, qx = Math.max(Math.abs(u - 0.5) - (0.5 - k), 0), qy = Math.max(Math.abs(v - 0.5) - (0.5 - k), 0);
        if (Math.hypot(qx, qy) > k) continue;
      }
      const t = v, base = colors.bg.map((c, i) => c + (colors.bg2[i] - c) * t * 0.8);
      const s = shape(u, v), c = s ? colors[s] : base;
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 255;
    }
    const n = SS * SS, a = acc[3] / n, o = (y * size + x) * 4;
    const div = acc[3] ? acc[3] / 255 : 1;
    px[o] = acc[0] / div; px[o + 1] = acc[1] / div; px[o + 2] = acc[2] / div; px[o + 3] = a;
  }
  return png(size, px);
}

const out = process.argv[2] || path.join(__dirname, '..', 'www');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), render(180, false)); // iOS rounds corners itself
fs.writeFileSync(path.join(out, 'icon-192.png'), render(192, true));
fs.writeFileSync(path.join(out, 'icon-512.png'), render(512, true));
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), render(512, false));
console.log('Icons written to ' + out);
