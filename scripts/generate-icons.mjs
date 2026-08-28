import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const body = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return body;
}

function paintIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2 + size * 0.04;
  const dropR = size * 0.28;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const inDrop = dx * dx + dy * dy * 0.85 < dropR * dropR && y > size * 0.22;
      const inMark = Math.abs(dx - dropR * 0.05) < size * 0.02 && dy > -dropR * 0.35 && dy < -dropR * 0.08;
      if (inMark) {
        px[i] = 230;
        px[i + 1] = 180;
        px[i + 2] = 34;
        px[i + 3] = 255;
      } else if (inDrop) {
        px[i] = 61;
        px[i + 1] = 46;
        px[i + 2] = 138;
        px[i + 3] = 255;
      } else {
        px[i] = 244;
        px[i + 1] = 237;
        px[i + 2] = 226;
        px[i + 3] = 255;
      }
    }
  }
  return px;
}

const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), encodePng(size, size, paintIcon(size)));
}
console.log("wrote public/icons/icon-192.png and icon-512.png");
