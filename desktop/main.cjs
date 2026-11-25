/**
 * Electron 主进程
 * - 自定义 app:// 协议加载打包产物（等同安全上下文，便于定位 / 缓存 / 地图）
 * - 单实例、窗口状态记忆、外链走系统浏览器
 */
const { app, BrowserWindow, protocol, session, shell, net, Menu, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const STATE_FILE = () => path.join(app.getPath('userData'), 'window-state.json');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.gpx': 'application/gpx+xml'
};

/**
 * 内容安全策略（仅用于生产 app:// 响应；dev 走 Vite 的 http://localhost 不经此处）。
 * 说明：地图瓦片走 <img>，需 img-src 放行高德/OSM；天气接口走 fetch，需 connect-src 放行；
 * 组件用大量内联 style 属性，故 style-src 保留 'unsafe-inline'（脚本仍严格 'self'）。
 */
const CSP = [
  "default-src 'self' app:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.is.autonavi.com https://tile.openstreetmap.org",
  "connect-src 'self' https://*.open-meteo.com https://*.qweatherapi.com https://*.qweather.com https://api.github.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};

/* ---------------- 应用内自动更新（electron-updater） ---------------- */

let autoUpdater = null;

/**
 * 只在打包后的正式版启用（开发态没有 app-update.yml，会自动抛错）。
 * 更新源见 package.json build.publish（GitHub Releases）。
 */
function setupUpdater(win) {
  if (!app.isPackaged) return;
  // 便携版（Portable）没有安装目录，NSIS 自动更新不适用，直接跳过
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    console.log('[updater] 便携版不支持自动更新，跳过');
    return;
  }
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    console.warn('[updater] electron-updater 未安装，跳过自动更新', err?.message || err);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (...a) => console.log('[updater]', ...a),
    warn: (...a) => console.warn('[updater]', ...a),
    error: (...a) => console.error('[updater]', ...a),
    debug: () => {}
  };

  const send = (payload) => {
    if (win && !win.isDestroyed()) win.webContents.send('updater:status', payload);
  };

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info?.version }));
  autoUpdater.on('update-not-available', (info) => send({ state: 'none', version: info?.version }));
  autoUpdater.on('download-progress', (p) => send({ state: 'downloading', percent: Math.round(p?.percent || 0) }));
  autoUpdater.on('update-downloaded', (info) => send({ state: 'ready', version: info?.version }));
  autoUpdater.on('error', (err) => send({ state: 'error', message: String(err?.message || err) }));

  const check = () =>
    autoUpdater.checkForUpdates().catch((e) => send({ state: 'error', message: String(e?.message || e) }));

  // 启动后 8 秒静默检查一次，之后每 6 小时一次
  setTimeout(check, 8000);
  setInterval(check, 6 * 60 * 60 * 1000);
}

function readWindowState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8'));
  } catch {
    return { width: 1180, height: 800 };
  }
}

function saveWindowState(win) {
  try {
    const bounds = win.getNormalBounds();
    fs.writeFileSync(STATE_FILE(), JSON.stringify(bounds));
  } catch {
    /* 忽略 */
  }
}

async function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';

    // hash 路由由前端处理；这里只处理静态文件
    const target = path.normalize(path.join(DIST_DIR, pathname));
    if (!target.startsWith(DIST_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const data = await fsp.readFile(target);
      const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
      return new Response(data, { headers: { 'Content-Type': type, ...SECURITY_HEADERS } });
    } catch {
      // SPA 兜底
      try {
        const html = await fsp.readFile(path.join(DIST_DIR, 'index.html'));
        return new Response(html, { headers: { 'Content-Type': MIME['.html'], ...SECURITY_HEADERS } });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }
  });
}

function createWindow() {
  const state = readWindowState();

  const win = new BrowserWindow({
    width: state.width || 1180,
    height: state.height || 800,
    x: state.x,
    y: state.y,
    minWidth: 380,
    minHeight: 620,
    backgroundColor: '#0c1411',
    title: '晓山青',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadURL('app://bundle/index.html');
  }

  win.on('close', () => saveWindowState(win));

  setupUpdater(win);

  // 外链一律交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://') && !(isDev && url.startsWith(process.env.VITE_DEV_SERVER_URL))) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  return win;
}

// 单实例
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    if (process.platform === 'win32') app.setAppUserModelId('com.mossydawn.viridiore');

    // 定位 / 通知 / 剪贴板权限：只授予可信来源（app:// 自身页面；dev 额外允许 Vite dev server）
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const origin = details?.requestingUrl || webContents?.getURL?.() || '';
      const trusted =
        origin.startsWith('app://') ||
        (isDev && !!process.env.VITE_DEV_SERVER_URL && origin.startsWith(process.env.VITE_DEV_SERVER_URL));
      const allowed = ['geolocation', 'notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen'];
      callback(trusted && allowed.includes(permission));
    });

    await registerAppProtocol();
    Menu.setApplicationMenu(null);

    // 更新相关的 IPC
    ipcMain.handle('app:version', () => app.getVersion());
    ipcMain.handle('updater:check', async () => {
      if (!app.isPackaged || !autoUpdater) return { ok: false, reason: 'not-packaged' };
      try {
        const r = await autoUpdater.checkForUpdates();
        return { ok: true, version: r?.updateInfo?.version };
      } catch (e) {
        return { ok: false, reason: String(e?.message || e) };
      }
    });
    ipcMain.on('updater:install', () => {
      try {
        autoUpdater?.quitAndInstall();
      } catch (e) {
        console.warn('[updater] 安装失败', e?.message || e);
      }
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
