/**
 * 开发辅助：用 Electron 截取各页面截图，便于检查视觉
 * 用法：node_modules/.bin/electron scripts/shot.cjs
 */
const { app, BrowserWindow, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const ROUTES = ['home', 'chase', 'trail', 'weather', 'settings'];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  await fsp.mkdir(OUT, { recursive: true });

  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    let p = decodeURIComponent(url.pathname);
    if (!p || p === '/') p = '/index.html';
    const target = path.normalize(path.join(DIST, p));
    try {
      const data = await fsp.readFile(target);
      return new Response(data, {
        headers: { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' }
      });
    } catch {
      const html = await fsp.readFile(path.join(DIST, 'index.html'));
      return new Response(html, { headers: { 'Content-Type': MIME['.html'] } });
    }
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    show: true,
    backgroundColor: '#0c1411',
    webPreferences: { contextIsolation: true, backgroundThrottling: false }
  });

  await win.loadURL('app://bundle/index.html');
  win.webContents.setZoomFactor(1);
  win.webContents.setZoomLevel(0);
  await sleep(1500);

  // 跳过引导弹窗，并可按环境变量强制主题（SHOT_THEME=light|dark）
  const THEME = process.env.SHOT_THEME || '';
  await win.webContents.executeJavaScript(
    `(() => {
      const raw = JSON.parse(localStorage.getItem('mossy.prefs') || '{}');
      raw.onboarded = true;
      ${THEME ? `raw.theme = '${THEME}';` : ''}
      localStorage.setItem('mossy.prefs', JSON.stringify(raw));
    })()`
  );
  await win.webContents.reload();
  await sleep(2000);

  for (const vp of VIEWPORTS) {
    win.webContents.setZoomFactor(1);
    win.setContentSize(vp.width, vp.height);
    await sleep(900);

    for (const route of ROUTES) {
      await win.webContents.executeJavaScript(`location.hash = '#/${route}'`);
      await sleep(1000);
      await win.webContents.executeJavaScript(
        `document.querySelectorAll('.sheet-layer,.modal-layer,.toast-layer').forEach((n) => n.remove())`
      );
      const image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(OUT, `${vp.name}-${route}.png`), image.toPNG());
      console.log(`[shot] ${vp.name}-${route}`);
    }
  }

  app.quit();
});
