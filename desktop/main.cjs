/**
 * Electron 主进程
 * - 自定义 app:// 协议加载打包产物（等同安全上下文，便于定位 / 缓存 / 地图）
 * - 单实例、窗口状态记忆、外链走系统浏览器
 */
const { app, BrowserWindow, protocol, session, shell, net, Menu } = require('electron');
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
      return new Response(data, { headers: { 'Content-Type': type } });
    } catch {
      // SPA 兜底
      try {
        const html = await fsp.readFile(path.join(DIST_DIR, 'index.html'));
        return new Response(html, { headers: { 'Content-Type': MIME['.html'] } });
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

    // 定位 / 通知权限直接授予（原生定位仍受系统隐私设置控制）
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowed = ['geolocation', 'notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen'];
      callback(allowed.includes(permission));
    });

    await registerAppProtocol();
    Menu.setApplicationMenu(null);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
