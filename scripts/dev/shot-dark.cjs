const { app, BrowserWindow, protocol } = require('electron');
const path = require('node:path'); const fs=require('node:fs'); const fsp = require('node:fs/promises');
const DIST = path.join(__dirname, '..', '..', 'dist');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.whenReady().then(async () => {
  protocol.handle('app', async (req) => {
    const u = new URL(req.url); let p = decodeURIComponent(u.pathname) || '/index.html';
    try { const d = await fsp.readFile(path.join(DIST, p)); const ext = path.extname(p);
      return new Response(d, { headers: { 'Content-Type': {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[ext] || 'application/octet-stream' } });
    } catch { return new Response(await fsp.readFile(path.join(DIST,'index.html')), { headers:{'Content-Type':'text/html; charset=utf-8'} }); }
  });
  const win = new BrowserWindow({ width: 1280, height: 900, show: true });
  win.webContents.setZoomFactor(1);
  await win.loadURL('app://bundle/index.html');
  await new Promise(r => setTimeout(r, 1200));
  await win.webContents.executeJavaScript(`localStorage.setItem('mossy.prefs', JSON.stringify({theme:'dark', onboarded:true})); location.reload();`);
  await new Promise(r => setTimeout(r, 2600));
  for (const route of ['home','chase','trail','weather']) {
    await win.webContents.executeJavaScript(`location.hash='#/${route}'`);
    await new Promise(r => setTimeout(r, 1000));
    const img = await win.webContents.capturePage();
    fs.mkdirSync(path.join(__dirname, '..', '..', 'shots'), { recursive: true });
    fs.writeFileSync(path.join(__dirname,'..','..','shots',`dark-${route}.png`), img.toPNG());
    console.log('dark', route);
  }
  app.quit();
});
