/** 导出与分享 */

export function download(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** 轨迹 → GPX 1.1 */
export function toGPX(trail) {
  const name = escapeXml(trail.name || '晓山青轨迹');
  const time = new Date(trail.startedAt || Date.now()).toISOString();
  const points = (trail.points || [])
    .map((p) => {
      const ele = Number.isFinite(p.altitude) ? `<ele>${p.altitude.toFixed(1)}</ele>` : '';
      const t = p.ts ? `<time>${new Date(p.ts).toISOString()}</time>` : '';
      return `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${ele}${t}</trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Mossy Dawn / 晓山青" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${time}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

/** 分享文本：优先系统分享面板，退回复制 */
export async function shareText(text, title = '晓山青') {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return 'shared';
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
    throw new Error('no share api');
  } catch (err) {
    if (err.name === 'AbortError') return 'cancelled';
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}

export function smsLink(phone, body) {
  return `sms:${phone}${body ? `?&body=${encodeURIComponent(body)}` : ''}`;
}

export function telLink(phone) {
  return `tel:${phone}`;
}

export function amapUrl(lat, lon, name = '目标位置') {
  return `https://uri.amap.com/marker?position=${lon},${lat}&name=${encodeURIComponent(name)}&src=mossydawn&coordinate=gaode&callnative=1`;
}

/** 复制文本 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
