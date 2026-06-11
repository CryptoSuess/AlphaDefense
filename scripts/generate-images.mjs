/**
 * Generates the PWA icons and the OG/social card as PNGs with zero
 * dependencies: shapes are rasterized analytically (point-in-shape tests
 * with 2x2 supersampling) and encoded via Node's built-in zlib.
 *
 *   node scripts/generate-images.mjs
 *
 * Outputs (committed to the repo, served from public/):
 *   public/icons/icon-192.png
 *   public/icons/icon-512.png
 *   public/og-image.png        (1200x630)
 *
 * Replace these with real brand art whenever it's ready — nothing else
 * references this script.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Minimal PNG encoder (8-bit RGBA, no filters)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // Raw scanlines, each prefixed with filter byte 0.
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Tiny analytic canvas: shapes are closures (x, y) => color | null,
// painted in order with alpha blending and 2x2 supersampling.
// ---------------------------------------------------------------------------

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

class Painter {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.layers = [];
  }

  /** test(x, y) -> alpha 0..1; color '#rrggbb'. */
  add(test, color, alpha = 1) {
    this.layers.push({ test, rgb: hex(color), alpha });
  }

  circle(cx, cy, r, color, alpha = 1) {
    this.add((x, y) => (Math.hypot(x - cx, y - cy) <= r ? 1 : 0), color, alpha);
  }

  /** Annulus between r0 and r1. */
  ring(cx, cy, r0, r1, color, alpha = 1) {
    this.add((x, y) => {
      const d = Math.hypot(x - cx, y - cy);
      return d >= r0 && d <= r1 ? 1 : 0;
    }, color, alpha);
  }

  /** Soft radial glow from r0 (full alpha) fading to r1 (zero). */
  glow(cx, cy, r0, r1, color, alpha = 1) {
    this.add((x, y) => {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r0) return 1;
      if (d >= r1) return 0;
      const t = 1 - (d - r0) / (r1 - r0);
      return t * t;
    }, color, alpha);
  }

  ellipse(cx, cy, rx, ry, color, alpha = 1) {
    this.add(
      (x, y) => (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 ? 1 : 0),
      color,
      alpha,
    );
  }

  triangle(p0, p1, p2, color, alpha = 1) {
    const sign = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    this.add((x, y) => {
      const p = [x, y];
      const d0 = sign(p0, p1, p);
      const d1 = sign(p1, p2, p);
      const d2 = sign(p2, p0, p);
      const neg = d0 < 0 || d1 < 0 || d2 < 0;
      const pos = d0 > 0 || d1 > 0 || d2 > 0;
      return neg && pos ? 0 : 1;
    }, color, alpha);
  }

  /** Vertical gradient background between two colors. */
  gradient(topColor, bottomColor) {
    const a = hex(topColor);
    const b = hex(bottomColor);
    this.bg = (y) => {
      const t = y / this.h;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    };
  }

  render() {
    const buf = Buffer.alloc(this.w * this.h * 4);
    const SS = 2; // supersampling factor
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let [r, g, b] = this.bg ? this.bg(y) : [0, 0, 0];
        for (const { test, rgb, alpha } of this.layers) {
          // Average the shape's coverage over SSxSS sub-samples.
          let cov = 0;
          for (let sy = 0; sy < SS; sy++) {
            for (let sx = 0; sx < SS; sx++) {
              cov += test(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
            }
          }
          cov = (cov / (SS * SS)) * alpha;
          if (cov > 0) {
            r = r + (rgb[0] - r) * cov;
            g = g + (rgb[1] - g) * cov;
            b = b + (rgb[2] - b) * cov;
          }
        }
        const i = (y * this.w + x) * 4;
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = 255;
      }
    }
    return encodePng(this.w, this.h, buf);
  }
}

// ---------------------------------------------------------------------------
// The NIKO mascot bust, styled after the official token art: smirking black
// wolf, blue inner ears, three blue forehead streaks, white muzzle, blue
// nose, blue hoodie with a plain white ring emblem.
// (Mirrors src/components/NikoLogo.tsx.)
// ---------------------------------------------------------------------------

/** Draws the wolf bust centered at (cx, cy) with head radius s. */
function drawNiko(p, cx, cy, s) {
  const FUR = '#0c0e16';
  const BLUE = '#0052ff';
  const INNER_BLUE = '#1240c4';

  // Hoodie shoulders (black outline, then fill).
  p.ellipse(cx, cy + s * 1.5, s * 1.45, s * 0.95, FUR);
  p.ellipse(cx, cy + s * 1.55, s * 1.32, s * 0.84, '#1452d8');
  // Hood collar shadow under the head.
  p.ellipse(cx, cy + s * 1.0, s * 0.85, s * 0.3, '#0d3fb0');
  // White ring emblem on the chest.
  p.ring(cx, cy + s * 1.55, s * 0.2, s * 0.32, '#f8fafc');

  // Ears: black triangles with blue inner.
  p.triangle(
    [cx - s * 1.0, cy - s * 0.45], [cx - s * 0.72, cy - s * 1.55], [cx - s * 0.1, cy - s * 0.75],
    FUR,
  );
  p.triangle(
    [cx + s * 1.0, cy - s * 0.45], [cx + s * 0.72, cy - s * 1.55], [cx + s * 0.1, cy - s * 0.75],
    FUR,
  );
  p.triangle(
    [cx - s * 0.82, cy - s * 0.62], [cx - s * 0.68, cy - s * 1.25], [cx - s * 0.32, cy - s * 0.78],
    INNER_BLUE,
  );
  p.triangle(
    [cx + s * 0.82, cy - s * 0.62], [cx + s * 0.68, cy - s * 1.25], [cx + s * 0.32, cy - s * 0.78],
    INNER_BLUE,
  );

  // Cheek fur spikes.
  p.triangle([cx - s * 0.95, cy + s * 0.1], [cx - s * 1.3, cy + s * 0.35], [cx - s * 0.7, cy + s * 0.55], FUR);
  p.triangle([cx + s * 0.95, cy + s * 0.1], [cx + s * 1.3, cy + s * 0.35], [cx + s * 0.7, cy + s * 0.55], FUR);

  // Head.
  p.circle(cx, cy, s, FUR);

  // White muzzle (lower face).
  p.ellipse(cx, cy + s * 0.45, s * 0.66, s * 0.46, '#f8fafc');
  // Smirk: thin mouth line, slightly off-center for the smug look.
  p.ellipse(cx + s * 0.08, cy + s * 0.62, s * 0.34, s * 0.035, FUR);
  p.triangle(
    [cx + s * 0.4, cy + s * 0.64],
    [cx + s * 0.48, cy + s * 0.52],
    [cx + s * 0.34, cy + s * 0.58],
    FUR,
  );

  // Smug eyes: white almonds, heavy upper lids, low pupils.
  p.ellipse(cx - s * 0.38, cy - s * 0.1, s * 0.2, s * 0.14, '#f8fafc');
  p.ellipse(cx + s * 0.38, cy - s * 0.1, s * 0.2, s * 0.14, '#f8fafc');
  p.ellipse(cx - s * 0.38, cy - s * 0.2, s * 0.22, s * 0.12, FUR);
  p.ellipse(cx + s * 0.38, cy - s * 0.2, s * 0.22, s * 0.12, FUR);
  p.circle(cx - s * 0.34, cy - s * 0.06, s * 0.065, FUR);
  p.circle(cx + s * 0.34, cy - s * 0.06, s * 0.065, FUR);

  // Blue nose.
  p.ellipse(cx, cy + s * 0.28, s * 0.17, s * 0.11, '#1f6bff');

  // Three blue forehead streaks (thin triangles pointing down).
  for (const [dx, len] of [[-0.22, 0.24], [0, 0.32], [0.22, 0.24]]) {
    p.triangle(
      [cx + s * (dx - 0.035), cy - s * 0.72],
      [cx + s * (dx + 0.035), cy - s * 0.72],
      [cx + s * dx, cy - s * (0.72 - len)],
      BLUE,
    );
  }
}

function icon(size) {
  const p = new Painter(size, size);
  p.gradient('#0052ff', '#0046df');
  drawNiko(p, size / 2, size * 0.42, size * 0.27);
  return p.render();
}

function ogImage() {
  const W = 1200;
  const H = 630;
  const p = new Painter(W, H);
  p.gradient('#0052ff', '#0043d6');
  // Decorative paw pads on the flanks.
  for (const [dx, side] of [[-1, 0], [1, 1]]) {
    const bx = W / 2 + dx * 440;
    const by = H * (0.32 + side * 0.34);
    p.circle(bx, by, 26, '#0a3bc4');
    p.circle(bx - 30, by - 32, 11, '#0a3bc4');
    p.circle(bx, by - 42, 11, '#0a3bc4');
    p.circle(bx + 30, by - 32, 11, '#0a3bc4');
  }
  drawNiko(p, W / 2, H * 0.4, 130);
  // Title bar placeholder: the page's og:title carries the text.
  return p.render();
}

mkdirSync(join(root, 'public', 'icons'), { recursive: true });
writeFileSync(join(root, 'public', 'icons', 'icon-192.png'), icon(192));
writeFileSync(join(root, 'public', 'icons', 'icon-512.png'), icon(512));
writeFileSync(join(root, 'public', 'og-image.png'), ogImage());
console.log('Generated public/icons/icon-192.png, icon-512.png, og-image.png');
