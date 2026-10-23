// Zero-dependency icon generator: draws the Workday "W" mark and writes PNGs into public/.
// Run with: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [13, 148, 136];
const FG = [255, 255, 255];
const W_POINTS = [[0.2, 0.3], [0.35, 0.72], [0.5, 0.4], [0.65, 0.72], [0.8, 0.3]];
const STROKE = 0.1;
const SAMPLES = 4;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inRoundedRect(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), 1 - radius);
  const cy = Math.min(Math.max(y, radius), 1 - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
}

function render(size, { radius, markScale }) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0, fg = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const u = (x + (sx + 0.5) / SAMPLES) / size;
          const v = (y + (sy + 0.5) / SAMPLES) / size;
          if (!inRoundedRect(u, v, radius)) continue;
          bg++;
          const mu = (u - 0.5) / markScale + 0.5;
          const mv = (v - 0.5) / markScale + 0.5;
          for (let i = 0; i < W_POINTS.length - 1; i++) {
            if (distToSegment(mu, mv, W_POINTS[i], W_POINTS[i + 1]) <= STROKE / 2) { fg++; break; }
          }
        }
      }
      const total = SAMPLES * SAMPLES;
      const mix = bg ? fg / bg : 0;
      const o = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = Math.round(BG[c] * (1 - mix) + FG[c] * mix);
      out[o + 3] = Math.round((bg / total) * 255);
    }
  }
  return encodePng(size, out);
}

mkdirSync('public', { recursive: true });
const icons = [
  ['pwa-192x192.png', 192, { radius: 0.22, markScale: 1 }],
  ['pwa-512x512.png', 512, { radius: 0.22, markScale: 1 }],
  ['maskable-512x512.png', 512, { radius: 0, markScale: 0.7 }],
  ['apple-touch-icon.png', 180, { radius: 0, markScale: 0.85 }],
];
for (const [name, size, options] of icons) {
  writeFileSync(`public/${name}`, render(size, options));
  console.log(`wrote public/${name}`);
}
