/**
 * 决策层：自然语言 → 结构化约束 → 路线推荐
 *
 * 这不是"AI 助手"，是一个入口。用户不会为了问一句话点开一个新页面，
 * 但会顺手在首页的输入框里打一行字。
 *
 * 实现上刻意不用大模型做主路径：
 *   规则解析在 20 行内可读、零延迟、离线可用、结果可预测。
 *   配了 LLM 的场合，只在规则解析失败时兜底（parseWithLLM）。
 *
 * 已知局限：山峰数据集里没有"停车场""水源""门票"这些字段，
 * 所以不会假装能按这些条件筛选——宁可少答，不能编。
 */
import { MOUNTAINS } from '../data/mountains.js';

const CN_NUM = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function cnToNum(s) {
  if (!s) return null;
  if (s === '半') return 0.5;
  if (s.includes('十')) {
    const [a, b] = s.split('十');
    return (CN_NUM[a] || 1) * 10 + (b ? CN_NUM[b] || 0 : 0);
  }
  return CN_NUM[s] ?? null;
}

/** 解析时长（小时） */
function parseHours(text) {
  let m = text.match(/(\d+(?:\.\d+)?)\s*个?\s*小时/);
  if (m) return Number(m[1]);
  m = text.match(/([一两二三四五六七八九十半])\s*个?\s*小时/);
  if (m) return cnToNum(m[1]);
  if (/半小时/.test(text)) return 0.5;
  if (/半天/.test(text)) return 3.5;
  if (/一整天|全天|一天/.test(text)) return 8;
  return null;
}

/** 解析爬升上限（米） */
function parseAscent(text) {
  const m = text.match(/爬升\s*(?:不超过|少于|控制在)?\s*(\d{2,4})\s*(?:米|m)/);
  if (m) return Number(m[1]);
  return null;
}

const TAG_RULES = [
  { key: '日出', re: /日出|看太阳|晨光/ },
  { key: '日落', re: /日落|夕阳/ },
  { key: '云海', re: /云海/ },
  { key: '星空', re: /星空|银河|看星|星轨/ },
  { key: '海景', re: /海景|看海|海边/ },
  { key: '溪谷', re: /溪谷|溪流|瀑布|玩水/ },
  { key: '城市', re: /城市|夜景|灯光/ },
  { key: '夜爬', re: /夜爬|晚上爬|下班后/ },
  { key: '越野跑', re: /越野跑|跑步|训练/ },
  { key: '重装', re: /重装|露营|过夜/ }
];

/** 意图标签 ↔ 山峰数据里的 tags 写法不一致，这里做映射 */
const TAG_ALIAS = {
  日出: ['日出'],
  日落: ['日落'],
  云海: ['云海'],
  星空: ['观星', '星空'],
  海景: ['海景'],
  溪谷: ['溪谷', '瀑布'],
  城市: ['城市'],
  夜爬: ['夜爬'],
  越野跑: ['越野跑'],
  重装: ['重装']
};

const mountainHasTag = (mountain, intentTag) =>
  (TAG_ALIAS[intentTag] || [intentTag]).some((t) => mountain.tags.includes(t));

/**
 * 解析用户输入
 * @returns {{constraints:object, understood:string[], unsupported:string[], query:string}}
 */
export function parseIntent(input = '') {
  const text = String(input).trim();
  const constraints = {
    maxHours: parseHours(text),
    maxAscent: parseAscent(text),
    difficultyMin: null,
    difficultyMax: null,
    tags: new Set(),
    audience: null,
    kidAge: null
  };
  const understood = [];
  const unsupported = [];

  for (const rule of TAG_RULES) {
    if (rule.re.test(text)) constraints.tags.add(rule.key);
  }
  if (constraints.tags.size) {
    understood.push(`想要${[...constraints.tags].join(' / ')}`);
  }

  if (constraints.maxHours) {
    understood.push(`${constraints.maxHours} 小时以内`);
  }
  if (constraints.maxAscent) {
    understood.push(`爬升不超过 ${constraints.maxAscent} 米`);
  }

  const kid = text.match(/(\d{1,2})\s*岁/);
  const hasKid = /孩子|小孩|娃|儿子|女儿|亲子|带娃/.test(text);
  const hasElder = /爸妈|父母|老人|长辈|爷爷|奶奶/.test(text);

  if (hasKid || kid) {
    constraints.audience = 'kid';
    constraints.kidAge = kid ? Number(kid[1]) : null;
    constraints.difficultyMax = constraints.kidAge && constraints.kidAge <= 8 ? 2 : 3;
    if (constraints.maxHours == null) constraints.maxHours = 4;
    understood.push(
      constraints.kidAge ? `带 ${constraints.kidAge} 岁小孩` : '带孩子'
    );
  } else if (hasElder) {
    constraints.audience = 'elder';
    constraints.difficultyMax = 2;
    if (constraints.maxHours == null) constraints.maxHours = 4;
    understood.push('有长辈同行');
  } else if (/新手|第一次|没爬过|小白/.test(text)) {
    constraints.audience = 'beginner';
    constraints.difficultyMax = 2;
    understood.push('新手友好');
  } else if (/有经验|经常爬|老手|挑战|虐|强度大/.test(text)) {
    constraints.audience = 'expert';
    constraints.difficultyMin = 3;
    understood.push('想要有强度');
  }

  if (/停车场|停车/.test(text)) unsupported.push('停车场信息暂未收录');
  if (/门票|收费/.test(text)) unsupported.push('门票价格暂未收录');
  if (/水源|补水/.test(text)) unsupported.push('沿途水源点暂未收录');

  return { constraints, understood, unsupported, query: text };
}

/** 把解析结果说回给用户——"被看见"的第一步 */
export function describeIntent({ understood, unsupported }) {
  if (!understood.length) return '我还没听懂你的条件，可以试试「周六带 6 岁孩子，2 小时能来回」。';
  const base = `我理解你要的是：${understood.join('，')}。`;
  return unsupported.length ? `${base}（${unsupported.join('、')}，不参与筛选）` : base;
}

/**
 * 匹配路线
 * @returns {{items:Array, relaxed:boolean, note:string}}
 */
export function matchRoutes(intent) {
  const c = intent.constraints;
  const scored = MOUNTAINS.map((m) => {
    const tagHits = [...c.tags].filter((t) => mountainHasTag(m, t)).length;
    const overHours = c.maxHours ? m.route.hours - c.maxHours : 0;
    const overAscent = c.maxAscent ? m.route.ascent - c.maxAscent : 0;

    let difDelta = 0;
    if (c.difficultyMax != null) difDelta = Math.max(0, m.difficulty - c.difficultyMax);
    if (c.difficultyMin != null) difDelta = Math.max(difDelta, Math.max(0, c.difficultyMin - m.difficulty));

    // 云海/日出偏好高海拔：给一点海拔加权
    const elevBonus = c.tags.has('云海') || c.tags.has('星空') ? (m.elevation - 400) / 600 : 0;

    const score = tagHits * 3 - Math.max(0, overHours) * 1.6 - Math.max(0, overAscent) / 180 - difDelta * 2 + elevBonus;
    return { mountain: m, score, tagHits, overHours, overAscent, difDelta };
  });

  const strict = scored.filter((s) => s.overHours <= 0.25 && s.overAscent <= 60 && s.difDelta === 0);
  const pool = strict.length ? strict : scored.filter((s) => s.overHours <= 1.5 && s.difDelta <= 1);
  const relaxed = !strict.length;

  const items = [...(pool.length ? pool : scored)]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => ({
      mountain: s.mountain,
      why: reasonsFor(s, c)
    }));

  return {
    items,
    relaxed,
    note: relaxed
      ? '没有完全符合的路线，下面是放宽条件后最接近的三条——哪一条超了会写在理由里。'
      : strict.length > items.length
        ? `有 ${strict.length} 条符合，先看最合适的三条。`
        : `找到 ${strict.length} 条符合的路线。`
  };
}

function reasonsFor(s, c) {
  const r = [];
  if (c.maxHours) {
    r.push(s.overHours <= 0 ? `约 ${s.mountain.route.hours} 小时，在 ${c.maxHours} 小时内` : `约 ${s.mountain.route.hours} 小时，比你说的多 ${s.overHours.toFixed(1)} 小时`);
  }
  if (c.maxAscent) {
    r.push(s.overAscent <= 0 ? `爬升 ${s.mountain.route.ascent} 米` : `爬升 ${s.mountain.route.ascent} 米，略超 ${Math.round(s.overAscent)} 米`);
  }
  if (c.difficultyMax != null && s.mountain.difficulty <= c.difficultyMax) {
    r.push(`难度 ${s.mountain.difficulty}/5，适合当前水平`);
  }
  const hit = [...c.tags].filter((t) => mountainHasTag(s.mountain, t));
  if (hit.length) r.push(`有${hit.join('、')}`);
  if (!r.length) r.push(s.mountain.desc);
  return r.slice(0, 3).join(' · ');
}

/** 快捷问题：首页默认展示，覆盖最常见的四类意图 */
export const QUICK_INTENTS = [
  '周六带 6 岁孩子，2 小时能来回',
  '明早想看云海，能爬 3 小时的',
  '一个人夜爬，安全的',
  '想拍海景，半天强度'
];

/**
 * 可选：规则解析失败时用大模型兜底
 * 只在配置了 LLM 的场合调用，返回同样的约束结构
 */
export async function parseWithLLM(text, llmAnswer) {
  if (typeof llmAnswer !== 'function') return null;
  const prompt = `把用户的户外需求解析成 JSON，不要输出解释。
字段：maxHours(数字|null), maxAscent(数字|null), difficultyMax(1-5|null), tags(数组，取值限 日出/云海/星空/海景/溪谷/城市/夜爬/越野跑/重装), audience("kid"|"elder"|"beginner"|"expert"|null)
用户说：${text}`;
  try {
    const raw = await llmAnswer({ system: '只输出 JSON。', user: prompt });
    const json = JSON.parse(String(raw).replace(/```json|```/g, '').trim());
    return json;
  } catch {
    return null;
  }
}
