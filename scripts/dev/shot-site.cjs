/**
 * 官网截图：按区块实际位置逐屏截取
 * electron scripts/dev/shot-site.cjs
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..', '..');
const SITE = path.join(ROOT, 'site', 'index.html');
const OUT = path.join(ROOT, 'shots', 'site');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    backgroundColor: '#0a1710',
    webPreferences: { contextIsolation: true, backgroundThrottling: false }
  });

  await win.loadFile(SITE);
  await win.webContents.setZoomFactor(1);
  await sleep(1600);

  // 让所有进场元素直接到位，并关掉平滑滚动（否则滚动截图会拍到中途）
  await win.webContents.executeJavaScript(`
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-in'));
  `);
  await sleep(500);

  const map = await win.webContents.executeJavaScript(`
    (() => {
      const pick = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return Math.round(r.top + window.scrollY);
      };
      return {
        hero: 0,
        claim: pick('.claim'),
        factors: pick('.factors'),
        ability: pick('.ability'),
        look: pick('.look'),
        download: pick('.download'),
        honest: pick('.honest'),
        closing: pick('.closing'),
        height: document.body.scrollHeight
      };
    })()
  `);
  console.log('offsets:', JSON.stringify(map));

  const shots = [
    ['d1-hero', 0],
    ['d2-claim', map.claim - 40],
    ['d3-factors', map.factors - 20],
    ['d4-ability', map.ability - 20],
    ['d5-look', map.look - 20],
    ['d6-download', map.download + 300],
    ['d7-honest', map.honest - 20],
    ['d8-closing', map.closing + 120],
    ['d9-footer', map.height - 860]
  ];

  for (const [name, y] of shots) {
    await win.webContents.executeJavaScript(`window.scrollTo(0, ${Math.max(0, y)})`);
    await sleep(650);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `${name}.png`), img.toPNG());
    console.log('[shot]', name, y);
  }

  // 移动端
  win.setContentSize(390, 844);
  await sleep(700);
  const mob = await win.webContents.executeJavaScript(`
    (() => {
      const pick = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        return Math.round(r.top + window.scrollY);
      };
      return { claim: pick('.claim'), factors: pick('.factors'), download: pick('.download'), height: document.body.scrollHeight };
    })()
  `);
  console.log('mobile offsets:', JSON.stringify(mob));

  const mobileShots = [
    ['m1-hero', 0],
    ['m2-claim', mob.claim - 20],
    ['m3-factors', mob.factors - 20],
    ['m4-download', mob.download + 260]
  ];
  for (const [name, y] of mobileShots) {
    await win.webContents.executeJavaScript(`window.scrollTo(0, ${Math.max(0, y)})`);
    await sleep(650);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `${name}.png`), img.toPNG());
    console.log('[shot]', name, y);
  }

  app.quit();
});
