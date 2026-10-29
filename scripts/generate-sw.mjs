/**
 * 生成 Service Worker：把 dist 里的静态资源写进 precache 清单
 * 策略：
 *  - 静态资源 Cache First（带版本号，更新即换缓存）
 *  - 导航请求 Network First，失败回退 index.html
 *  - 天气类 API Network First（5s 超时后读缓存）
 */
import { readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

if (!existsSync(DIST)) {
  console.error('[sw] 未找到 dist，请先执行 vite build');
  process.exit(1);
}

const files = walk(DIST).filter((f) => !f.endsWith('sw.js'));
const urls = files.map((f) => './' + relative(DIST, f).split(sep).join('/'));

const hash = createHash('md5');
files.forEach((f) => hash.update(f + statSync(f).mtimeMs));
const VERSION = hash.digest('hex').slice(0, 10);

const template = `/* 晓山青 Service Worker — 自动生成，请勿手改 */
const VERSION = '${VERSION}';
const STATIC_CACHE = 'mossy-static-' + VERSION;
const RUNTIME_CACHE = 'mossy-runtime-' + VERSION;

const PRECACHE = ${JSON.stringify(urls, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[sw] 预缓存失败', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isWeatherApi(url) {
  return /(qweather|qweatherapi|open-meteo)/i.test(url.hostname + url.pathname) && url.hostname !== self.location.hostname;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 导航：Network First，离线回退 index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('./index.html') || Response.error();
        })
    );
    return;
  }

  // 天气接口：Network First + 5s 超时
  if (isWeatherApi(url)) {
    event.respondWith(
      Promise.race([
        fetch(request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ])
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || Response.error()))
    );
    return;
  }

  // 同源静态资源：Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
`;

mkdirSync(DIST, { recursive: true });
writeFileSync(join(DIST, 'sw.js'), template, 'utf8');
console.log(`[sw] 已生成 sw.js（${urls.length} 个预缓存资源，版本 ${VERSION}）`);
