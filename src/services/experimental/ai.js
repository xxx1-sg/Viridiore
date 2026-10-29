/**
 * AI 助手
 * - 默认走内置户外知识引擎（离线、零成本、可解释）
 * - 配置了 LLM 端点后自动切换到在线大模型，并把本地知识作为上下文注入
 */
import { config } from '../config.js';
import { KNOWLEDGE } from '../data/knowledge.js';
import { MOUNTAINS } from '../data/mountains.js';
import { scoreDay, pickBestDay } from './chase.js';
import { formatTime } from '../core/format.js';

/* ---------------- 本地检索引擎 ---------------- */

function scoreEntry(entry, text) {
  let score = 0;
  for (const kw of entry.keywords) {
    if (!kw) continue;
    if (text.includes(kw)) {
      // 关键词越长越具体，权重越高
      score += 2 + Math.min(4, kw.length / 2);
    }
  }
  // 标题命中额外加分
  if (text.includes(entry.title.slice(0, 2))) score += 1;
  return score;
}

function bestEntry(text) {
  let best = null;
  let bestScore = 0;
  for (const entry of KNOWLEDGE) {
    const s = scoreEntry(entry, text);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }
  return bestScore >= 3 ? { entry: best, score: bestScore } : null;
}

function findMountain(text) {
  return MOUNTAINS.find((m) => text.includes(m.name) || text.includes(m.name.replace('山', '')));
}

function weatherAnswer(context) {
  const wx = context.weather;
  if (!wx) return null;
  const { now, daily, sun, place } = wx;
  const lines = [];

  lines.push(`**${place.name} 当前 ${now.temp}℃，${now.text}**，体感 ${now.feels}℃，湿度 ${now.humidity}%，${now.windDir} ${now.windScale} 级。`);
  if (sun?.sunrise) {
    lines.push(`今天日出 ${formatTime(sun.sunrise)}，日落 ${formatTime(sun.sunset)}。`);
  }
  if (daily?.length) {
    const today = daily[0];
    lines.push(`今日 ${today.min}—${today.max}℃，降水概率 ${today.pop}%，紫外线指数 ${today.uv ?? '--'}。`);
    const { best } = pickBestDay(daily, 'sunrise') || {};
    if (best?.score >= 60) {
      lines.push(`\n这周最适合看日出的是 ${best.day.date}（指数 ${best.score}，${best.grade.label}）。`);
    }
    if (today.pop >= 60) lines.push('\n降水概率偏高，山区路面湿滑，建议改期或缩短行程。');
    else if (Number(now.windScale) >= 5) lines.push('\n风力偏大，山顶体感会更冷，记得带防风层。');
    else lines.push('\n整体适合出行，注意山顶与市区 5℃ 左右的温差。');
  }
  if (wx.source === 'demo') lines.push('\n（当前为演示数据，配置和风天气 Key 后自动切换真实预报）');
  return lines.join('\n');
}

function mountainAnswer(mountain, context) {
  const lines = [
    `**${mountain.name}（${mountain.elevation}m）· ${mountain.area}**`,
    mountain.desc,
    '',
    `• 难度：${'★'.repeat(mountain.difficulty)}${'☆'.repeat(5 - mountain.difficulty)}`,
    `• 参考路线：${mountain.route.distance}km / 爬升 ${mountain.route.ascent}m / 约 ${mountain.route.hours} 小时`,
    `• 最佳季节：${mountain.season}`
  ];

  const wx = context.weather;
  if (wx?.daily?.length) {
    const scored = wx.daily.map((d) => ({ d, ...scoreDay(d, 'sunrise') }));
    const top = [...scored].sort((a, b) => b.score - a.score)[0];
    lines.push('', `结合当前天气预报：${top.d.date} 追光指数 ${top.score}（${top.grade.label}），${top.reasons[0]}。`);
  }
  lines.push('', '出门前记得在「装备」页对一遍清单，并告诉家人你的路线与返程时间。');
  return lines.join('\n');
}

const FALLBACK = `我可以帮你这些事：

• **看天气** —— "今天适合爬山吗"、"明天会下雨吗"
• **追光建议** —— "这周哪天天看日出最好"、"云海什么时候有"
• **山峰信息** —— "梧桐山怎么爬"、"七娘山难不难"
• **安全知识** —— "失温怎么办"、"迷路没信号"
• **装备清单** —— "一日徒步带什么"

也可以直接把你的问题说得更具体一点，比如"周六早上七娘山适合看日出吗"。`;

export function localAnswer(question, context = {}) {
  const text = String(question || '').toLowerCase();
  const ctx = context;

  if (/^(你好|hi|hello|在吗|嗨)/.test(text)) {
    return `你好，我是晓山青的户外助手。${ctx.greeting ? `现在是${ctx.greeting}。` : ''}\n\n可以问我天气、追光、路线或安全相关的问题。`;
  }

  // 天气类
  if (/(天气|气温|下雨|下雨吗|冷不冷|热不热|风力|湿度|今天|明天|这周)/.test(text) && ctx.weather) {
    const wx = weatherAnswer(ctx);
    if (wx) return wx;
  }

  // 山峰类
  const mountain = findMountain(text);
  if (mountain && /(怎么|如何|难|强度|路线|攻略|多久|海拔|值得|爬)/.test(text)) {
    return mountainAnswer(mountain, ctx);
  }

  // 追光类
  if (/(日出|日落|云海|星空|追光|霞|拍照)/.test(text) && ctx.weather?.daily) {
    const mode = /云海/.test(text) ? 'cloudsea' : /星空|银河/.test(text) ? 'stars' : 'sunrise';
    const { best, all } = pickBestDay(ctx.weather.daily, mode) || {};
    if (best) {
      const modeName = { sunrise: '日出', cloudsea: '云海', stars: '星空' }[mode];
      const list = all
        .slice(0, 4)
        .map((d) => `${d.day.date.slice(5)} ${d.score} 分`)
        .join(' · ');
      return `**未来几天${modeName}指数**：${list}\n\n最推荐 **${best.day.date}**（${best.score} 分，${best.grade.label}）。\n${best.reasons.map((r) => `• ${r}`).join('\n')}\n\n${ctx.mountain ? `在${ctx.mountain.name}，建议提前 90 分钟从登山口出发。` : ''}`;
    }
  }

  // 知识库
  const hit = bestEntry(text);
  if (hit) {
    let answer = hit.entry.answer;
    if (ctx.weather?.sun?.sunrise && hit.entry.id === 'sunrise') {
      answer += `\n\n今天本地日出时间 **${formatTime(ctx.weather.sun.sunrise)}**，提前 30 分钟到机位刚好。`;
    }
    return answer;
  }

  if (/推荐|去哪|路线/.test(text)) {
    return `按体能给你三条线：

• **第一次爬山** → 凤凰山（376m，2 小时），或塘朗山（430m，随时可撤）
• **想看海景** → 梅沙尖（753m）或七娘山（869m）
• **想拍云海** → 梧桐山（943m），秋冬清晨概率最高

告诉我你的可用时间（半天 / 一天）和同行人数，我可以给更具体的安排。`;
  }

  return FALLBACK;
}

/* ---------------- 在线大模型 ---------------- */

async function llmAnswer(question, context) {
  const { endpoint, key, model } = config.get('llm');
  if (!endpoint || !key) return null;

  const knowledge = KNOWLEDGE.map((k) => `【${k.title}】${k.answer.replace(/\*\*/g, '')}`).join('\n\n');
  const wx = context.weather;
  const weatherBrief = wx
    ? `当前位置 ${wx.place.name}，${wx.now.temp}℃ ${wx.now.text}，湿度 ${wx.now.humidity}%，风 ${wx.now.windScale} 级；未来三天：` +
      wx.daily
        .slice(0, 3)
        .map((d) => `${d.date} ${d.textDay} ${d.min}-${d.max}℃ 降水概率${d.pop}%`)
        .join('；')
    : '暂无天气数据';

  const system = `你是「晓山青」App 内置的户外助手，服务对象是中国华南地区的徒步爱好者。回答要求：
1. 中文，简洁，先给结论再给理由，总长度不超过 260 字
2. 涉及安全问题时必须明确风险与应对
3. 不确定的信息直接说不确定，不要编造具体数据
4. 可以使用 **加粗** 和短横线列表，不要用表格

当前天气：${weatherBrief}

可用户外知识库（优先参考）：
${knowledge}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const url = endpoint.replace(/\/$/, '');
    const res = await fetch(url.endsWith('/chat/completions') ? url : `${url}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: question }
        ]
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return text ? text.trim() : null;
  } catch (err) {
    console.warn('[ai] 在线模型调用失败，回退本地知识库', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 提问入口
 * @returns {Promise<{text:string, source:'llm'|'local'}>}
 */
export async function ask(question, context = {}) {
  if (config.hasLLM()) {
    const text = await llmAnswer(question, context);
    if (text) return { text, source: 'llm' };
  }
  return { text: localAnswer(question, context), source: 'local' };
}

/** 简易 markdown → html（只支持加粗、换行、列表） */
export function renderAnswer(text) {
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^• /gm, '<span style="color:var(--dawn-500)">•</span> ')
    .replace(/\n/g, '<br>');
}

export const QUICK_QUESTIONS = [
  '今天适合爬山吗',
  '这周哪天天看日出最好',
  '梧桐山怎么爬',
  '新手该走哪条线',
  '失温了怎么处理',
  '一日徒步带什么'
];
