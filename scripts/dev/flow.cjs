const { app, BrowserWindow, protocol } = require('electron');
const path = require('node:path');
const fsp = require('node:fs/promises');
const fs = require('node:fs');
const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'shots');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
app.whenReady().then(async () => {
  protocol.handle('app', async (req) => {
    const u = new URL(req.url); let p = decodeURIComponent(u.pathname);
    if (!p || p === '/') p = '/index.html';
    const t = path.normalize(path.join(DIST, p));
    try { return new Response(await fsp.readFile(t), { headers: { 'Content-Type': MIME[path.extname(t)] || 'application/octet-stream' } }); }
    catch { return new Response(await fsp.readFile(path.join(DIST, 'index.html')), { headers: { 'Content-Type': MIME['.html'] } }); }
  });
  const win = new BrowserWindow({ width: 1280, height: 980, show: true, backgroundColor: '#f5f2ea', webPreferences: { contextIsolation: true, backgroundThrottling: false } });
  await win.loadURL('app://bundle/index.html');
  await sleep(1500);
  await win.webContents.executeJavaScript(`(()=>{const r=JSON.parse(localStorage.getItem('mossy.prefs')||'{}');r.onboarded=true;r.theme='light';localStorage.setItem('mossy.prefs',JSON.stringify(r))})()`);
  await win.webContents.reload(); await sleep(2000);

  // 1) 问一句
  await win.webContents.executeJavaScript(`(()=>{const i=document.querySelector('#askInput');i.value='周六带 6 岁孩子，2 小时能来回';document.querySelector('#askForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));})()`);
  await sleep(500);
  await win.webContents.executeJavaScript(`document.querySelector('#askForm').scrollIntoView({block:'start'})`);
  await sleep(400);
  let img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'flow-ask.png'), img.toPNG());
  console.log('[flow] ask');

  // 2) 轨迹示例 + 卡片
  await win.webContents.executeJavaScript(`location.hash='#/trail'`);
  await sleep(1200);
  await win.webContents.executeJavaScript(`document.querySelector('[data-action="demo"]')?.click()`);
  await sleep(1500);
  await win.webContents.executeJavaScript(`document.querySelector('[data-action="card"]')?.click()`);
  await sleep(1200);
  img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'flow-card.png'), img.toPNG());
  console.log('[flow] card');

  // 3) 追光预测卡
  await win.webContents.executeJavaScript(`document.querySelectorAll('.modal-layer').forEach(n=>n.remove())`);
  await win.webContents.executeJavaScript(`location.hash='#/chase'`);
  await sleep(1400);
  await win.webContents.executeJavaScript(`document.querySelector('[data-action="share"]')?.click()`);
  await sleep(1200);
  img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'flow-predict.png'), img.toPNG());
  console.log('[flow] predict');

  // 捕获运行时错误
  const errs = await win.webContents.executeJavaScript(`window.__errs || []`);
  console.log('errors:', JSON.stringify(errs));
  app.quit();
});
