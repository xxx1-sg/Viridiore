/**
 * 陪伴层：此刻，产品想对用户说的一句话
 *
 * 为什么单独成层：项目里散落着很多"情绪价值"——补偿机制（chase）、
 * 和上次比（narrative）、年度回顾（narrative）——但它们都是"功能成功后的
 * 副产品"，用户常常看不到。这里把它们收拢成一个有节律、每天只出一句的出口。
 *
 * 三条硬规矩（和项目一贯的"宁可少答，不能编"一致）：
 *   1. 每一句都必须能追到一个真实数据：真实预报、真实轨迹、真实的时间间隔。
 *      追不到就说"我没有数据"，绝不为了抒情编造细节。
 *   2. 纯函数、零依赖网络、零 LLM。山上有信号的概率远低于没有。
 *   3. 主动替用户卸下"没去"的负担——这是补偿机制的精髓，也是竞品最缺的。
 */

const DAY = 86400e3;

/* ---------------- 小工具 ---------------- */

const num = (v, d = NaN) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/** 两个日期相差的自然日数（按本地零点计） */
function dayGap(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return Math.round((db - da) / DAY);
}

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const md = (d) => `${new Date(d).getMonth() + 1} 月 ${new Date(d).getDate()} 日`;
const hm = (d) =>
  d ? `${String(new Date(d).getHours()).padStart(2, '0')}:${String(new Date(d).getMinutes()).padStart(2, '0')}` : '--:--';

/* ---------------- 主线：生成陪伴句 ---------------- */

/**
 * @param {object} p
 * @param {object|null} p.weather   当前天气包（appState.weather），可为空
 * @param {object|null} p.window    由 chase.rankDays 算好的最佳窗口
 *   { probability, index, day:{dateObj,sunrise}, mode, providerName }，可为空
 * @param {Array}  p.trails         历史轨迹（已按时间倒序）
 * @param {Date}   [p.now]          当前时间，便于测试
 * @returns {{tone:string, text:string, source:string}}
 *   tone: sunrise | hopeful | fair | lonely | memory | rain | empty
 *   source: 这句话依据的数据来源，透明可查
 */
export function companionLine({ weather = null, window: win = null, trails = [], now = new Date() } = {}) {
  const list = Array.isArray(trails) ? trails : [];

  /* 1. 没有任何轨迹 —— 先不谈陪伴，先给一个不设门槛的邀请 */
  if (!list.length) {
    return {
      tone: 'empty',
      text: '还没有上山记录。不着急，等你哪天想走，我一直在这儿。',
      source: '本地轨迹库为空'
    };
  }

  const last = list[0];
  const lastStart = last?.startedAt || last?.endedAt || 0;
  const sinceLast = lastStart ? dayGap(lastStart, now) : null;

  /* 2. 很久没上山 —— 主动卸下负担，不说"你已经 X 天没来了"这种打卡话术 */
  if (sinceLast != null && sinceLast >= 45) {
    return {
      tone: 'lonely',
      text: `距上次上山已经 ${sinceLast} 天了。不用愧疚，山一直在，你随时可以回来。`,
      source: `最近一次轨迹：${md(lastStart)}`
    };
  }

  /* 3. 有真实的窗口（概率来自 chase）—— 说"值得去"或"可以赌" */
  if (win && Number.isFinite(win.probability)) {
    const when = relLabel(win.index ?? 0, win.day?.dateObj || win.day?.date);
    const time = hm(win.day?.sunriseAt || win.day?.sunrise);
    const modeName = MODE_NAME[win.mode || 'cloudsea'] || '云海';
    const temp = num(weather?.now?.temp);
    const tempBit = Number.isFinite(temp) ? `，现在 ${Math.round(temp)}℃` : '';

    if (win.probability >= 55) {
      return {
        tone: 'sunrise',
        text: `${when}${time !== '--:--' ? ` ${time}` : ''} 前后，${modeName}概率 ${win.probability}%，是接下来几天里最好的窗口${tempBit}。我替你记着了。`,
        source: `${win.providerName || weather?.providerName || '实时预报'} · ${when}`
      };
    }
    if (win.probability >= 30) {
      return {
        tone: 'fair',
        text: `${when}${time !== '--:--' ? ` ${time}` : ''} 前后，${modeName}概率 ${win.probability}%。机会不算大，要是本来就要上山，顺手看一眼也好。`,
        source: `${win.providerName || weather?.providerName || '实时预报'} · ${when}`
      };
    }
  }

  /* 4. 有天气但没有像样的窗口 —— 补偿式安慰，指向"把体力留给下一次" */
  const rainy = isRainyStretch(weather);
  if (rainy) {
    return {
      tone: 'rain',
      text: `接下来几天多雨，${rainy}。不用硬上，把这段空档当作休息。`,
      source: '未来 7 日降水预报'
    };
  }
  if (weather && (win || weather.daily?.length)) {
    return {
      tone: 'hopeful',
      text: '未来几天的窗口都一般。这次别硬上，把体力留给下一次——好天气不会只有一次。',
      source: '未来 7 日追光概率'
    };
  }

  /* 5. 连天气都取不到 —— 如实说，不编 */
  if (sinceLast != null && sinceLast <= 7) {
    return {
      tone: 'memory',
      text: `${sinceLast === 0 ? '今天' : `${sinceLast} 天前`}刚上过山。这会儿拿不到天气，等有信号了我再告诉你什么时候值得去。`,
      source: '无天气数据'
    };
  }
  return {
    tone: 'fair',
    text: '这会儿取不到天气，等有信号了我再替你算。',
    source: '无天气数据'
  };
}

/* ---------------- 内部工具 ---------------- */

const MODE_NAME = { cloudsea: '云海', sunrise: '日出', stars: '星空' };

function relLabel(index, date) {
  if (index === 0) return '今天';
  if (index === 1) return '明天';
  if (index === 2) return '后天';
  if (date) {
    const d = new Date(date);
    if (!Number.isNaN(d.getTime())) return WD[d.getDay()];
  }
  return `${index} 天后`;
}

function isRainyStretch(weather) {
  const daily = weather?.daily;
  if (!Array.isArray(daily) || !daily.length) return '';
  const rainyDays = daily.slice(0, 4).filter((d) => num(d.precip, 0) >= 1 || num(d.pop, 0) >= 60).length;
  if (rainyDays >= 3) return `有 ${rainyDays} 天在下雨`;
  return '';
}

/* ---------------- 第二档：山记得你 ---------------- */

/**
 * 一次出行保存后，说一句"这座山记得你"。
 * 数据全部来自真实历史轨迹，绝不编造次数或成绩。
 *
 * @param {object} trail  刚保存的轨迹
 * @param {Array}  history 保存前的历史（不含本条），已按时间倒序
 * @returns {{title:string, text:string, stat:string}|null}
 */
export function mountainRemembers(trail, history = []) {
  if (!trail) return null;
  const mine = Array.isArray(history) ? history.filter((t) => t && t.id !== trail.id) : [];

  const name = (trail.name || '这一趟').split(' · ')[0];
  const gainNow = num(trail.stats?.elevation?.gain, 0);
  const kmNow = num(trail.stats?.distanceKm, 0);
  const durNow = (num(trail.endedAt, 0) - num(trail.startedAt, 0)) / 3600e3;

  /* 第一次上这条山 */
  const sameName = mine.filter((t) => (t.name || '').split(' · ')[0] === name);
  if (!sameName.length && mine.length === 0) {
    return {
      title: '第一次上山',
      text: `这是你在晓山青记录的第一趟。${name}已经记住了你。`,
      stat: `${kmNow.toFixed(2)} 公里 · 爬升 ${Math.round(gainNow)} 米`
    };
  }

  /* 第 N 次 */
  const nth = sameName.length + 1;

  /* 和同一条路线最早的一次比 —— 用真实的第一条做基准 */
  const earliest = sameName[sameName.length - 1];
  if (earliest && nth >= 2) {
    const eGain = num(earliest.stats?.elevation?.gain, 0);
    const eDur = (num(earliest.endedAt, 0) - num(earliest.startedAt, 0)) / 3600e3;
    const dGain = gainNow - eGain;
    const dDurMin = (eDur - durNow) * 60;

    let line = `这是你第 ${nth} 次上${name}。`;
    if (dDurMin >= 8 && durNow > 0.1) {
      line += `比第一次快了 ${Math.round(dDurMin)} 分钟。`;
    } else if (dGain >= 30) {
      line += `比第一次多爬了 ${Math.round(dGain)} 米。`;
    } else if (Math.abs(dGain) < 30 && nth >= 3) {
      line += '来了这么多次，这条路你比谁都熟。';
    } else {
      line += '这座山一直在等你。';
    }
    return {
      title: `第 ${nth} 次 · ${name}`,
      text: line,
      stat: `${kmNow.toFixed(2)} 公里 · 爬升 ${Math.round(gainNow)} 米`
    };
  }

  /* 换了一座山 */
  const mountains = new Set(mine.map((t) => (t.name || '').split(' · ')[0]));
  return {
    title: '又一座山',
    text: `${name}第一次来，记下了。你已经在 ${mountains.size + 1} 座山上留下过脚印。`,
    stat: `${kmNow.toFixed(2)} 公里 · 爬升 ${Math.round(gainNow)} 米`
  };
}
