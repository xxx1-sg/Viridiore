/**
 * 光之卡片：把一次出行渲染成一张可保存、可转发的图
 *
 * 为什么值得做：这是产品唯一不需要花钱的增长渠道。
 * 用户愿意转发的前提不是"界面好看"，而是这张图替他保留了
 * 一个他自己拍不出来的证据——时间、坐标、海拔、当时的天气。
 *
 * 全部用 Canvas 手绘，不引入 html2canvas 之类的重库，
 * 好处是离线可用、导出尺寸可控、字体渲染不依赖 DOM 布局。
 */

const W = 1080;
const H = 1350;

const PALETTE = {
  skyTop: '#0b1a13',
  skyMid: '#1d3a2a',
  skyLow: '#5c6244',
  dawn: '#e9a95e',
  dawnSoft: '#f6d3a0',
  sun: '#fff2d0',
  ridgeFar: '#1a3426',
  ridgeMid: '#122a1d',
  ridgeNear: '#0a1710',
  ink: '#f2f7f2',
  inkSoft: 'rgba(242,247,242,0.72)',
  inkFaint: 'rgba(242,247,242,0.42)'
};

const FONT_SERIF = '"Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", "STSong", serif';
const FONT_SANS = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

/* ---------------- 基础绘制工具 ---------------- */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 生成一条起伏的山脊线（归一化坐标），seed 保证同一张卡片图形稳定 */
function ridgeLine(seed, baseY, amplitude, freq, points = 42) {
  const pts = [];
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i <= points; i++) {
    const x = i / points;
    const y =
      baseY -
      amplitude *
        (0.55 * Math.sin(x * Math.PI * freq + seed) +
          0.3 * Math.sin(x * Math.PI * freq * 2.3 + seed * 1.7) +
          0.15 * (rnd() - 0.5));
    pts.push([x, y]);
  }
  return pts;
}

function fillRidge(ctx, pts, color, w, h) {
  ctx.beginPath();
  ctx.moveTo(0, h);
  pts.forEach(([x, y]) => ctx.lineTo(x * w, y * h));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** 单行装不下时，从尾部逐段丢弃，避免文字被画布边缘裁掉 */
function fitLine(ctx, parts, maxWidth, sep = '  ·  ') {
  const items = parts.filter(Boolean);
  while (items.length > 1 && ctx.measureText(items.join(sep)).width > maxWidth) items.pop();
  return items.join(sep);
}

/* ---------------- 主渲染 ---------------- */

/**
 * @param {object} p
 * @param {object} p.narrative buildNarrative() 的返回值
 * @param {string} p.mode      sunrise | cloudsea | stars | hike
 * @param {number} p.probability 追光概率（可选）
 * @param {string} p.sourceLabel 数据来源标注
 */
export function renderCard({ narrative, mode = 'hike', probability = null, sourceLabel = '' }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const meta = narrative?.meta || {};

  /* 天空 */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.42, PALETTE.skyMid);
  sky.addColorStop(0.66, PALETTE.skyLow);
  sky.addColorStop(0.78, '#c98a54');
  sky.addColorStop(1, '#20301f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  /* 太阳与光晕 */
  const sunX = W * 0.7;
  const sunY = H * 0.5;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, W * 0.62);
  glow.addColorStop(0, 'rgba(255,240,205,0.95)');
  glow.addColorStop(0.12, 'rgba(246,196,132,0.55)');
  glow.addColorStop(0.42, 'rgba(233,169,94,0.18)');
  glow.addColorStop(1, 'rgba(233,169,94,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.beginPath();
  ctx.arc(sunX, sunY, 54, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.sun;
  ctx.fill();

  /* 云海带：几条低透明度的横向云层 */
  for (let i = 0; i < 4; i++) {
    const y = H * (0.62 + i * 0.035);
    const cg = ctx.createLinearGradient(0, y - 40, 0, y + 40);
    cg.addColorStop(0, 'rgba(255,238,214,0)');
    cg.addColorStop(0.5, `rgba(255,238,214,${0.16 - i * 0.03})`);
    cg.addColorStop(1, 'rgba(255,238,214,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, y - 40, W, 80);
  }

  /* 三层山脊 */
  fillRidge(ctx, ridgeLine(3.1, 0.72, 0.1, 1.6), 'rgba(38,66,46,0.85)', W, H);
  fillRidge(ctx, ridgeLine(7.7, 0.8, 0.12, 2.1), PALETTE.ridgeMid, W, H);
  fillRidge(ctx, ridgeLine(12.3, 0.9, 0.1, 2.8), PALETTE.ridgeNear, W, H);

  /* 暗角，把视线压回文字区 */
  const vig = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.45, H * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(5,12,8,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  /* 顶部品牌 */
  ctx.font = `500 26px ${FONT_SANS}`;
  ctx.fillStyle = PALETTE.inkSoft;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('晓山青 · Viridiore', 72, 78);

  ctx.font = `400 22px ${FONT_SANS}`;
  ctx.fillStyle = 'rgba(242,247,242,0.34)';
  ctx.textAlign = 'right';
  ctx.fillText(meta.weather ? `${meta.weather}${meta.temp !== undefined ? ` ${meta.temp}℃` : ''}` : '', W - 72, 78);

  /* 概率徽标（仅追光卡） */
  if (Number.isFinite(probability)) {
    ctx.textAlign = 'left';
    ctx.font = `600 30px ${FONT_SANS}`;
    const label = `${mode === 'stars' ? '星空' : mode === 'sunrise' ? '日出' : '云海'} ${probability}%`;
    const w = ctx.measureText(label).width + 52;
    ctx.fillStyle = 'rgba(12,25,18,0.42)';
    roundRect(ctx, 72, 122, w, 62, 31);
    ctx.fill();
    ctx.strokeStyle = 'rgba(246,211,160,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = PALETTE.dawnSoft;
    ctx.fillText(label, 72 + 26, 122 + 32);
  }

  /* 底部文字区：自下而上排布，保证不同长度的文案都不会互相压字 */
  const padX = 72;
  const maxW = W - padX * 2;
  const footerY = H - 62;

  /* 时间：整张卡的视觉锚点 */
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `300 126px ${FONT_SERIF}`;
  const timeY = H - 372;
  ctx.fillText(meta.time || '--:--', padX, timeY);

  /* 事实行：地点 · 海拔 · 距离（过长自动省略尾部） */
  ctx.font = `400 27px ${FONT_SANS}`;
  ctx.fillStyle = PALETTE.inkSoft;
  const facts = [];
  if (meta.place) facts.push(meta.place);
  if (meta.elevation) facts.push(`海拔 ${meta.elevation} 米`);
  if (narrative?.detail) facts.push(narrative.detail);
  const factsY = timeY + 58;
  ctx.fillText(fitLine(ctx, facts, maxW), padX, factsY);

  /* 叙事句 */
  ctx.font = `400 37px ${FONT_SERIF}`;
  ctx.fillStyle = PALETTE.ink;
  const lines = wrapText(ctx, narrative?.headline || '', maxW).slice(0, 3);
  const lineH = 54;
  const narrativeTop = factsY + 60;
  lines.forEach((line, i) => ctx.fillText(line, padX, narrativeTop + i * lineH));
  const narrativeBottom = narrativeTop + (lines.length - 1) * lineH;

  /* 标签：空间不够就整体省略，绝不压到页脚 */
  const tagY = narrativeBottom + 58;
  if (narrative?.tags?.length && tagY < footerY - 34) {
    let tx = padX;
    ctx.font = `500 22px ${FONT_SANS}`;
    narrative.tags.slice(0, 3).forEach((tag) => {
      const tw = ctx.measureText(tag).width + 34;
      ctx.strokeStyle = 'rgba(242,247,242,0.28)';
      ctx.lineWidth = 1.2;
      roundRect(ctx, tx, tagY - 30, tw, 44, 22);
      ctx.stroke();
      ctx.fillStyle = PALETTE.inkSoft;
      ctx.fillText(tag, tx + 17, tagY);
      tx += tw + 14;
    });
  }

  /* 页脚：坐标 + 数据来源 */
  ctx.font = `400 20px ${FONT_SANS}`;
  ctx.fillStyle = PALETTE.inkFaint;
  const footer = fitLine(ctx, [meta.coord, sourceLabel || '离线记录'], maxW * 0.6);
  ctx.fillText(footer, padX, footerY);

  ctx.textAlign = 'right';
  ctx.fillText(meta.date || '', W - padX, footerY);

  return canvas;
}

/* ---------------- 导出 ---------------- */

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出失败'))), 'image/png');
    else reject(new Error('当前环境不支持导出图片'));
  });
}

export async function downloadCard(canvas, filename = 'xiaoshanqing.png') {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return blob;
}

/**
 * 系统分享（移动端优先）。不支持时返回 false，由调用方回落到下载。
 */
export async function shareCard(canvas, { title, text } = {}) {
  if (!navigator.share || !navigator.canShare) return false;
  try {
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], 'xiaoshanqing.png', { type: 'image/png' });
    if (!navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title, text });
    return true;
  } catch (err) {
    if (err?.name === 'AbortError') return true; // 用户主动取消，不算失败
    return false;
  }
}

export { W as CARD_WIDTH, H as CARD_HEIGHT };
