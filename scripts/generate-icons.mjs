/**
 * 图标生成器：无第三方依赖，直接光栅化 + 手写 PNG / ICO 编码
 * 产出：
 *   public/icons/*.png        PWA / Web App Manifest
 *   build/icon.png|icon.ico   Windows（electron-builder + rcedit）
 *   android/app/src/main/res   安卓启动图标（含自适应图标前景）
 *   ios/App/App/Assets.xcassets  iOS 应用图标
 */
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/* ---------------- PNG 编码 ---------------- */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------------- ICO 编码（Windows） ---------------- */
function encodeIco(frames) {
  const count = frames.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);

  let offset = 6 + 16 * count;
  const entries = [];

  for (const { size, png } of frames) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size; // 0 表示 256
    e[1] = size >= 256 ? 0 : size;
    e[2] = 0; // 调色板数
    e[3] = 0; // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...frames.map((f) => f.png)]);
}

/* ---------------- 绘制 ---------------- */
const hex = (h) => {
  const v = h.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};

const lerp = (a, b, t) => a + (b - a) * t;

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const C = {
  top: hex('#5c946e'),
  mid: hex('#33604a'),
  bottom: hex('#1b3427'),
  sunA: hex('#ffe6ad'),
  sunB: hex('#e9a95e'),
  ridge: hex('#0f2018'),
  ridgeLine: hex('#7fb894')
};

// 山脊轮廓（归一化图案坐标）——与界面内 brandMark 的 SVG 保持一致
const RIDGE = [
  [0.1, 0.7875],
  [0.3375, 0.425],
  [0.4675, 0.63],
  [0.55, 0.515],
  [0.9, 0.7875]
];

// 山脊高光折线
const RIDGE_HL = [
  [0.2125, 0.7875],
  [0.3375, 0.5875],
  [0.4175, 0.7175]
];

const SUN = { cx: 0.675, cy: 0.325, r: 0.115 };

/** 点到线段的距离 */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function nearPolyline(px, py, poly, width) {
  for (let i = 0; i < poly.length - 1; i++) {
    if (segDist(px, py, poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1]) < width) return true;
  }
  return false;
}

/**
 * @param {number} size 输出边长
 * @param {object} opts
 * @param {'rounded'|'square'|'circle'} [opts.mask] 画布遮罩形状
 * @param {boolean} [opts.transparent] 只画图案、不画渐变底（安卓自适应图标前景）
 * @param {number} [opts.zoom] 图案缩放（>1 放大），配合透明前景使用
 */
function renderIcon(size, opts = {}) {
  const { mask = 'rounded', transparent = false, zoom = 1 } = opts;
  const S = size;
  const buf = Buffer.alloc(S * S * 4);

  const pad = mask === 'square' ? 0 : 0.02;
  const inset = S * pad;
  const inner = S - inset * 2;
  const radius = inner * 0.3;
  const circleR = inner / 2;
  const center = S / 2;

  const SS = 3; // 超采样

  const inCanvas = (px, py) => {
    if (mask === 'square') return true;
    if (mask === 'circle') return Math.hypot(px - center, py - center) <= circleR;
    const left = inset;
    const top = inset;
    const right = inset + inner;
    const bottom = inset + inner;
    if (px < left || px > right || py < top || py > bottom) return false;
    const dx = Math.max(left + radius - px, 0, px - (right - radius));
    const dy = Math.max(top + radius - py, 0, py - (bottom - radius));
    return Math.hypot(dx, dy) <= radius;
  };

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (!inCanvas(px, py)) continue;

          // 图案坐标（可缩放）
          const nx = (px / S - 0.5) / zoom + 0.5;
          const ny = (py / S - 0.5) / zoom + 0.5;

          let cr = 0;
          let cg = 0;
          let cb = 0;
          let ca = 0;

          if (!transparent) {
            const t = Math.min(1, Math.max(0, ny));
            if (t < 0.5) {
              const k = t / 0.5;
              cr = lerp(C.top[0], C.mid[0], k);
              cg = lerp(C.top[1], C.mid[1], k);
              cb = lerp(C.top[2], C.mid[2], k);
            } else {
              const k = (t - 0.5) / 0.5;
              cr = lerp(C.mid[0], C.bottom[0], k);
              cg = lerp(C.mid[1], C.bottom[1], k);
              cb = lerp(C.mid[2], C.bottom[2], k);
            }
            ca = 1;
          }

          if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
            // 太阳
            const sd = Math.hypot((nx - SUN.cx) / SUN.r, (ny - SUN.cy) / SUN.r);
            if (sd < 1) {
              const k = Math.min(1, sd);
              cr = lerp(C.sunA[0], C.sunB[0], k);
              cg = lerp(C.sunA[1], C.sunB[1], k);
              cb = lerp(C.sunA[2], C.sunB[2], k);
              ca = 1;
            }

            // 山脊
            if (pointInPolygon(nx, ny, RIDGE)) {
              cr = C.ridge[0];
              cg = C.ridge[1];
              cb = C.ridge[2];
              ca = 1;

              if (nearPolyline(nx, ny, RIDGE_HL, 0.009)) {
                cr = lerp(cr, C.ridgeLine[0], 0.32);
                cg = lerp(cg, C.ridgeLine[1], 0.32);
                cb = lerp(cb, C.ridgeLine[2], 0.32);
              }
            }
          }

          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca * 255;
        }
      }

      const samples = SS * SS;
      const idx = (y * S + x) * 4;
      const alpha = a / samples;
      buf[idx] = alpha > 0 ? Math.round(r / (a / 255 || 1)) : 0;
      buf[idx + 1] = alpha > 0 ? Math.round(g / (a / 255 || 1)) : 0;
      buf[idx + 2] = alpha > 0 ? Math.round(b / (a / 255 || 1)) : 0;
      buf[idx + 3] = Math.round(alpha);
    }
  }

  return encodePng(S, S, buf);
}

/* ---------------- 输出：Web / PWA ---------------- */
const outDir = resolve(ROOT, 'public/icons');
mkdirSync(outDir, { recursive: true });
mkdirSync(resolve(ROOT, 'build'), { recursive: true });

const targets = [
  { size: 180, name: 'icon-180.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 256, name: 'icon-256.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 1024, name: 'icon-1024.png' }
];

for (const t of targets) {
  writeFileSync(resolve(outDir, t.name), renderIcon(t.size));
}
writeFileSync(resolve(outDir, 'maskable-512.png'), renderIcon(512, { mask: 'square' }));

/* ---------------- 输出：Windows ---------------- */
writeFileSync(resolve(ROOT, 'build/icon.png'), renderIcon(512));
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
writeFileSync(
  resolve(ROOT, 'build/icon.ico'),
  encodeIco(icoSizes.map((size) => ({ size, png: renderIcon(size) })))
);

/* ---------------- 输出：Android ---------------- */
const ANDROID_RES = resolve(ROOT, 'android/app/src/main/res');
if (existsSync(ANDROID_RES)) {
  // 传统图标按密度；自适应图标前景为 108dp 画布
  const density = [
    { name: 'mdpi', legacy: 48, foreground: 108 },
    { name: 'hdpi', legacy: 72, foreground: 162 },
    { name: 'xhdpi', legacy: 96, foreground: 216 },
    { name: 'xxhdpi', legacy: 144, foreground: 324 },
    { name: 'xxxhdpi', legacy: 192, foreground: 432 }
  ];

  for (const d of density) {
    const dir = resolve(ANDROID_RES, `mipmap-${d.name}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'ic_launcher.png'), renderIcon(d.legacy));
    writeFileSync(resolve(dir, 'ic_launcher_round.png'), renderIcon(d.legacy, { mask: 'circle' }));
    // 前景留出安全区：图案缩到 60%，其余透明
    writeFileSync(
      resolve(dir, 'ic_launcher_foreground.png'),
      renderIcon(d.foreground, { mask: 'square', transparent: true, zoom: 0.6 })
    );
  }

  // 自适应图标背景色与前景引用
  const valuesDir = resolve(ANDROID_RES, 'values');
  mkdirSync(valuesDir, { recursive: true });
  writeFileSync(
    resolve(valuesDir, 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#132A1C</color>\n</resources>\n`
  );

  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`;
  const anydpi = resolve(ANDROID_RES, 'mipmap-anydpi-v26');
  mkdirSync(anydpi, { recursive: true });
  writeFileSync(resolve(anydpi, 'ic_launcher.xml'), adaptive);
  writeFileSync(resolve(anydpi, 'ic_launcher_round.xml'), adaptive);

  console.log('[icons] 已更新 Android mipmap 图标');
}

/* ---------------- 输出：iOS ---------------- */
const IOS_ICONSET = resolve(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
if (existsSync(IOS_ICONSET)) {
  writeFileSync(resolve(IOS_ICONSET, 'AppIcon-512@2x.png'), renderIcon(1024));
  console.log('[icons] 已更新 iOS AppIcon');
}

console.log(`[icons] 已生成 ${targets.length + 1} 个 Web 图标 + build/icon.ico`);
